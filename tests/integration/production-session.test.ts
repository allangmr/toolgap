import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import {
  frictionRepo,
  gapRepo,
  journeyRepo,
  recommendationRepo,
  sessionRepo,
  settingsRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { transitionGap } from "@/lib/gaps/engine";
import { completionRate } from "@/lib/journeys/reconstruct";
import {
  clearMemoryForTests,
  nextCallContext,
  resetSessionizer,
} from "@/lib/sessions/sessionizer";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { registerStaticStoreTools } from "@/lib/webmcp/store-tools";
import { driveSequence } from "@/lib/webmcp/driver";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";

const p = SEED_PRODUCTS;

/**
 * Every session here is produced by the real recorder path — driveSequence goes
 * through ToolRegistry.invokeInternal → nextCallContext → telemetryRecorder,
 * exactly as an external WebMCP agent does. Nothing is hand-constructed and no
 * seed writer runs, so sessions stay `active` the way production leaves them.
 */
async function bootStore(): Promise<void> {
  const db = resetDbForTests();
  await db.delete();
  resetDbForTests();
  resetSessionizer();
  const registry = resetRegistryForTests();
  registry.setAdapterForTests(createNoopAdapter());
  await ensureCatalogSeeded();
  await registerStaticStoreTools((def) => registry.registerTool(def));
}

const comparisonDetour = [
  { tool: "search_products", params: { category: "headphones" } },
  { tool: "get_product", params: { productId: p[0]!.id } },
  { tool: "get_product", params: { productId: p[1]!.id } },
  { tool: "get_product", params: { productId: p[2]!.id } },
  { tool: "get_availability", params: { productId: p[0]!.id } },
  { tool: "get_availability", params: { productId: p[1]!.id } },
  { tool: "get_availability", params: { productId: p[2]!.id } },
];

/** Shape captured from the verified external-agent session on production. */
const verifiedExternalAgentSession = [
  { tool: "search_products", params: { q: "no-such-product-zzz" } },
  { tool: "search_products", params: { category: "headphones" } },
  { tool: "get_product", params: { productId: p[0]!.id } },
  { tool: "get_availability", params: { productId: p[0]!.id } },
  { tool: "get_availability", params: { productId: p[1]!.id } },
  { tool: "get_availability", params: { productId: p[2]!.id } },
  { tool: "get_availability", params: { productId: p[3]!.id } },
  { tool: "get_product", params: { productId: p[1]!.id } },
];

/** Starts a fresh agent session in the same tab, as a new agent run would. */
async function newAgentSession(
  steps: Array<{ tool: string; params?: Record<string, unknown> }>,
): Promise<void> {
  resetSessionizer();
  await driveSequence(steps);
}

async function expireSession(sessionId: string): Promise<void> {
  const settings = await settingsRepo.get();
  const session = await sessionRepo.get(sessionId);
  session!.lastActivityAt -= settings.inactivityTimeoutMs + 1;
  await sessionRepo.upsert(session!);
}

describe("production-shaped session reaches analysis", () => {
  beforeEach(bootStore);

  it("builds a journey for a session that is still active", async () => {
    await driveSequence(comparisonDetour);

    const sessions = await sessionRepo.all();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("active");
    expect(sessions[0]!.endedAt).toBeUndefined();

    await runAnalysis();

    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.sessionId).toBe(sessions[0]!.id);
    expect(journeys[0]!.callCount).toBe(7);
    expect(journeys[0]!.state).toBe("provisional");
  });

  it("reconstructs the verified external-agent session shape", async () => {
    await driveSequence(verifiedExternalAgentSession);
    await runAnalysis();

    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    const journey = journeys[0]!;

    expect(journey.callCount).toBe(8);
    expect(journey.state).toBe("provisional");
    expect(journey.signature).toBe(
      "search_products×2>get_product>get_availability×4>get_product",
    );
    expect(journey.steps.every((s) => s.success)).toBe(true);

    // An empty result set is a successful call, not a failure.
    const events = await toolCallRepo.bySession(journey.sessionId);
    const emptySearch = events.find((e) => e.input.q === "no-such-product-zzz")!;
    expect(emptySearch.success).toBe(true);
    expect(emptySearch.resultMeta.itemCount).toBe(0);
    expect(emptySearch.entityIds).toBeUndefined();
  });

  it("does not label an in-flight session as abandoned", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();

    const journey = (await journeyRepo.all())[0]!;
    expect(journey.outcome).toBe("in_progress");
    expect(journey.outcome).not.toBe("abandoned");

    // An unsettled snapshot must not drag completion metrics toward zero.
    expect(completionRate([journey])).toBe(0);
    expect(completionRate([journey, { outcome: "completed" }])).toBe(1);
  });

  it("settles the journey once the session times out", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();
    const provisional = (await journeyRepo.all())[0]!;
    expect(provisional.state).toBe("provisional");

    await expireSession(provisional.sessionId);
    await runAnalysis();

    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.id).toBe(provisional.id);
    expect(journeys[0]!.state).toBe("final");
    expect(journeys[0]!.outcome).toBe("abandoned");

    const session = await sessionRepo.get(provisional.sessionId);
    expect(session!.status).toBe("expired");
  });
});

