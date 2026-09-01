import { describe, expect, it } from "vitest";
import {
  canEnterStep,
  isStepComplete,
  parseWorkflowStepParam,
  resolveWorkflowStep,
  workflowStepForRecommendationStatus,
} from "@/lib/gaps/workflow-steps";
import type {
  CapabilityGap,
  Recommendation,
  RecommendationSimulation,
} from "@/lib/shared/types";

function gap(overrides: Partial<CapabilityGap> = {}): CapabilityGap {
  return {
    id: "gap-1",
    type: "COMPARE",
    title: "Missing compare",
    entityType: "product",
    detectedIntent: "comparison",
    severity: "high",
    confidence: 0.9,
    status: "detected",
    supportingSessionIds: ["s1", "s2", "s3"],
    signalIds: [],
    affectedSessions: 3,
    percentageOfRelevantJourneys: 0.5,
    currentAvgCallCount: 4,
    currentCompletionRate: null,
    mergeKey: "compare",
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [],
    ...overrides,
  };
}

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "rec-1",
    gapId: "gap-1",
    templateType: "COMPARE",
    proposedToolName: "compare_products",
    description: "Compare products",
    templateConfig: {},
    inputSchemaJson: {},
    outputShapeJson: {},
    explanation: { text: "test", generatedBy: "deterministic" },
    estimatedBenefit: { callReduction: 2, basis: "estimated" },
    risks: [],
    status: "ready",
    createdBy: "human",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function sim(): RecommendationSimulation {
  return {
    id: "sim-1",
    recommendationId: "rec-1",
    patternSignature: "search_products>get_product×3",
    current: { calls: 4, avgDurationMs: 100, source: "measured" },
    proposed: { calls: 2, estDurationMs: 50, source: "estimated" },
    assumptions: ["test"],
    affectedSessions: 3,
    createdAt: 1,
  };
}

describe("workflow-steps", () => {
  it("maps legacy tab params to steps", () => {
    expect(parseWorkflowStepParam(null, "recommendation")).toBe("propose");
    expect(parseWorkflowStepParam("compare", null)).toBe("compare");
  });

  it("resolves to evidence when threshold not met", () => {
    expect(
      resolveWorkflowStep(
        gap({ supportingSessionIds: ["s1", "s2"], status: "detected" }),
        undefined,
        undefined,
      ),
    ).toBe("evidence");
  });

  it("resolves to propose after evidence threshold", () => {
    const g = gap({ status: "detected" });
    expect(resolveWorkflowStep(g, undefined, undefined)).toBe("propose");
  });

  it("resolves to propose when recommendation exists without simulation", () => {
    const g = gap({ status: "recommendation_ready", recommendationId: "rec-1" });
    expect(resolveWorkflowStep(g, rec(), undefined)).toBe("propose");
  });

  it("resolves to compare after simulation", () => {
    const g = gap({ status: "simulated", recommendationId: "rec-1" });
    expect(resolveWorkflowStep(g, rec({ status: "simulated" }), sim())).toBe("compare");
  });

  it("resolves to publish when approved", () => {
    const g = gap({ status: "approved", recommendationId: "rec-1" });
    expect(resolveWorkflowStep(g, rec({ status: "approved" }), sim())).toBe("publish");
  });

  it("marks steps complete from domain state", () => {
    const g = gap();
    const recommendation = rec();
    const simulation = sim();
    expect(isStepComplete("evidence", g, undefined, undefined)).toBe(true);
    expect(isStepComplete("propose", g, recommendation, undefined)).toBe(true);
    expect(isStepComplete("compare", g, recommendation, simulation)).toBe(true);
    expect(isStepComplete("approve", g, rec({ status: "approved" }), simulation)).toBe(
      true,
    );
  });

  it("blocks propose for non-actionable gap types", () => {
    const g = gap({ type: "FILTER" });
    expect(canEnterStep("propose", g, undefined, undefined)).toBe(false);
  });

  it("maps recommendation status to workflow step for deep links", () => {
    expect(workflowStepForRecommendationStatus("simulated")).toBe("approve");
    expect(workflowStepForRecommendationStatus("approved")).toBe("publish");
    expect(workflowStepForRecommendationStatus("ready")).toBe("propose");
  });
});
