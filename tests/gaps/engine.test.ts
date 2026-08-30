import { describe, expect, it } from "vitest";
import { mergeSignalsIntoGaps } from "@/lib/gaps/engine";
import type { CapabilityGap, FrictionSignal, Journey } from "@/lib/shared/types";

function journey(id: string, sessionId: string): Journey {
  return {
    id,
    sessionId,
    steps: [],
    signature: "search_products>get_product×3",
    startedAt: 1,
    endedAt: 10,
    durationMs: 9,
    callCount: 4,
    outcome: "abandoned",
    inferredIntent: "comparison",
    frictionScore: 2,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
  };
}

function signal(id: string, sessionId: string, journeyId: string): FrictionSignal {
  return {
    id,
    type: "MULTI_ENTITY_INSPECTION",
    confidence: 0.8,
    severity: "high",
    journeyId,
    sessionId,
    involvedTools: ["get_product"],
    entityType: "product",
    evidence: {},
    detectedAt: 1,
    wastedCallsEstimate: 4,
  };
}

describe("gap merge resolution", () => {
  it("does not resurrect a resolved gap", () => {
    const journeys = [
      journey("j1", "s1"),
      journey("j2", "s2"),
      journey("j3", "s3"),
    ];
    const signals = [
      signal("f1", "s1", "j1"),
      signal("f2", "s2", "j2"),
      signal("f3", "s3", "j3"),
    ];
    const existing: CapabilityGap = {
      id: "g1",
      title: "Missing compare_products capability",
      type: "COMPARE",
      entityType: "product",
      detectedIntent: "comparison",
      status: "resolved",
      confidence: 0.8,
      severity: "high",
      supportingSessionIds: ["s1", "s2", "s3"],
      affectedSessions: 3,
      percentageOfRelevantJourneys: 1,
      currentAvgCallCount: 4,
      currentCompletionRate: 0,
      signalIds: ["f1", "f2", "f3"],
      mergeKey: "MULTI_ENTITY_INSPECTION:product:get_product",
      firstDetectedAt: 1,
      lastDetectedAt: 1,
      statusHistory: [{ status: "resolved", at: 2, by: "system" }],
      resolvedAt: 2,
      resolvedByCapabilityId: "cap1",
    };

    const merged = mergeSignalsIntoGaps(signals, journeys, [existing]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe("resolved");
    expect(merged[0]!.resolvedByCapabilityId).toBe("cap1");
  });
});
