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
import { Button, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EvidencePulse } from "@/components/viz/EvidencePulse";
import { ConfidenceBand } from "@/components/viz/ConfidenceBand";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { useState } from "react";
import { round } from "@/lib/shared";
import { sparklineValues } from "@/lib/analytics/sparkline";
import {
  isCompletionMeasurable,
  isSettled,
} from "@/lib/journeys/reconstruct";

export default function OverviewPage() {
  const sessions = useLiveQuery(() => sessionRepo.all(), []) ?? [];
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const gaps = useLiveQuery(() => gapRepo.all(), []) ?? [];
  const published = useLiveQuery(() => publishedRepo.all(), []) ?? [];
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const analysis = useAnalysisStatus();
  const [seeding, setSeeding] = useState(false);

  const openGaps = gaps.filter((g) => !["dismissed", "resolved"].includes(g.status));
  const topGap = [...openGaps].sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return sev[b.severity] - sev[a.severity] || b.confidence - a.confidence;
  })[0];

  const settledJourneys = journeys.filter(isSettled);
  const measurableCompletions = isCompletionMeasurable(settledJourneys);
  const completed = settledJourneys.filter((j) => j.outcome === "completed").length;
  const frictionJourneys = journeys.filter((j) => j.frictionScore > 0);
  const frictionRate =
    journeys.length === 0 ? 0 : frictionJourneys.length / journeys.length;
  const efficientCount = journeys.length - frictionJourneys.length;

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
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="What agents are doing, where friction lives, and what to publish next."
      />

      {isEmpty ? (
        <EmptyState
          title="No agent activity yet"
          description="Load sample journeys through the live store tools, or open the demo store and drive WebMCP tools to start detecting capability gaps."
          visual={<EvidencePulse filled={0} threshold={3} />}
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
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Current agent state
              </p>
              <p className="mt-3 font-display text-6xl font-medium tracking-tight tabular-nums md:text-7xl">
                {sessions.length}
              </p>
              <p className="mt-1 text-sm text-muted">sessions observed</p>
              <div className="mt-8 grid grid-cols-2 gap-8 border-t border-border pt-6">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Efficient
                  </p>
                  <p className="mt-1 font-display text-3xl tabular-nums">
                    {efficientCount}
                  </p>
                  <p className="text-xs text-muted">journeys without friction</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Friction
                  </p>
                  <p className="mt-1 font-display text-3xl tabular-nums text-warning">
                    {frictionJourneys.length}
                  </p>
                  <p className="text-xs text-muted">
                    {round(frictionRate * 100, 1)}% of journeys
                  </p>
                </div>
              </div>
              <p className="mt-6 font-mono text-xs text-muted">
                {openGaps.length} open capability gap{openGaps.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid gap-6 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
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
              <Stat
                label="Published improvements"
                value={published.filter((p) => p.status === "active").length}
              />
            </div>
          </section>

          {topGap ? (
            <section className="border border-accent/35 bg-accent-subtle/30 p-5 md:p-7">
              <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
                Highest opportunity
              </p>
              <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(14rem,0.7fr)]">
                <div>
                  <h2 className="font-display text-3xl font-medium tracking-tight">
                    {topGap.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Inferred intent: {topGap.detectedIntent}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={topGap.severity} />
                    <StatusBadge status={topGap.status} />
                    <Link href={`/gaps/${topGap.id}`}>
                      <Button>Investigate</Button>
                    </Link>
                  </div>
                </div>
                <div className="space-y-4">
                  <EvidencePulse
                    filled={topGap.supportingSessionIds.length}
                    threshold={3}
                  />
                  <ConfidenceBand value={topGap.confidence} />
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-lg font-medium">Recent activity</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {sessions.slice(0, 10).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="font-mono font-medium hover:text-accent"
                    >
                      Session {s.id.slice(0, 8)}
                    </Link>
                    <p className="font-mono text-[11px] text-muted">
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
              <Button
                variant="secondary"
                onClick={() => void loadSeed()}
                disabled={seeding}
              >
                Load additional sample data
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
