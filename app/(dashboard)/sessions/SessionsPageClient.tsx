"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { journeyRepo, sessionRepo } from "@/lib/db/repositories";
import { StatusBadge, Table, Td, Tr } from "@/components/ui";
import { formatDuration, formatTimestamp } from "@/lib/shared";

export default function SessionsPageClient() {
  const sessions = useLiveQuery(() => sessionRepo.all(), []) ?? [];
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const statusFilter = params.get("status") ?? "all";
  const surfaceFilter = params.get("surface") ?? "all";

  const journeyBySession = useMemo(() => {
    const map = new Map(journeys.map((j) => [j.sessionId, j]));
    return map;
  }, [journeys]);

  const filtered = sessions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (surfaceFilter !== "all" && s.surface !== surfaceFilter) return false;
    return true;
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/sessions?${next.toString()}`);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Agent Sessions</h1>
        <p className="text-sm text-muted">Observed WebMCP call sessions.</p>
      </header>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Status
          <select
            className="rounded border border-border bg-surface px-2 py-1"
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Surface
          <select
            className="rounded border border-border bg-surface px-2 py-1"
            value={surfaceFilter}
            onChange={(e) => setFilter("surface", e.target.value)}
          >
            <option value="all">All</option>
            <option value="store">Store</option>
            <option value="dashboard">Dashboard</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table
          caption="Agent sessions"
          headers={[
            "Session",
            "Start",
            "Duration",
            "Calls",
            "Status",
            "Intent (inferred)",
            "Friction",
          ]}
        >
          {filtered.map((s) => {
            const journey = journeyBySession.get(s.id);
            const duration = (s.endedAt ?? s.lastActivityAt) - s.startedAt;
            return (
              <Tr key={s.id}>
                <Td>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {s.id.slice(0, 8)}
                  </Link>
                </Td>
                <Td>{formatTimestamp(s.startedAt)}</Td>
                <Td>{formatDuration(duration)}</Td>
                <Td>{s.callCount}</Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>
                  {journey ? (
                    <span className="inline-flex items-center gap-1">
                      {journey.inferredIntent}
                      <StatusBadge status="inferred" />
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  {journey && journey.frictionScore > 0
                    ? `${journey.frictionScore} wasted calls (est.)`
                    : "—"}
                </Td>
              </Tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
