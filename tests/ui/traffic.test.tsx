import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrafficPageClient from "@/components/dashboard/traffic/TrafficPageClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=sessions"),
  usePathname: () => "/traffic",
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [],
}));

describe("TrafficPageClient", () => {
  it("renders traffic tabs and sessions panel by default", () => {
    render(<TrafficPageClient />);
    expect(screen.getByRole("heading", { name: "Traffic" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Journeys" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByText("No agent sessions yet")).toBeInTheDocument();
  });
});
