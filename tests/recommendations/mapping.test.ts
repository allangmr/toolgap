import { describe, expect, it } from "vitest";
import {
  buildRecommendation,
  templateForGapType,
  type BuildResult,
} from "@/lib/recommendations/builder";
import type { CapabilityGap, Recommendation } from "@/lib/shared/types";

function expectOk(result: BuildResult): Recommendation {
  if (!result.ok) {
    throw new Error(
      `expected ok, got ${result.reason}${
        result.reason === "invalid_config" ? ` ${result.issues.join(" ")}` : ""
      }`,
    );
  }
  return result.recommendation;
}

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
    expect(buildRecommendation(gap("FILTER"))).toEqual({
      ok: false,
      reason: "no_template",
    });
    expect(buildRecommendation(gap("FAILURE_LOOP"))).toEqual({
      ok: false,
      reason: "no_template",
    });
  });

  it("still maps COMPARE and AVAILABILITY_BATCH to their templates", () => {
    expect(templateForGapType("COMPARE")).toBe("COMPARE");
    expect(templateForGapType("AVAILABILITY_BATCH")).toBe("AVAILABILITY_BATCH");
    expect(templateForGapType("BULK_READ")).toBe("BULK_READ");
    const result = buildRecommendation(gap("COMPARE"));
    expect(result.ok).toBe(true);
    const rec = expectOk(result);
    expect(rec.templateType).toBe("COMPARE");
    expect(rec.proposedToolName).toBe("compare_products");
  });
});

describe("estimated benefit honesty", () => {
  it("reports only the counted call reduction, with no latency figure", () => {
    const rec = expectOk(buildRecommendation(gap("COMPARE")));
    expect(rec.estimatedBenefit.callReduction).toBe(4);
    expect(rec.estimatedBenefit.basis).toBe("estimated");
    expect(Object.keys(rec.estimatedBenefit).sort()).toEqual([
      "basis",
      "callReduction",
    ]);
  });
});
