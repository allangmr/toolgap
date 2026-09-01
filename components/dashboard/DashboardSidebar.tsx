"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { WebmcpStatusBadge } from "./WebmcpStatusBadge";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { Button } from "@/components/ui";
import { formatAnalysisStatus } from "@/lib/analysis/status-copy";
import { frictionRepo, journeyRepo } from "@/lib/db/repositories";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/traffic", label: "Traffic" },
  { href: "/gaps", label: "Capability Gaps" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/published", label: "Published" },
  { href: "/settings", label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const analysis = useAnalysisStatus();
  const storedJourneys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const storedSignals = useLiveQuery(() => frictionRepo.all(), []) ?? [];
  const status = formatAnalysisStatus({
    result: analysis.lastResult,
    storedJourneys: storedJourneys.length,
    storedSignals: storedSignals.length,
    error: analysis.error,
  });

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-surface lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:block lg:py-5">
        <Link href="/overview" className="block">
          <p className="font-display text-lg font-medium tracking-tight">ToolGap</p>
          <p className="hidden font-mono text-[10px] uppercase tracking-wider text-muted lg:block">
            Agent Capability Intelligence
          </p>
        </Link>
        <div className="lg:mt-3">
          <WebmcpStatusBadge />
        </div>
      </div>
      <nav aria-label="Dashboard" className="px-2 py-2 lg:flex-1 lg:py-3">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:space-y-0.5 lg:overflow-visible">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={`block rounded-sm px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    active
                      ? "bg-accent-subtle text-accent"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
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
        <div className="mt-2 space-y-0.5 text-xs text-muted" aria-live="polite">
          <p>{status.primary}</p>
          {status.secondary ? <p>{status.secondary}</p> : null}
        </div>
        <Link
          href="/store"
          className="mt-3 block text-center text-xs font-medium text-accent hover:underline"
        >
          Open demo store
        </Link>
      </div>
    </aside>
  );
}
