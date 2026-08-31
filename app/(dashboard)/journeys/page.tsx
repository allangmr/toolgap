"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { journeyRepo } from "@/lib/db/repositories";
import { groupJourneyPatterns, formatCompletionRate } from "@/lib/journeys/reconstruct";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { formatDuration, round } from "@/lib/shared";
import { JourneySignature } from "@/components/dashboard/JourneySignature";

export default function JourneysPage() {
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const patterns = groupJourneyPatterns(journeys);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Journeys</h1>
        <p className="text-sm text-muted">Common tool-call patterns reconstructed from sessions.</p>
      </header>

      <div className="space-y-3">
        {patterns.map((pattern) => {
          const patternJourneys = journeys.filter((j) =>
            pattern.journeyIds.includes(j.id),
          );
          return (
          <Card key={pattern.signature} as="article">
            <JourneySignature signature={pattern.signature} />
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
              <span>{pattern.journeyCount} journeys</span>
              <span>avg {round(pattern.avgCalls, 1)} calls</span>
              <span>{formatDuration(pattern.avgDurationMs)}</span>
              <span>Task completion: {formatCompletionRate(patternJourneys)}</span>
              <span className="inline-flex items-center gap-1">
                {pattern.inferredIntent} <StatusBadge status="inferred" />
              </span>
              {pattern.avgCalls >= 5 ? <Badge tone="warning">high call count</Badge> : null}
            </div>
          </Card>
          );
        })}
        {patterns.length === 0 ? (
          <p className="text-sm text-muted">No journeys yet. Load sample data or drive the demo store.</p>
        ) : null}
      </div>
    </div>
  );
}
