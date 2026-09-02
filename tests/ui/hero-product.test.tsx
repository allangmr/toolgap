import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HERO_IMAGE_SRC, HeroProductVisual } from "@/components/viz/HeroProductVisual";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stand-in for next/image
    <img src={props.src} alt={props.alt} className={props.className} />
  ),
}));

describe("HeroProductVisual", () => {
  it("renders the Fieldkit and ToolGap trace still as the hero image", () => {
    render(<HeroProductVisual />);
    const image = screen.getByRole("img", {
      name: "Fieldkit Market storefront beside a ToolGap live trace of search, get_product, and get_availability calls",
    });

    expect(image).toHaveAttribute("src", HERO_IMAGE_SRC);
    expect(image.className).toContain("object-cover");
  });
});
