"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { recommendationRepo } from "@/lib/db/repositories";
import { Badge, EmptyState, StatusBadge, Table, Td, Tr } from "@/components/ui";
import { formatTimestamp } from "@/lib/shared";

export default function RecommendationsPage() {
  const recommendations = useLiveQuery(() => recommendationRepo.all(), []) ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Recommendations</h1>
        <p className="text-sm text-muted">Structured capability proposals derived from gaps.</p>
      </header>

      {recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          description="Open a capability gap with a publishable template and click Build recommendation."
        />
      ) : (
      <div className="rounded-lg border border-border bg-surface">
        <Table
          caption="Recommendations"
          headers={["Tool", "Template", "Status", "Created by", "Updated", "Gap"]}
        >
          {recommendations.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono">{r.proposedToolName}</Td>
              <Td>{r.templateType}</Td>
              <Td>
                <StatusBadge status={r.status} />
              </Td>
              <Td>
                <Badge tone={r.createdBy === "agent" ? "info" : "neutral"}>
                  {r.createdBy}
                </Badge>
              </Td>
              <Td>{formatTimestamp(r.updatedAt)}</Td>
              <Td>
                <Link href={`/gaps/${r.gapId}`} className="text-accent hover:underline">
                  Open gap
                </Link>
              </Td>
            </Tr>
          ))}
        </Table>
      </div>
      )}
    </div>
  );
}
