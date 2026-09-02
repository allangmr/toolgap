import { existsSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrandLogo, BrandMark, BRAND_MARK_SRC } from "@/components/brand/BrandLogo";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stand-in for next/image
    <img src={props.src} alt={props.alt} className={props.className} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("brand assets", () => {
  it("ships the ToolGap mark, favicon, and apple icon", () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, "public/brand/toolgap-mark.png"))).toBe(true);
    expect(existsSync(path.join(root, "app/favicon.ico"))).toBe(true);
    expect(existsSync(path.join(root, "app/icon.png"))).toBe(true);
    expect(existsSync(path.join(root, "app/apple-icon.png"))).toBe(true);
  });
});

describe("BrandMark", () => {
  it("renders the orange TG mark", () => {
    render(<BrandMark />);
    expect(screen.getByRole("img", { name: "ToolGap" })).toHaveAttribute(
      "src",
      BRAND_MARK_SRC,
    );
  });
});

describe("BrandLogo", () => {
  it("pairs the mark with the ToolGap wordmark", () => {
    render(<BrandLogo />);
    const link = screen.getByRole("link", { name: "ToolGap" });
    expect(link).toHaveAttribute("href", "/");
    expect(link.querySelector("img")).toHaveAttribute("src", BRAND_MARK_SRC);
  });

  it("keeps the dashboard subtitle in the accessible name", () => {
    render(<BrandLogo href="/overview" subtitle="Capability intelligence" />);
    const link = screen.getByRole("link", { name: "ToolGap, Capability intelligence" });
    expect(link).toHaveAttribute("href", "/overview");
    expect(screen.getByText("Capability intelligence")).toBeInTheDocument();
  });
});
