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
import type { FrictionSignal, Journey } from "@/lib/shared/types";
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
  // Also finalize sessions that are still active but we want journeys for seed:
  // For analysis, build journeys for any session that has events and is not active
  // OR has been inactive — additionally build for completed/expired without journeys.

  const sessions = await sessionRepo.all();
  const existingJourneys = await journeyRepo.all();
  const journeyedSessions = new Set(existingJourneys.map((j) => j.sessionId));

  const newJourneys: Journey[] = [];
  for (const session of sessions) {
    if (journeyedSessions.has(session.id)) continue;
    if (session.status === "active") continue;
    const events = await toolCallRepo.bySession(session.id);
    const storeEvents = events.filter((e) => e.surface === "store");
    const journey = buildJourneyFromEvents(session.id, storeEvents);
    if (journey) {
      // attach friction score later
      newJourneys.push(journey);
    }
  }

  if (newJourneys.length > 0) {
    await journeyRepo.putMany(newJourneys);
  }

  const allJourneys = [...existingJourneys, ...newJourneys];
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
    journeysBuilt: newJourneys.length,
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

  // Mark all non-active sessions as expired so journeys rebuild
  const sessions = await sessionRepo.all();
  for (const session of sessions) {
    if (session.status === "active") {
      session.status = "expired";
      session.endedAt = session.lastActivityAt;
    }
  }
  await sessionRepo.putMany(sessions);

  return runAnalysis();
}
