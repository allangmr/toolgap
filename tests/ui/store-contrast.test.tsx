import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import StoreCatalogPage from "@/app/(store)/store/page";
import StoreLayout from "@/app/(store)/store/layout";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/dashboard/WebmcpStatusBadge", () => ({
  WebmcpStatusBadge: () => <span>WebMCP native</span>,
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => undefined,
}));

describe("Fieldkit Market contrast", () => {
  it("uses dark text on light surfaces instead of cream ink", async () => {
    render(
      <StoreLayout>
        <StoreCatalogPage />
      </StoreLayout>,
    );

    const catalog = screen.getByRole("link", { name: "Catalog" });
    const cart = screen.getByRole("link", { name: /Cart/ });
    expect(catalog.className).toContain("text-foreground");
    expect(cart.className).toContain("text-foreground");

    const heading = await screen.findByRole("heading", {
      name: "Tools for making, measuring, and moving.",
    });
    expect(heading.className).toContain("text-foreground");

    const search = screen.getByPlaceholderText("headphones, laptop…");
    expect(search.className).toContain("lab-input");
    expect(search.className).not.toContain("text-accent-ink");

    const brandMark = screen.getAllByText("Fieldkit Market")[1];
    expect(brandMark.className).toContain("bg-accent");
    expect(brandMark.className).toContain("text-accent-ink");
    expect(brandMark.className).not.toContain("text-accent ");
  });
});
