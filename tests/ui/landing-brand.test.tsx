import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { BRAND_MARK_SRC } from "@/components/brand/BrandLogo";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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
    useReducedMotion: () => true,
  };
});

describe("landing brand", () => {
  it("shows the ToolGap mark in the header and footer", () => {
    render(<HomePage />);
    const brandLinks = screen.getAllByRole("link", { name: "ToolGap" });
    expect(brandLinks).toHaveLength(2);
    expect(brandLinks[0]).toHaveAttribute("href", "/");
    expect(brandLinks[1]).toHaveAttribute("href", "/");
    const marks = brandLinks.flatMap((link) => [...link.querySelectorAll("img")]);
    expect(marks).toHaveLength(2);
    expect(marks.every((img) => img.getAttribute("src") === BRAND_MARK_SRC)).toBe(true);
  });
});
