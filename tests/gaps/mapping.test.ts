import { describe, expect, it } from "vitest";
import { frictionToGapType, mergeSignalsIntoGaps } from "@/lib/gaps/engine";
import type { EntityType, FrictionSignal, FrictionType, Journey } from "@/lib/shared/types";

function journey(id: string, sessionId: string): Journey {
  return {
    id,
    sessionId,
    steps: [],
    signature: "get_product×3",
    startedAt: 1,
    endedAt: 10,
    durationMs: 9,
    callCount: 4,
    state: "final",
    lastEventSeq: 4,
    outcome: "abandoned",
    inferredIntent: "lookup",
    frictionScore: 2,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
  };
}

function signal(
  type: FrictionType,
  sessionId: string,
  journeyId: string,
  entityType?: EntityType,
): FrictionSignal {
  return {
    id: `${type}-${sessionId}`,
    type,
    confidence: 0.8,
    severity: "high",
    journeyId,
    sessionId,
    involvedTools: ["get_product"],
    entityType,
    evidence: {},
    detectedAt: 1,
    wastedCallsEstimate: 3,
  };
}

describe("friction to gap mapping", () => {
  it("maps every friction type without a silent default", () => {
    expect(frictionToGapType("MULTI_ENTITY_INSPECTION")).toBe("COMPARE");
    expect(frictionToGapType("MISSING_AGGREGATION", "inventory")).toBe(
      "AVAILABILITY_BATCH",
    );
    expect(frictionToGapType("MISSING_AGGREGATION", "product")).toBe("BULK_READ");
    expect(frictionToGapType("REPEATED_SEQUENCE")).toBe("FILTER");
    expect(frictionToGapType("PARAMETER_ITERATION")).toBe("FILTER");
    expect(frictionToGapType("FAILURE_LOOP")).toBe("FAILURE_LOOP");
    expect(frictionToGapType("EXCESSIVE_CALLS")).toBe("UNKNOWN");
  });

  it("surfaces a FAILURE_LOOP gap instead of UNKNOWN", () => {
    const journeys = [
      journey("j1", "s1"),
      journey("j2", "s2"),
      journey("j3", "s3"),
    ];
    const signals = journeys.map((j) =>
      signal("FAILURE_LOOP", j.sessionId, j.id, "product"),
    );
    const merged = mergeSignalsIntoGaps(signals, journeys, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.type).toBe("FAILURE_LOOP");
    expect(merged[0]!.title).toBe("Agents retry the same failing tool");
  });

  it("keeps PARAMETER_ITERATION as FILTER, not BULK_READ", () => {
    const journeys = [
      journey("j1", "s1"),
      journey("j2", "s2"),
      journey("j3", "s3"),
    ];
    const signals = journeys.map((j) =>
      signal("PARAMETER_ITERATION", j.sessionId, j.id, "product"),
    );
    const merged = mergeSignalsIntoGaps(signals, journeys, []);
    expect(merged[0]!.type).toBe("FILTER");
    expect(merged[0]!.title).toMatch(/lack fields/i);
  });
});