describe("session boundaries survive analysis", () => {
  beforeEach(bootStore);

  it("leaves a live session open and continuable", async () => {
    await driveSequence(comparisonDetour);
    const before = (await sessionRepo.all())[0]!;

    await runAnalysis();

    const after = await sessionRepo.get(before.id);
    expect(after!.status).toBe("active");
    expect(after!.endedAt).toBeUndefined();
    expect(after!.lastActivityAt).toBe(before.lastActivityAt);

    // The sessionizer keeps writing into the same session afterwards.
    const ctx = await nextCallContext("store");
    expect(ctx.sessionId).toBe(before.id);
  });

  it("keeps one journey across a tab reload", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();
    const first = (await journeyRepo.all())[0]!;

    clearMemoryForTests();
    await driveSequence([
      { tool: "get_availability", params: { productId: p[3]!.id } },
    ]);
    await runAnalysis();

    const sessions = await sessionRepo.all();
    expect(sessions).toHaveLength(1);
    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.id).toBe(first.id);
    expect(journeys[0]!.callCount).toBe(8);
  });

  it("keeps separate agent runs in separate journeys", async () => {
    await newAgentSession(comparisonDetour);
    await newAgentSession(comparisonDetour);
    await runAnalysis();

    const sessions = await sessionRepo.all();
    expect(sessions).toHaveLength(2);
    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(2);
    expect(new Set(journeys.map((j) => j.sessionId)).size).toBe(2);
  });
});

describe("re-running analysis on a live session", () => {
  beforeEach(bootStore);

  it("is idempotent when nothing new was recorded", async () => {
    await driveSequence(comparisonDetour);
    const first = await runAnalysis();
    expect(first.journeysBuilt).toBe(1);

    const journeysAfterFirst = await journeyRepo.all();
    const signalsAfterFirst = await frictionRepo.all();

    const second = await runAnalysis();
    expect(second.journeysBuilt).toBe(0);
    expect(second.signalsCreated).toBe(0);

    const journeysAfterSecond = await journeyRepo.all();
    expect(journeysAfterSecond).toHaveLength(journeysAfterFirst.length);
    expect(journeysAfterSecond[0]!.id).toBe(journeysAfterFirst[0]!.id);
    expect(await frictionRepo.all()).toHaveLength(signalsAfterFirst.length);
  });

  it("refreshes the same journey in place when the session grows", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();
    const first = (await journeyRepo.all())[0]!;
    expect(first.callCount).toBe(7);

    await driveSequence([
      { tool: "get_availability", params: { productId: p[3]!.id } },
      { tool: "get_product", params: { productId: p[3]!.id } },
    ]);
    await runAnalysis();

    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.id).toBe(first.id);
    expect(journeys[0]!.callCount).toBe(9);
    expect(journeys[0]!.lastEventSeq).toBeGreaterThan(first.lastEventSeq);
  });

  it("leaves no duplicate or stale friction after a refresh", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();
    const journey = (await journeyRepo.all())[0]!;
    const staleSignalIds = (await frictionRepo.byJourney(journey.id)).map((s) => s.id);
    expect(staleSignalIds.length).toBeGreaterThan(0);

    await driveSequence([
      { tool: "get_product", params: { productId: p[3]!.id } },
    ]);
    await runAnalysis();

    const signals = await frictionRepo.all();
    // Detectors emit at most one signal per type for a journey.
    const perType = signals
      .filter((s) => s.journeyId === journey.id)
      .map((s) => s.type);
    expect(new Set(perType).size).toBe(perType.length);

    // Signals derived from the previous snapshot are gone, not orphaned.
    const liveIds = new Set(signals.map((s) => s.id));
    for (const staleId of staleSignalIds) {
      expect(liveIds.has(staleId)).toBe(false);
    }
  });
});

