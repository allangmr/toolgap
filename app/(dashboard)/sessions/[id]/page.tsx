"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  frictionRepo,
  journeyRepo,
  sessionRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { StatusBadge } from "@/components/ui";
import { TraceSpine } from "@/components/viz/TraceSpine";
import { formatTimestamp } from "@/lib/shared";
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
    <div className="space-y-8">
      <div>
        <Link href="/sessions" className="text-sm text-accent hover:underline">
          ← Sessions
        </Link>
        <h1 className="mt-3 font-mono text-3xl font-medium tracking-tight md:text-4xl">
          Session {session.id.slice(0, 8)}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusBadge status={session.status} />
          <span className="font-mono text-xs">{formatTimestamp(session.startedAt)}</span>
          <span className="font-mono text-xs">{session.callCount} calls</span>
          <span className="font-mono text-xs">{session.surface}</span>
          {journey ? (
            <span className="inline-flex items-center gap-1">
              Intent: {journey.inferredIntent} <StatusBadge status="inferred" />
            </span>
          ) : null}
          {journey ? <StatusBadge status={journey.state} /> : null}
        </div>
      </div>

      <TraceSpine calls={calls} signals={signals} />
    </div>
  );
}
