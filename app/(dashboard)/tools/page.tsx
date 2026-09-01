"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toolCallRepo } from "@/lib/db/repositories";
import { computeToolMetrics } from "@/lib/analytics/metrics";
import { storeToolDefinitions } from "@/lib/webmcp/store-tools";
import { StatusBadge, Table, Td, Tr } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { round } from "@/lib/shared";

export default function ToolsPage() {
  const events = useLiveQuery(() => toolCallRepo.storeSurface(), []) ?? [];
  const metrics = computeToolMetrics(
    events,
    storeToolDefinitions.map((t) => t.name),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools"
        description="The interface your application presents to agents on the demo store surface."
      />

      <Table
        caption="Tool performance"
        headers={[
          "Tool",
          "Calls",
          "Success",
          "p50",
          "p95",
          "Sessions",
          "Origin",
          "Version",
        ]}
      >
        {metrics.map((m) => (
          <Tr key={m.toolName}>
            <Td>
              <Link
                href={`/tools/${encodeURIComponent(m.toolName)}`}
                className="font-mono font-medium text-accent hover:underline"
              >
                {m.toolName}
              </Link>
              {m.unused ? <span className="ml-2 text-xs text-muted">unused</span> : null}
            </Td>
            <Td>{m.calls}</Td>
            <Td>{round(m.successRate * 100, 1)}%</Td>
            <Td>{m.p50LatencyMs}ms</Td>
            <Td>{m.p95LatencyMs}ms</Td>
            <Td>{m.uniqueSessions}</Td>
            <Td>
              <StatusBadge status={m.origin === "mixed" ? "dynamic" : m.origin} />
            </Td>
            <Td className="font-mono text-xs">{m.versions.join(", ") || "n/a"}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}
