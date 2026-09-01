"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { journeyRepo } from "@/lib/db/repositories";
import {
  formatCompletionRate,
  groupJourneyPatterns,
} from "@/lib/journeys/reconstruct";
import { Badge, StatusBadge } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { JourneySignature } from "@/components/dashboard/JourneySignature";
import { formatDuration, round } from "@/lib/shared";

export default function JourneysPage() {
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const patterns = groupJourneyPatterns(journeys);
  const bySignature = new Map<string, typeof journeys>();
  for (const journey of journeys) {
    const list = bySignature.get(journey.signature) ?? [];
    list.push(journey);
    bySignature.set(journey.signature, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journeys"
        description="Common tool-call patterns reconstructed from sessions."
      />

      <div className="divide-y divide-border border-y border-border">
        {patterns.map((pattern) => {
          const group = bySignature.get(pattern.signature) ?? [];
          const provisional = group.some((j) => j.state === "provisional");
          return (
            <article key={pattern.signature} className="py-5">
              <JourneySignature signature={pattern.signature} />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                <span className="font-mono text-xs">
                  {pattern.journeyCount} journeys
                </span>
                <span className="font-mono text-xs">
                  avg {round(pattern.avgCalls, 1)} calls
                </span>
                <span className="font-mono text-xs">
                  {formatDuration(pattern.avgDurationMs)}
                </span>
                <span className="font-mono text-xs">
                  Task completion: {formatCompletionRate(group)}
                </span>
                <span className="inline-flex items-center gap-1">
                  {pattern.inferredIntent} <StatusBadge status="inferred" />
                </span>
                {provisional ? <StatusBadge status="provisional" /> : null}
                {pattern.avgCalls >= 5 ? (
                  <Badge tone="warning">high call count</Badge>
                ) : null}
              </div>
            </article>
          );
        })}
        {patterns.length === 0 ? (
          <p className="py-8 text-sm text-muted">
            No journeys yet. Load sample data or drive the demo store.
          </p>
        ) : null}
      </div>
    </div>
  );
}
