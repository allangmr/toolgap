import { describe, expect, it } from "vitest";
import {
  buildRecommendation,
  templateForGapType,
} from "@/lib/recommendations/builder";
import type { CapabilityGap } from "@/lib/shared/types";

function gap(type: CapabilityGap["type"]): CapabilityGap {
  return {
    id: "g1",
    title: "t",
    type,
    entityType: "product",
    detectedIntent: "lookup",
    status: "detected",
    confidence: 0.8,
    severity: "high",
    supportingSessionIds: ["s1", "s2", "s3"],
    affectedSessions: 3,
    percentageOfRelevantJourneys: 0.5,
    currentAvgCallCount: 6,
    currentCompletionRate: 0,
    signalIds: ["f1"],
    mergeKey: `${type}:product:get_product`,
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [{ status: "detected", at: 1, by: "system" }],
  };
}

describe("gap type to template mapping", () => {
  it("does not map FILTER or FAILURE_LOOP onto a publishable template", () => {
    expect(templateForGapType("FILTER")).toBeNull();
    expect(templateForGapType("FAILURE_LOOP")).toBeNull();
    expect(templateForGapType("UNKNOWN")).toBeNull();
    expect(buildRecommendation(gap("FILTER"))).toBeNull();
    expect(buildRecommendation(gap("FAILURE_LOOP"))).toBeNull();
  });

  it("still maps COMPARE and AVAILABILITY_BATCH to their templates", () => {
    expect(templateForGapType("COMPARE")).toBe("COMPARE");
    expect(templateForGapType("AVAILABILITY_BATCH")).toBe("AVAILABILITY_BATCH");
    expect(templateForGapType("BULK_READ")).toBe("BULK_READ");
    const rec = buildRecommendation(gap("COMPARE"));
    expect(rec?.templateType).toBe("COMPARE");
    expect(rec?.proposedToolName).toBe("compare_products");
  });
});
