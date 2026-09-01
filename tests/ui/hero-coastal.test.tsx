import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  HERO_POSTER_SRC,
  HERO_VIDEO_SRC,
  HeroCoastalVideo,
} from "@/components/viz/HeroCoastalVideo";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stand-in for next/image
    <img src={props.src} alt={props.alt} className={props.className} />
  ),
}));

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe("HeroCoastalVideo", () => {
  it("renders a muted looping local video with a poster", () => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();

    const { container } = render(<HeroCoastalVideo />);
    const video = container.querySelector("video");

    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("poster", HERO_POSTER_SRC);
    expect(video?.querySelector("source")).toHaveAttribute("src", HERO_VIDEO_SRC);
    expect(video?.className).toContain("object-cover");
  });
});
