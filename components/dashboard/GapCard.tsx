import type { CapabilityGap } from "@/lib/shared/types";
import { Card, StatusBadge } from "@/components/ui";
import { round } from "@/lib/shared";

export function GapCard({ gap }: { gap: CapabilityGap }) {
  return (
    <Card as="article" className="transition-colors hover:border-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{gap.title}</h2>
          <p className="mt-1 text-sm text-muted">
            Inferred intent: {gap.detectedIntent} · type {gap.type}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={gap.severity} />
          <StatusBadge status={gap.status} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted">Confidence</p>
          <p className="font-medium tabular-nums">{round(gap.confidence, 2)}</p>
          <div
            className="mt-1 h-1.5 rounded bg-surface-muted"
            role="meter"
            aria-label="Confidence"
            aria-valuenow={Math.round(gap.confidence * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded bg-accent"
              style={{ width: `${gap.confidence * 100}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted">Affected sessions</p>
          <p className="font-medium">{gap.affectedSessions}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Of relevant journeys</p>
          <p className="font-medium">
            {round(gap.percentageOfRelevantJourneys * 100, 1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Avg calls (current)</p>
          <p className="font-medium">{gap.currentAvgCallCount}</p>
        </div>
      </div>
    </Card>
  );
}
