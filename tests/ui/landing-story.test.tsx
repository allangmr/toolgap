import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STORY_BEATS, SignalChainHero } from "@/components/viz/SignalChainHero";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

describe("SignalChainHero", () => {
  it("tells intent, calls, friction, then missing capability", () => {
    render(<SignalChainHero />);

    expect(STORY_BEATS.map((beat) => beat.kind)).toEqual([
      "intent",
      "calls",
      "friction",
      "capability",
    ]);
    expect(screen.getByText("compare products")).toBeInTheDocument();
    expect(screen.getByText("get_product ×3")).toBeInTheDocument();
    expect(screen.getByText("no compare tool")).toBeInTheDocument();
    expect(screen.getByText("compare_products")).toBeInTheDocument();
  });
});
