import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { resetDbForTests } from "@/lib/db/schema";
import { journeyRepo, sessionRepo, settingsRepo } from "@/lib/db/repositories";
import SessionsPageClient from "@/app/(dashboard)/sessions/SessionsPageClient";
import OverviewPage from "@/app/(dashboard)/overview/page";
import SettingsPage from "@/app/(dashboard)/settings/page";
import type { AgentSession, Journey } from "@/lib/shared/types";

vi.mock("@/components/providers/AnalysisStatusProvider", () => ({
  AnalysisStatusProvider: ({ children }: { children: ReactNode }) => children,
  useAnalysisStatus: () => ({
    lastResult: null,
    pending: false,
    error: null,
    refresh: async () => undefined,
  }),
}));

const pushed: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      pushed.push(href);
    },
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/sessions",
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

function sessionStub(i: number): AgentSession {
  return {
    id: `session-${i}`,
    surface: "store",
    startedAt: 1_000 + i,
    lastActivityAt: 1_100 + i,
    endedAt: 1_100 + i,
    status: "expired",
    callCount: i + 1,
    tabId: "tab",
  };
}

function journeyStub(i: number): Journey {
  return {
    id: `j-${i}`,
    sessionId: `session-${i}`,
    steps: [],
    signature: "search_products>get_product",
    startedAt: 1_000 + i,
    endedAt: 1_100 + i,
    durationMs: 100,
    callCount: i + 1,
    state: "final",
    lastEventSeq: i + 1,
    outcome: i % 2 === 0 ? "completed" : "abandoned",
    inferredIntent: "lookup",
    frictionScore: i % 2,
    repeatedToolCounts: {},
    distinctEntityCounts: {},
  };
}

describe("Cut 4 dashboard polish", () => {
  afterEach(() => {
    cleanup();
    pushed.length = 0;
  });

  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
  });

  it("paginates sessions and keeps the page in the URL", async () => {
    const user = userEvent.setup();
    await sessionRepo.putMany(Array.from({ length: 12 }, (_, i) => sessionStub(i)));
    render(<SessionsPageClient />);
    expect(await screen.findByText("12 sessions · page 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(pushed.at(-1)).toBe("/sessions?page=2");
  });

  it("renders overview sparklines from session history", async () => {
    await sessionRepo.putMany(Array.from({ length: 3 }, (_, i) => sessionStub(i)));
    await journeyRepo.putMany(Array.from({ length: 3 }, (_, i) => journeyStub(i)));
    render(<OverviewPage />);
    expect(
      await screen.findByRole("img", { name: /Agent sessions: 3 points/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Task completions: 3 points/ })).toBeInTheDocument();
  });

  it("saves an edited inactivity timeout", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const input = await screen.findByLabelText("Inactivity timeout in seconds");
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "90" } });
    await user.click(screen.getByRole("button", { name: "Save timeout" }));
    expect(await screen.findByText("Inactivity timeout set to 90s.")).toBeInTheDocument();
    const settings = await settingsRepo.get();
    expect(settings.inactivityTimeoutMs).toBe(90_000);
  });
});
