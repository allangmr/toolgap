import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { resetDbForTests } from "@/lib/db/schema";
import {
  gapRepo,
  journeyRepo,
  publishedRepo,
  settingsRepo,
} from "@/lib/db/repositories";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { AnalysisStatusProvider } from "@/components/providers/AnalysisStatusProvider";
import GapDetailClient from "@/app/(dashboard)/gaps/[id]/GapDetailClient";
import PublishedPage from "@/app/(dashboard)/published/page";
import type { Journey } from "@/lib/shared/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/gaps/test",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
}

function journeyStub(id: string, sessionId: string, startedAt: number): Journey {
  return {
    id,
    sessionId,
    steps: [],
    signature: "search_products>get_product×3",
    startedAt,
    endedAt: startedAt + 50,
    durationMs: 50,
    callCount: 4,
    outcome: "abandoned",
    inferredIntent: "comparison",
    frictionScore: 2,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
  };
}

describe("critical UI flows", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
  });

  it("walks seed gap recommendation simulate approve publish to resolved", async () => {
    const user = userEvent.setup();
    await seedAllScenarios();
    await runAnalysis();
    const gap = (await gapRepo.all()).find((g) => g.type === "COMPARE");
    expect(gap).toBeDefined();

    render(
      <AnalysisStatusProvider>
        <GapDetailClient id={gap!.id} />
      </AnalysisStatusProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Build recommendation" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Build recommendation" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Simulate" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Simulate" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish…" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Publish…" }));
    await user.click(screen.getByRole("button", { name: "Confirm publish" }));

    await waitFor(async () => {
      const updated = await gapRepo.get(gap!.id);
      expect(updated?.status).toBe("resolved");
    });
    await waitFor(() => {
      expect(screen.getByText("Resolved")).toBeInTheDocument();
    });
    const caps = await publishedRepo.active();
    expect(caps.some((c) => c.toolName === "compare_products")).toBe(true);
  });

  it("shows insufficient evidence when before/after n is below 5", async () => {
    const user = userEvent.setup();
    await settingsRepo.get();
    await publishedRepo.put({
      id: "cap-measure",
      recommendationId: "rec-measure",
      toolName: "compare_products",
      templateType: "COMPARE",
      config: {},
      version: 1,
      status: "active",
      publishedAt: 1_000,
      schemaJson: {},
    });
    await journeyRepo.putMany([
      journeyStub("j1", "s1", 100),
      journeyStub("j2", "s2", 200),
      journeyStub("j3", "s3", 2_000),
    ]);

    render(
      <AnalysisStatusProvider>
        <PublishedPage />
      </AnalysisStatusProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Compute before/after" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Compute before/after" }));
    await waitFor(() => {
      expect(screen.getByText(/Insufficient data/)).toBeInTheDocument();
      expect(screen.getByText(/Before n=2/)).toBeInTheDocument();
      expect(screen.getByText(/after n=1/)).toBeInTheDocument();
    });
  });
});
