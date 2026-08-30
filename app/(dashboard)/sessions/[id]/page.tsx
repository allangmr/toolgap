"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  frictionRepo,
  journeyRepo,
  sessionRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { Badge, StatusBadge, Timeline, TimelineItem } from "@/components/ui";
import { formatDuration, formatTimestamp } from "@/lib/shared";
import Link from "next/link";

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const session = useLiveQuery(() => sessionRepo.get(id), [id]);
  const calls = useLiveQuery(() => toolCallRepo.bySession(id), [id]) ?? [];
  const journey = useLiveQuery(() => journeyRepo.bySession(id), [id]);
  const signals =
    useLiveQuery(
      async () => (journey ? frictionRepo.byJourney(journey.id) : []),
      [journey?.id],
    ) ?? [];

  if (!session) {
    return <p className="text-muted">Session not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sessions" className="text-sm text-accent hover:underline">
          ← Sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Session {session.id.slice(0, 8)}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
          <StatusBadge status={session.status} />
          <span>{formatTimestamp(session.startedAt)}</span>
          <span>{session.callCount} calls</span>
          <span>{session.surface}</span>
          {journey ? (
            <span className="inline-flex items-center gap-1">
              Intent: {journey.inferredIntent} <StatusBadge status="inferred" />
            </span>
          ) : null}
        </div>
      </div>

      <Timeline label="Tool call timeline">
        {calls.map((call) => {
          const related = signals.filter((s) =>
            s.involvedTools.includes(call.toolName),
          );
          return (
            <TimelineItem
              key={call.id}
              title={call.toolName}
              meta={`${formatDuration(call.durationMs)} · seq ${call.sequenceIndex}`}
              tone={call.success ? "success" : "danger"}
            >
              <div className="space-y-1">
                <StatusBadge status={call.success ? "completed" : "failed"} />
                {call.origin === "dynamic" ? <Badge tone="accent">dynamic</Badge> : null}
                {call.entityIds?.length ? (
                  <p>Entities: {call.entityIds.join(", ")}</p>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-accent">Parameters</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-2 text-xs">
                    {JSON.stringify(call.input, null, 2)}
                  </pre>
                </details>
                {related.map((sig) => (
                  <Badge key={sig.id} tone="warning">
                    {sig.type} · confidence {sig.confidence.toFixed(2)}
                  </Badge>
                ))}
              </div>
            </TimelineItem>
          );
        })}
      </Timeline>
    </div>
  );
}
