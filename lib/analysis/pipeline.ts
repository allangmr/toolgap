import {
  frictionRepo,
  gapRepo,
  journeyRepo,
  metaRepo,
  sessionRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { runDetectors } from "@/lib/detectors/engine";
import { mergeSignalsIntoGaps } from "@/lib/gaps/engine";
import { buildJourneyFromEvents } from "@/lib/journeys/reconstruct";
import { finalizeExpiredSessions } from "@/lib/sessions/sessionizer";
import { nowMs } from "@/lib/shared";
import type { FrictionSignal, Journey, JourneyState } from "@/lib/shared/types";
import { telemetryRecorder } from "@/lib/telemetry/recorder";

export interface AnalysisResult {
  finalizedSessions: number;
  journeysBuilt: number;
  signalsCreated: number;
  gapsUpdated: number;
  at: number;
}

export async function runAnalysis(): Promise<AnalysisResult> {
  await telemetryRecorder.flush();

  const finalized = await finalizeExpiredSessions();

  const sessions = await sessionRepo.all();
  const existingJourneys = await journeyRepo.all();
  // Keyed by session so an evolving active session keeps one journey id.
  const journeyBySession = new Map(existingJourneys.map((j) => [j.sessionId, j]));

  const changedJourneys: Journey[] = [];
  const refreshedJourneyIds: string[] = [];

  for (const session of sessions) {
    const existing = journeyBySession.get(session.id);
    const state: JourneyState =
      session.status === "active" ? "provisional" : "final";
    // A settled journey whose session is closed can never change again.
    if (existing && existing.state === "final" && state === "final") continue;

    const events = await toolCallRepo.bySession(session.id);
    const storeEvents = events.filter((e) => e.surface === "store");
    const built = buildJourneyFromEvents(session.id, storeEvents, { state });
    if (!built) continue;

    if (!existing) {
      journeyBySession.set(session.id, built);
      changedJourneys.push(built);
      continue;
    }

    // Settling a provisional journey counts as a change even when no calls
    // arrived, because the outcome stops being in_progress.
    const unchanged =
      existing.state === state &&
      existing.callCount === built.callCount &&
      existing.lastEventSeq === built.lastEventSeq;
    if (unchanged) continue;

    const refreshed: Journey = { ...built, id: existing.id };
    journeyBySession.set(session.id, refreshed);
    changedJourneys.push(refreshed);
    refreshedJourneyIds.push(existing.id);
  }

  if (changedJourneys.length > 0) {
    await journeyRepo.putMany(changedJourneys);
  }

  // A refreshed snapshot invalidates the signals derived from the previous one.
  await frictionRepo.deleteByJourneys(refreshedJourneyIds);

  const allJourneys = [...journeyBySession.values()];
  const existingSignals = await frictionRepo.all();
  const signaledJourneys = new Set(existingSignals.map((s) => s.journeyId));

  const newSignals: FrictionSignal[] = [];
  for (const journey of allJourneys) {
    if (signaledJourneys.has(journey.id)) continue;
    const signals = runDetectors(journey, { journeys: allJourneys });
    newSignals.push(...signals);
    if (signals.length > 0) {
      journey.frictionScore = signals.reduce((s, sig) => s + sig.wastedCallsEstimate, 0);
      await journeyRepo.put(journey);
    }
  }

  if (newSignals.length > 0) {
    await frictionRepo.putMany(newSignals);
  }

  const allSignals = [...existingSignals, ...newSignals];
  const existingGaps = await gapRepo.all();
  const merged = mergeSignalsIntoGaps(allSignals, allJourneys, existingGaps);
  await gapRepo.putMany(merged);

  const meta = await metaRepo.get();
  await metaRepo.put({
    ...meta,
    lastAnalysisAt: nowMs(),
    lastAnalyzedEventTimestamp: nowMs(),
  });

  return {
    finalizedSessions: finalized.length,
    journeysBuilt: changedJourneys.length,
    signalsCreated: newSignals.length,
    gapsUpdated: merged.length,
    at: nowMs(),
  };
}

export async function rebuildDerivedData(): Promise<AnalysisResult> {
  await frictionRepo.clear();
  await journeyRepo.clear();
  await gapRepo.clear();
  await metaRepo.put({
    id: "meta",
    lastAnalyzedEventTimestamp: 0,
    analysisVersion: 1,
  });

  return runAnalysis();
}
