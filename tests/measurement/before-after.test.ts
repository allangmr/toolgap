import { describe, expect, it } from "vitest";
import { computeBeforeAfter } from "@/lib/measurement/before-after";
import { resetDbForTests } from "@/lib/db/schema";
import { metricRepo } from "@/lib/db/repositories";
import type { Journey, PublishedCapability, ToolCallEvent } from "@/lib/shared/types";

function journey(
  id: string,
  sessionId: string,
  startedAt: number,
  intent: Journey["inferredIntent"],
): Journey {
  return {
    id,
    sessionId,
    steps: [],
    signature: "x",
    startedAt,
    endedAt: startedAt + 10,
    durationMs: 10,
    callCount: intent === "purchase" ? 3 : 6,
    state: "final",
    lastEventSeq: intent === "purchase" ? 3 : 6,
    outcome: "abandoned",
    inferredIntent: intent,
    frictionScore: 1,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
  };
}

describe("before/after measurement", () => {
  const capability: PublishedCapability = {
    id: "cap1",
    recommendationId: "r1",
    toolName: "compare_products",
    templateType: "COMPARE",
    config: {},
    version: 1,
    status: "active",
    publishedAt: 1_000,
    schemaJson: {},
  };

  it("reports insufficient data when after n is below 5", () => {
    const journeys = [
      journey("b1", "s1", 100, "comparison"),
      journey("b2", "s2", 200, "comparison"),
      journey("a1", "s3", 2_000, "comparison"),
    ];
    const snapshot = computeBeforeAfter({
      capability,
      journeys,
      events: [],
      intent: "comparison",
    });
    expect(snapshot.sufficientData).toBe(false);
    expect(snapshot.before.sampleSize).toBe(2);
    expect(snapshot.after.sampleSize).toBe(1);
  });

  it("counts after journeys that used the published tool even if intent differs", () => {
    const before = Array.from({ length: 5 }, (_, i) =>
      journey(`b${i}`, `sb${i}`, 100 + i, "comparison"),
    );
    const after = Array.from({ length: 6 }, (_, i) =>
      journey(`a${i}`, `sa${i}`, 2_000 + i, "purchase"),
    );
    const events: ToolCallEvent[] = after.map((j, i) => ({
      id: `e${i}`,
      sessionId: j.sessionId,
      timestamp: j.startedAt,
      sequenceIndex: 1,
      toolName: "compare_products",
      toolVersion: "1",
      origin: "dynamic",
      surface: "store",
      capabilityId: "cap1",
      input: {},
      resultMeta: { ok: true },
      success: true,
      durationMs: 10,
      page: "/store",
    }));
    const snapshot = computeBeforeAfter({
      capability,
      journeys: [...before, ...after],
      events,
      intent: "comparison",
    });
    expect(snapshot.before.sampleSize).toBe(5);
    expect(snapshot.after.sampleSize).toBe(6);
    expect(snapshot.sufficientData).toBe(true);
  });
});

describe("metricRepo.byCapability", () => {
  it("returns the newest snapshot by computedAt", async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    const base = {
      capabilityId: "cap1",
      version: 1,
      windowBefore: { from: 0, to: 1 },
      windowAfter: { from: 1, to: 2 },
      journeyScope: {},
      before: {
        avgCalls: 6,
        completionRate: 0,
        avgDurationMs: 10,
        sampleSize: 12,
        source: "measured" as const,
      },
      after: {
        avgCalls: 3,
        completionRate: 0,
        avgDurationMs: 8,
        sampleSize: 0,
        source: "measured" as const,
      },
      sufficientData: false,
    };
    await metricRepo.put({ ...base, id: "old", computedAt: 1 });
    await metricRepo.put({
      ...base,
      id: "new",
      computedAt: 2,
      after: { ...base.after, sampleSize: 6 },
      sufficientData: true,
    });
    const latest = await metricRepo.byCapability("cap1");
    expect(latest?.id).toBe("new");
    expect(latest?.after.sampleSize).toBe(6);
  });
});