describe("gap evidence stays consistent across refreshes", () => {
  beforeEach(bootStore);

  async function threeComparisonSessions(): Promise<void> {
    await newAgentSession(comparisonDetour);
    await newAgentSession(comparisonDetour);
    await newAgentSession(comparisonDetour);
  }

  it("needs three supporting sessions before a COMPARE gap surfaces", async () => {
    await driveSequence(comparisonDetour);
    await runAnalysis();

    const signals = await frictionRepo.all();
    expect(signals.some((s) => s.type === "MULTI_ENTITY_INSPECTION")).toBe(true);
    // One real session is enough for a journey and a signal, never for a gap.
    expect(await gapRepo.all()).toHaveLength(0);

    await newAgentSession(comparisonDetour);
    await newAgentSession(comparisonDetour);
    await runAnalysis();

    const gaps = await gapRepo.all();
    const compareGap = gaps.find((g) => g.type === "COMPARE");
    expect(compareGap).toBeDefined();
    expect(compareGap!.affectedSessions).toBe(3);
  });

  it("never strands signal ids on a gap when a journey is refreshed", async () => {
    await threeComparisonSessions();
    await runAnalysis();
    const before = (await gapRepo.all()).find((g) => g.type === "COMPARE")!;
    expect(before.signalIds.length).toBeGreaterThan(0);

    // Grow the most recent still-active session and re-analyze.
    await driveSequence([
      { tool: "get_product", params: { productId: p[3]!.id } },
    ]);
    await runAnalysis();

    const after = (await gapRepo.all()).find((g) => g.type === "COMPARE")!;
    const liveSignalIds = new Set((await frictionRepo.all()).map((s) => s.id));
    for (const id of after.signalIds) {
      expect(liveSignalIds.has(id)).toBe(true);
    }
    expect(new Set(after.signalIds).size).toBe(after.signalIds.length);

    // The same three sessions still back the gap; none is double counted.
    expect(after.affectedSessions).toBe(3);
    expect(new Set(after.supportingSessionIds).size).toBe(3);
  });

  it("preserves an approved recommendation across a refresh", async () => {
    await threeComparisonSessions();
    await runAnalysis();

    const gap = (await gapRepo.all()).find((g) => g.type === "COMPARE")!;
    const rec = buildRecommendation(gap)!;
    await recommendationRepo.put(rec);
    await gapRepo.put({
      ...transitionGap(gap, "approved", "human"),
      recommendationId: rec.id,
    });

    await driveSequence([
      { tool: "get_product", params: { productId: p[3]!.id } },
    ]);
    await runAnalysis();

    const after = await gapRepo.get(gap.id);
    expect(after!.status).toBe("approved");
    expect(after!.recommendationId).toBe(rec.id);
    expect(after!.statusHistory.some((h) => h.status === "approved")).toBe(true);
    expect(await recommendationRepo.get(rec.id)).toBeDefined();
  });

  it("keeps provisional journeys out of the gap completion rate", async () => {
    await threeComparisonSessions();
    await runAnalysis();

    const gap = (await gapRepo.all()).find((g) => g.type === "COMPARE")!;
    const journeys = await journeyRepo.all();
    expect(journeys.every((j) => j.state === "provisional")).toBe(true);
    // No supporting journey has settled, so the rate is not asserted as 0%
    // drop-off from unsettled evidence.
    expect(gap.currentCompletionRate).toBe(0);
    expect(completionRate(journeys)).toBe(0);
  });
});

describe("telemetry buffering does not hide calls from analysis", () => {
  beforeEach(bootStore);

  it("flushes buffered events before building journeys", async () => {
    await driveSequence(comparisonDetour);
    // Nothing forced a flush: the buffer holds fewer than BUFFER_LIMIT events.
    expect(await toolCallRepo.count()).toBe(0);

    await runAnalysis();

    expect(await toolCallRepo.count()).toBe(7);
    expect(await journeyRepo.all()).toHaveLength(1);
  });

  it("records every call the agent made", async () => {
    await driveSequence(verifiedExternalAgentSession);
    await telemetryRecorder.flush();
    const session = (await sessionRepo.all())[0]!;
    expect(session.callCount).toBe(8);
    const events = await toolCallRepo.bySession(session.id);
    expect(events.map((e) => e.toolName)).toEqual([
      "search_products",
      "search_products",
      "get_product",
      "get_availability",
      "get_availability",
      "get_availability",
      "get_availability",
      "get_product",
    ]);
  });
});
