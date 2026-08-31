"use client";

import { use } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { journeyRepo, toolCallRepo } from "@/lib/db/repositories";
import { coOccurrence, computeToolMetrics } from "@/lib/analytics/metrics";
import { Card, StatusBadge } from "@/components/ui";
import { round } from "@/lib/shared";

export default function ToolDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const toolName = decodeURIComponent(name);
  const events = useLiveQuery(() => toolCallRepo.storeSurface(), []) ?? [];
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const metrics = computeToolMetrics(events).find((m) => m.toolName === toolName);
  const co = coOccurrence(events, toolName);
  const relatedJourneys = journeys.filter((j) =>
    j.steps.some((s) => s.toolName === toolName),
  );

  if (!metrics) {
    return <p className="text-muted">Tool not found in telemetry.</p>;
  }

  const latencies = events
    .filter((e) => e.toolName === toolName)
    .map((e) => e.durationMs);
  const buckets = bucket(latencies, 5);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tools" className="text-sm text-accent hover:underline">
          ← Tools
        </Link>
        <h1 className="mt-3 font-mono text-3xl font-medium tracking-tight md:text-4xl">
          {toolName}
        </h1>
        <div className="mt-2 flex gap-2">
          <StatusBadge status={metrics.origin === "mixed" ? "dynamic" : metrics.origin} />
          {metrics.unused ? <StatusBadge status="inactive" /> : null}
        </div>
      </div>

      <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Calls
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums">{metrics.calls}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Success
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums">
            {round(metrics.successRate * 100, 1)}%
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            p50 / p95
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums">
            {metrics.p50LatencyMs} / {metrics.p95LatencyMs}ms
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Sessions
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums">
            {metrics.uniqueSessions}
          </p>
        </div>
      </div>

      <Card as="section">
        <h2 className="font-display text-lg font-medium">Latency distribution</h2>
        <svg
          role="img"
          aria-label={`Latency histogram for ${toolName}`}
          viewBox="0 0 320 80"
          className="mt-3 h-20 w-full text-accent"
        >
          {buckets.map((b, i) => {
            const max = Math.max(...buckets.map((x) => x.count), 1);
            const h = (b.count / max) * 60;
            return (
              <rect
                key={i}
                x={i * 64 + 8}
                y={70 - h}
                width={48}
                height={h}
                fill="currentColor"
              />
            );
          })}
        </svg>
        <table className="mt-2 w-full text-left text-xs text-muted">
          <caption className="sr-only">Latency bucket counts</caption>
          <thead>
            <tr>
              <th scope="col">Range</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td>{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card as="section">
        <h2 className="font-display text-lg font-medium">Error distribution</h2>
        <ul className="mt-2 text-sm">
          {Object.entries(metrics.errorDistribution).length === 0 ? (
            <li className="text-muted">No errors recorded.</li>
          ) : (
            Object.entries(metrics.errorDistribution).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card as="section">
        <h2 className="font-display text-lg font-medium">Commonly used with</h2>
        <ul className="mt-2 text-sm">
          {co.slice(0, 8).map((c) => (
            <li key={c.tool}>
              {c.tool} ({c.count} sessions)
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section">
        <h2 className="font-display text-lg font-medium">Related journeys</h2>
        <p className="mt-1 text-sm text-muted">
          {relatedJourneys.length} journeys include this tool.
        </p>
      </Card>
    </div>
  );
}

function bucket(values: number[], n: number): Array<{ label: string; count: number }> {
  if (values.length === 0) return [{ label: "n/a", count: 0 }];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = Math.max(1, (max - min) / n);
  const buckets = Array.from({ length: n }, (_, i) => ({
    label: `${Math.round(min + i * width)}-${Math.round(min + (i + 1) * width)}ms`,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(n - 1, Math.floor((v - min) / width));
    buckets[idx]!.count += 1;
  }
  return buckets;
}
