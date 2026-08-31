"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  gapRepo,
  journeyRepo,
  publishedRepo,
  sessionRepo,
  settingsRepo,
} from "@/lib/db/repositories";
import { Button, Card, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { useState } from "react";
import { round } from "@/lib/shared";
import { sparklineValues } from "@/lib/analytics/sparkline";
import { isSettled, isCompletionMeasurable } from "@/lib/journeys/reconstruct";

export default function OverviewPage() {
  const sessions = useLiveQuery(() => sessionRepo.all(), []) ?? [];
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const gaps = useLiveQuery(() => gapRepo.all(), []) ?? [];
  const published = useLiveQuery(() => publishedRepo.all(), []) ?? [];
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const analysis = useAnalysisStatus();
  const [seeding, setSeeding] = useState(false);

  const openGaps = gaps.filter(
    (g) => !["dismissed", "resolved"].includes(g.status),
  );
  const topGap = [...openGaps].sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return sev[b.severity] - sev[a.severity] || b.confidence - a.confidence;
  })[0];

  const settledJourneys = journeys.filter(isSettled);
  const measurableCompletions = isCompletionMeasurable(settledJourneys);
  const completed = settledJourneys.filter((j) => j.outcome === "completed").length;
  const frictionRate =
    journeys.length === 0
      ? 0
      : journeys.filter((j) => j.frictionScore > 0).length / journeys.length;

  const isEmpty = sessions.length === 0;
  const sessionSpark = sparklineValues(
    sessions.map((s) => ({ at: s.startedAt, value: s.callCount })),
  );
  const completedSpark = sparklineValues(
    settledJourneys.map((j) => ({
      at: j.startedAt,
      value: j.outcome === "completed" ? 1 : 0,
    })),
  );
  const frictionSpark = sparklineValues(
    journeys.map((j) => ({
      at: j.startedAt,
      value: j.frictionScore > 0 ? 1 : 0,
    })),
  );

  async function loadSeed() {
    setSeeding(true);
    try {
      await seedAllScenarios();
      await analysis.refresh();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          Actionable intelligence from observed WebMCP agent behavior.
        </p>
      </header>

      {isEmpty ? (
        <EmptyState
          title="No agent activity yet"
          description="Load sample journeys through the live store tools, or open the demo store and drive WebMCP tools to start detecting capability gaps."
          actions={
            <>
              <Button onClick={() => void loadSeed()} disabled={seeding}>
                {seeding ? "Loading…" : "Load sample data"}
              </Button>
              <Link href="/store">
                <Button variant="secondary">Open demo store</Button>
              </Link>
            </>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Agent sessions"
              value={sessions.length}
              sparkline={sessionSpark}
            />
            <Stat
              label="Task completions"
              value={measurableCompletions ? completed : "Not measured"}
              hint={
                measurableCompletions
                  ? `${settledJourneys.length} settled with explicit signal`
                  : `${settledJourneys.length} settled · no explicit task-completion signal`
              }
              sparkline={completedSpark}
            />
            <Stat
              label="Friction rate"
              value={`${round(frictionRate * 100, 1)}%`}
              hint="Calculated from journeys with friction signals"
              sparkline={frictionSpark}
            />
            <Stat label="Open gaps" value={openGaps.length} />
            <Stat
              label="Published improvements"
              value={published.filter((p) => p.status === "active").length}
            />
          </div>

          {topGap ? (
            <Card as="section" className="border-accent/30 bg-accent-subtle/40">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                Most important gap
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{topGap.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Inferred intent: {topGap.detectedIntent} · {topGap.affectedSessions}{" "}
                    sessions · confidence {round(topGap.confidence, 2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={topGap.severity} />
                  <StatusBadge status={topGap.status} />
                  <Link href={`/gaps/${topGap.id}`}>
                    <Button>Investigate</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Recent activity
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {sessions.slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <Link href={`/sessions/${s.id}`} className="font-medium hover:underline">
                      Session {s.id.slice(0, 8)}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.callCount} calls · {s.surface}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          </section>

          {!settings?.seededAt ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadSeed()} disabled={seeding}>
                Load additional sample data
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
