import { describe, expect, it } from "vitest";
import {
  buildJourneyFromEvents,
  buildSignature,
  completionRate,
  formatCompletionRate,
  formatJourneyOutcome,
  inferIntent,
} from "@/lib/journeys/reconstruct";
import type { ToolCallEvent } from "@/lib/shared/types";

function event(
  partial: Partial<ToolCallEvent> & Pick<ToolCallEvent, "toolName" | "sequenceIndex">,
): ToolCallEvent {
  return {
    id: `e-${partial.sequenceIndex}`,
    sessionId: "s1",
    timestamp: 1000 + partial.sequenceIndex * 100,
    toolVersion: "1.0.0",
    origin: "static",
    surface: "store",
    input: {},
    resultMeta: { ok: true },
    success: true,
    durationMs: 50,
    page: "/store",
    ...partial,
  };
}

describe("journey reconstruction", () => {
  it("builds ordered steps and signature with repeats", () => {
    const events = [
      event({ toolName: "search_products", sequenceIndex: 1 }),
      event({
        toolName: "get_product",
        sequenceIndex: 2,
        entityIds: ["a"],
        input: { productId: "a" },
      }),
      event({
        toolName: "get_product",
        sequenceIndex: 3,
        entityIds: ["b"],
        input: { productId: "b" },
      }),
      event({
        toolName: "get_product",
        sequenceIndex: 4,
        entityIds: ["c"],
        input: { productId: "c" },
      }),
    ];
    const journey = buildJourneyFromEvents("s1", events);
    expect(journey).not.toBeNull();
    expect(journey!.signature).toBe("search_products>get_product×3");
    expect(journey!.callCount).toBe(4);
    expect(journey!.inferredIntent).toBe("comparison");
    expect(journey!.steps[1]!.paramsKeys).toEqual(["productId"]);
  });

  it("handles malformed/out-of-order sequence indexes", () => {
    const events = [
      event({ toolName: "get_product", sequenceIndex: 3, entityIds: ["a"] }),
      event({ toolName: "search_products", sequenceIndex: 1 }),
      event({ toolName: "get_product", sequenceIndex: 2, entityIds: ["b"] }),
    ];
    const journey = buildJourneyFromEvents("s1", events);
    expect(journey!.steps.map((s) => s.toolName)).toEqual([
      "search_products",
      "get_product",
      "get_product",
    ]);
  });

  it("classifies purchase intent", () => {
    const steps = [
      { toolName: "get_product", entityIds: ["a"], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 1 },
      { toolName: "add_to_cart", entityIds: ["a"], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 2 },
    ];
    expect(inferIntent(steps, buildSignature(steps))).toBe("purchase");
  });

  it("returns null for empty events", () => {
    expect(buildJourneyFromEvents("s1", [])).toBeNull();
  });
});

describe("task completion semantics", () => {
  const comparisonEvents = [
    event({ toolName: "search_products", sequenceIndex: 1 }),
    event({ toolName: "get_product", sequenceIndex: 2, entityIds: ["a"] }),
    event({ toolName: "get_product", sequenceIndex: 3, entityIds: ["b"] }),
    event({ toolName: "get_product", sequenceIndex: 4, entityIds: ["c"] }),
    event({ toolName: "get_availability", sequenceIndex: 5, entityIds: ["a"] }),
    event({ toolName: "get_availability", sequenceIndex: 6, entityIds: ["b"] }),
    event({ toolName: "get_availability", sequenceIndex: 7, entityIds: ["c"] }),
  ];

  it("keeps an active comparison journey in progress with unmeasured completion", () => {
    const journey = buildJourneyFromEvents("s1", comparisonEvents, {
      state: "provisional",
    });
    expect(journey!.outcome).toBe("in_progress");
    expect(formatJourneyOutcome(journey!.outcome)).toBe("In progress");
    expect(formatCompletionRate([journey!])).toBe("Not measured");
    expect(completionRate([journey!])).toBeNull();
  });

  it("marks a settled comparison journey as unknown, not abandoned", () => {
    const journey = buildJourneyFromEvents("s1", comparisonEvents, {
      state: "final",
    });
    expect(journey!.outcome).toBe("unknown");
    expect(formatJourneyOutcome(journey!.outcome)).toBe("Not measured");
    expect(formatCompletionRate([journey!])).toBe("Not measured");
  });

  it("preserves explicit checkout completion", () => {
    const events = [
      event({ toolName: "get_product", sequenceIndex: 1, entityIds: ["a"] }),
      event({ toolName: "complete_checkout", sequenceIndex: 2 }),
    ];
    const journey = buildJourneyFromEvents("s1", events, { state: "final" });
    expect(journey!.outcome).toBe("completed");
    expect(formatCompletionRate([journey!])).toBe("100%");
  });

  it("preserves short lookup completion", () => {
    const events = [
      event({ toolName: "search_products", sequenceIndex: 1 }),
      event({ toolName: "get_product", sequenceIndex: 2, entityIds: ["a"] }),
    ];
    const journey = buildJourneyFromEvents("s1", events, { state: "final" });
    expect(journey!.outcome).toBe("completed");
    expect(completionRate([journey!])).toBe(1);
  });
});

describe("intent classification", () => {
  it("classifies post-publish compare_products journeys as comparison", () => {
    const steps = [
      { toolName: "search_products", entityIds: [], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 1 },
      { toolName: "compare_products", entityIds: ["a", "b"], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 2 },
    ];
    expect(inferIntent(steps, buildSignature(steps))).toBe("comparison");
  });

  it("classifies compare_products alone as comparison", () => {
    const steps = [
      { toolName: "compare_products", entityIds: ["a", "b"], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 1 },
    ];
    expect(inferIntent(steps, buildSignature(steps))).toBe("comparison");
  });

  it("keeps single-product lookup as lookup", () => {
    const steps = [
      { toolName: "search_products", entityIds: [], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 1 },
      { toolName: "get_product", entityIds: ["a"], success: true, durationMs: 10, repeatIndex: 1, paramsHash: "h", sequenceIndex: 2 },
    ];
    expect(inferIntent(steps, buildSignature(steps))).toBe("lookup");
  });
});
