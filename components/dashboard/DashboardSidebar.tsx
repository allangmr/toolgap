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
  {
    href: "/overview",
    label: "Overview",
    icon: OverviewIcon,
  },
  {
    href: "/traffic",
    label: "Traffic",
    icon: TrafficIcon,
  },
  {
    href: "/gaps",
    label: "Capabilities",
    icon: CapabilitiesIcon,
  },
  {
    href: "/recommendations",
    label: "Recommendations",
    icon: RecommendationsIcon,
  },
  {
    href: "/published",
    label: "Published",
    icon: PublishedIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
  },
] as const;

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
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-[15.5rem] lg:overflow-hidden lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:px-5 lg:pt-6 lg:pb-5">
        <Link href="/overview" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink"
          >
            <BrandMark />
          </span>
          <span>
            <p className="font-sans text-base font-semibold tracking-tight">ToolGap</p>
            <p className="hidden text-[11px] text-muted lg:block">Capability intelligence</p>
          </span>
        </Link>
        <div className="lg:mt-4">
          <WebmcpStatusBadge />
        </div>
      </div>

      <nav aria-label="Dashboard" className="px-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-3">
        <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-accent-subtle text-accent"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 border-t border-border p-3 lg:p-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void analysis.refresh()}
          disabled={analysis.pending}
        >
          {analysis.pending ? "Analyzing…" : "Run analysis"}
        </Button>
        <div className="space-y-0.5 text-xs leading-relaxed text-muted" aria-live="polite">
          <p>{status.primary}</p>
          {status.secondary ? <p>{status.secondary}</p> : null}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted/70 px-3 py-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink"
          >
            TG
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">ToolGap Workspace</p>
            <Link href="/store" className="text-xs text-accent hover:underline">
              Open demo store
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M6.5 5.5h7M10 5.5v9M7.5 14.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TrafficIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 14.5 7.5 8l3 3.5L17 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CapabilitiesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 7.5h12M4 12.5h8M7 4v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RecommendationsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 4.5h10v11H5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.5 8h5M7.5 11h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PublishedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 11.5 8.5 15 15 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 3.5v1.5M10 15v1.5M3.5 10H5M15 10h1.5M5.4 5.4l1.1 1.1M13.5 13.5l1.1 1.1M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
