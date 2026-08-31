import { describe, expect, it } from "vitest";
import {
  excessiveCalls,
  failureLoop,
  missingAggregation,
  multiEntityInspection,
  parameterIteration,
  repeatedSequence,
  runDetectors,
} from "@/lib/detectors/engine";
import { hashParams, paramKeyPaths } from "@/lib/telemetry/redaction";
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
    paramsKeys: opts.paramsKeys,
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
    state: "final",
    lastEventSeq: steps.length,
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

  it("abstains MULTI_ENTITY_INSPECTION on interleaved search-get (filter iteration)", () => {
    const j = journey([
      step("search_products", { paramsHash: "q1" }),
      step("get_product", { entityIds: ["a"] }),
      step("search_products", { paramsHash: "q2" }),
      step("get_product", { entityIds: ["b"] }),
      step("search_products", { paramsHash: "q3" }),
      step("get_product", { entityIds: ["c"] }),
    ]);
    expect(multiEntityInspection.analyze(j, { journeys: [j] })).toBeNull();
    expect(repeatedSequence.analyze(j, { journeys: [j] })).not.toBeNull();
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

  it("detects EXCESSIVE_CALLS against a comparable corpus", () => {
    const corpus = Array.from({ length: 10 }, (_, i) =>
      journey([step("search_products")], {
        id: `c${i}`,
        sessionId: `sc${i}`,
        callCount: 4,
        outcome: "completed",
        inferredIntent: "comparison",
      }),
    );
    const heavy = journey([step("search_products"), step("get_product")], {
      id: "heavy",
      sessionId: "sh",
      callCount: 20,
      inferredIntent: "comparison",
    });
    const signal = excessiveCalls.analyze(heavy, { journeys: [...corpus, heavy] });
    expect(signal?.type).toBe("EXCESSIVE_CALLS");
    expect(signal?.evidence.calls).toBe(20);
  });

  it("abstains EXCESSIVE_CALLS without enough comparable journeys", () => {
    const heavy = journey([step("search_products")], {
      callCount: 20,
      inferredIntent: "comparison",
    });
    expect(excessiveCalls.analyze(heavy, { journeys: [heavy] })).toBeNull();
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

  it("detects PARAMETER_ITERATION from production-shaped hashes and keys", () => {
    const inputs = [
      { category: "laptops", maxPrice: 2000 },
      { category: "laptops", maxPrice: 1500 },
      { category: "laptops", maxPrice: 1000 },
    ];
    const j = journey(
      inputs.map((input) =>
        step("search_products", {
          paramsHash: hashParams(input),
          paramsKeys: paramKeyPaths(input),
        }),
      ),
    );
    expect(parameterIteration.analyze(j, { journeys: [j] })).not.toBeNull();
  });

  it("does not detect PARAMETER_ITERATION from opaque hashes without keys", () => {
    const j = journey([
      step("search_products", {
        paramsHash: hashParams({ category: "laptops", maxPrice: 2000 }),
      }),
      step("search_products", {
        paramsHash: hashParams({ category: "laptops", maxPrice: 1500 }),
      }),
      step("search_products", {
        paramsHash: hashParams({ category: "laptops", maxPrice: 1000 }),
      }),
    ]);
    expect(parameterIteration.analyze(j, { journeys: [j] })).toBeNull();
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
