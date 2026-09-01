"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { journeyRepo, sessionRepo } from "@/lib/db/repositories";
import { EmptyState, Pager, StatusBadge, Table, Td, Tr } from "@/components/ui";
import { EvidencePulse } from "@/components/viz/EvidencePulse";
import { formatDuration, formatTimestamp, paginate, parsePage } from "@/lib/shared";

export function SessionsTrafficPanel() {
  const sessions = useLiveQuery(() => sessionRepo.all(), []) ?? [];
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const statusFilter = params.get("status") ?? "all";
  const surfaceFilter = params.get("surface") ?? "all";
  const page = parsePage(params.get("page"));

  const journeyBySession = useMemo(() => {
    const map = new Map(journeys.map((j) => [j.sessionId, j]));
    return map;
  }, [journeys]);

  const filtered = sessions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (surfaceFilter !== "all" && s.surface !== surfaceFilter) return false;
    return true;
  });
  const windowed = paginate(filtered, page);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "sessions");
    if (value === "all" || value === "1") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    const query = next.toString();
    router.push(`/traffic?${query}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Status
          <select
            className="lab-input w-auto"
            value={statusFilter}
            onChange={(e) => setParam("status", e.target.value)}
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
            className="lab-input w-auto"
            value={surfaceFilter}
            onChange={(e) => setParam("surface", e.target.value)}
          >
            <option value="all">All</option>
            <option value="store">Store</option>
            <option value="dashboard">Dashboard</option>
          </select>
        </label>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No agent sessions yet"
          description="Sessions appear when agents call WebMCP tools. Load sample data from Overview, or open the demo store and run the live agent driver from Settings."
          visual={<EvidencePulse filled={0} threshold={3} />}
        />
      ) : (
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
          {windowed.items.map((s) => {
            const journey = journeyBySession.get(s.id);
            const duration = (s.endedAt ?? s.lastActivityAt) - s.startedAt;
            return (
              <Tr key={s.id}>
                <Td>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="font-mono font-medium text-accent hover:underline"
                  >
                    {s.id.slice(0, 8)}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{formatTimestamp(s.startedAt)}</Td>
                <Td className="font-mono text-xs">{formatDuration(duration)}</Td>
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
                    "n/a"
                  )}
                </Td>
                <Td>
                  {journey && journey.frictionScore > 0
                    ? `${journey.frictionScore} wasted calls (est.)`
                    : "n/a"}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}
      <Pager
        page={windowed.page}
        totalPages={windowed.totalPages}
        total={windowed.total}
        noun="sessions"
        onPage={(next) => setParam("page", String(next))}
      />
    </div>
  );
}
