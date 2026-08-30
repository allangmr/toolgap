import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { resetDbForTests } from "@/lib/db/schema";
import { gapRepo } from "@/lib/db/repositories";
import { AnalysisStatusProvider } from "@/components/providers/AnalysisStatusProvider";
import GapDetailClient from "@/app/(dashboard)/gaps/[id]/GapDetailClient";
import type { CapabilityGap } from "@/lib/shared/types";

vi.mock("@/components/providers/AnalysisStatusProvider", () => ({
  AnalysisStatusProvider: ({ children }: { children: ReactNode }) => children,
  useAnalysisStatus: () => ({
    lastResult: null,
    pending: false,
    error: null,
    refresh: async () => undefined,
  }),
}));

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

function stubGap(type: CapabilityGap["type"]): CapabilityGap {
  return {
    id: `gap-${type}`,
    title:
      type === "FILTER"
        ? "Search results may lack fields agents need"
        : "Agents retry the same failing tool",
    type,
    entityType: "product",
    detectedIntent: "lookup",
    status: "detected",
    confidence: 0.8,
    severity: "high",
    supportingSessionIds: ["s1", "s2", "s3"],
    affectedSessions: 3,
    percentageOfRelevantJourneys: 0.4,
    currentAvgCallCount: 5,
    currentCompletionRate: 0,
    signalIds: [],
    mergeKey: `${type}:product:get_product`,
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [{ status: "detected", at: 1, by: "system" }],
  };
}

describe("observational gap types", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
  });

  it("hides Build recommendation for FILTER gaps", async () => {
    await gapRepo.put(stubGap("FILTER"));
    render(
      <AnalysisStatusProvider>
        <GapDetailClient id="gap-FILTER" />
      </AnalysisStatusProvider>,
    );
    expect(
      await screen.findByText(/No publishable template for FILTER/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Build recommendation" }),
    ).not.toBeInTheDocument();
  });

  it("hides Build recommendation for FAILURE_LOOP gaps", async () => {
    await gapRepo.put(stubGap("FAILURE_LOOP"));
    render(
      <AnalysisStatusProvider>
        <GapDetailClient id="gap-FAILURE_LOOP" />
      </AnalysisStatusProvider>,
    );
    expect(
      await screen.findByText(/No publishable template for FAILURE_LOOP/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Build recommendation" }),
    ).not.toBeInTheDocument();
  });
});
