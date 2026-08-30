import { describe, expect, it } from "vitest";
import {
  failureLoop,
  missingAggregation,
  multiEntityInspection,
  parameterIteration,
  repeatedSequence,
  runDetectors,
} from "@/lib/detectors/engine";
import type { Journey, JourneyStep } from "@/lib/shared/types";

function step(
  toolName: string,
  opts: Partial<JourneyStep> = {},
): JourneyStep {
  return {
    toolName,
    entityIds: opts.entityIds ?? [],
    success: opts.success ?? true,
    durationMs: 40,
    repeatIndex: 1,
    paramsHash: opts.paramsHash ?? "h",
    sequenceIndex: opts.sequenceIndex ?? 1,
    errorCategory: opts.errorCategory,
  };
}

function journey(steps: JourneyStep[], overrides: Partial<Journey> = {}): Journey {
  return {
    id: "j1",
    sessionId: "s1",
    steps,
    signature: steps.map((s) => s.toolName).join(">"),
    startedAt: 1,
    endedAt: 100,
    durationMs: 99,
    callCount: steps.length,
    outcome: "abandoned",
    inferredIntent: "comparison",
    frictionScore: 0,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
    ...overrides,
  };
}

describe("detectors", () => {
  it("detects MULTI_ENTITY_INSPECTION", () => {
    const j = journey([
      step("search_products"),
      step("get_product", { entityIds: ["a"] }),
      step("get_product", { entityIds: ["b"] }),
      step("get_product", { entityIds: ["c"] }),
      step("get_availability", { entityIds: ["a"] }),
    ]);
    const signal = multiEntityInspection.analyze(j, { journeys: [j] });
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe("MULTI_ENTITY_INSPECTION");
    expect(signal!.evidence.entitiesInspected).toBe(3);
    expect(signal!.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("abstains MULTI_ENTITY_INSPECTION below threshold", () => {
    const j = journey([
      step("search_products"),
      step("get_product", { entityIds: ["a"] }),
      step("get_product", { entityIds: ["b"] }),
    ]);
    expect(multiEntityInspection.analyze(j, { journeys: [j] })).toBeNull();
  });

  it("detects FAILURE_LOOP", () => {
    const j = journey([
      step("get_product", {
        success: false,
        errorCategory: "not_found",
        entityIds: ["x"],
      }),
      step("get_product", {
        success: false,
        errorCategory: "not_found",
        entityIds: ["x"],
      }),
      step("get_product", {
        success: false,
        errorCategory: "not_found",
        entityIds: ["x"],
      }),
    ]);
    const signal = failureLoop.analyze(j, { journeys: [j] });
    expect(signal?.severity).toBe("high");
    expect(signal?.evidence.attempts).toBe(3);
  });

  it("detects MISSING_AGGREGATION for availability", () => {
    const j = journey([
      step("get_availability", { entityIds: ["a"] }),
      step("get_availability", { entityIds: ["b"] }),
      step("get_availability", { entityIds: ["c"] }),
    ]);
    const signal = missingAggregation.analyze(j, { journeys: [j] });
    expect(signal?.type).toBe("MISSING_AGGREGATION");
    expect(signal?.entityType).toBe("inventory");
  });

  it("detects REPEATED_SEQUENCE", () => {
    const j = journey([
      step("search_products", { paramsHash: "q1" }),
      step("get_product", { entityIds: ["a"] }),
      step("search_products", { paramsHash: "q2" }),
      step("get_product", { entityIds: ["b"] }),
      step("search_products", { paramsHash: "q3" }),
      step("get_product", { entityIds: ["c"] }),
    ]);
    expect(repeatedSequence.analyze(j, { journeys: [j] })).not.toBeNull();
  });

  it("detects PARAMETER_ITERATION", () => {
    const j = journey([
      step("search_products", { paramsHash: "category|laptops|maxPrice|2000" }),
      step("search_products", { paramsHash: "category|laptops|maxPrice|1500" }),
      step("search_products", { paramsHash: "category|laptops|maxPrice|1000" }),
    ]);
    expect(parameterIteration.analyze(j, { journeys: [j] })).not.toBeNull();
  });

  it("deduplicates detector outputs", () => {
    const j = journey([
      step("search_products"),
      step("get_product", { entityIds: ["a"] }),
      step("get_product", { entityIds: ["b"] }),
      step("get_product", { entityIds: ["c"] }),
      step("get_availability", { entityIds: ["a"] }),
      step("get_availability", { entityIds: ["b"] }),
      step("get_availability", { entityIds: ["c"] }),
    ]);
    const signals = runDetectors(j, { journeys: [j] });
    const types = signals.map((s) => s.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
