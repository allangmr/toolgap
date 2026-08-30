"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WebmcpStatusBadge } from "./WebmcpStatusBadge";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { Button } from "@/components/ui";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/sessions", label: "Sessions" },
  { href: "/journeys", label: "Journeys" },
  { href: "/tools", label: "Tools" },
  { href: "/gaps", label: "Capability Gaps" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/published", label: "Published" },
  { href: "/settings", label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const analysis = useAnalysisStatus();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-4">
        <Link href="/overview" className="block">
          <p className="text-lg font-semibold tracking-tight text-accent">ToolGap</p>
          <p className="text-xs text-muted">Agent Capability Intelligence</p>
        </Link>
        <div className="mt-3">
          <WebmcpStatusBadge />
        </div>
      </div>
      <nav aria-label="Dashboard" className="flex-1 px-2 py-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-accent-subtle text-accent"
                      : "text-foreground hover:bg-surface-muted"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void analysis.refresh()}
          disabled={analysis.pending}
        >
          {analysis.pending ? "Analyzing…" : "Run analysis"}
        </Button>
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {analysis.error
            ? `Error: ${analysis.error}`
            : analysis.lastResult
              ? `Last run: ${analysis.lastResult.journeysBuilt} journeys, ${analysis.lastResult.signalsCreated} signals`
              : "No analysis yet"}
        </p>
        <Link
          href="/store"
          className="mt-3 block text-center text-xs font-medium text-accent hover:underline"
        >
          Open demo store →
        </Link>
      </div>
    </aside>
  );
}
