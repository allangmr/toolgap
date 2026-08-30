import { describe, expect, it } from "vitest";
import {
  buildJourneyFromEvents,
  buildSignature,
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
