import type { CapabilityGap } from "@/lib/shared/types";
import { templateForGapType } from "@/lib/recommendations/builder";
import { Badge, StatusBadge } from "@/components/ui";
import { ConfidenceBand } from "@/components/viz/ConfidenceBand";
import { EvidencePulse } from "@/components/viz/EvidencePulse";
import { round } from "@/lib/shared";

export function GapCard({ gap }: { gap: CapabilityGap }) {
  const observational = templateForGapType(gap.type) === null;
  return (
    <article className="border border-border bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium">{gap.title}</h2>
          <p className="mt-1 text-sm text-muted">
            Inferred intent: {gap.detectedIntent} · type {gap.type}
          </p>
        </div>
        <div className="flex gap-2">
          {observational ? <Badge tone="neutral">Observational</Badge> : null}
          <StatusBadge status={gap.severity} />
          <StatusBadge status={gap.status} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ConfidenceBand value={gap.confidence} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Affected sessions
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums">
            {gap.affectedSessions}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Of relevant journeys
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums">
            {round(gap.percentageOfRelevantJourneys * 100, 1)}%
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Avg calls (current)
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums">
            {gap.currentAvgCallCount}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <EvidencePulse filled={gap.supportingSessionIds.length} threshold={3} />
      </div>
    </article>
  );
}
