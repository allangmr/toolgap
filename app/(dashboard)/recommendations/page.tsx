"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { recommendationRepo } from "@/lib/db/repositories";
import { Badge, EmptyState, StatusBadge, Table, Td, Tr } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { workflowStepForRecommendationStatus } from "@/lib/gaps/workflow-steps";
import { formatTimestamp } from "@/lib/shared";

export default function RecommendationsPage() {
  const recommendations = useLiveQuery(() => recommendationRepo.all(), []) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommendations"
        description="Cross-gap index of capability proposals. Open a gap to continue the workflow (evidence through publish)."
      />

      {recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          description="Open a capability gap with a publishable template and click Build recommendation."
        />
      ) : (
        <Table
          caption="Recommendations"
          headers={["Tool", "Template", "Status", "Created by", "Updated", "Gap"]}
        >
          {recommendations.map((r) => {
            const step = workflowStepForRecommendationStatus(r.status);
            return (
            <Tr key={r.id}>
              <Td className="font-mono">{r.proposedToolName}</Td>
              <Td>{r.templateType}</Td>
              <Td>
                <StatusBadge status={r.status} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={r.createdBy === "agent" ? "info" : "neutral"}>
                    {r.createdBy}
                  </Badge>
                  {r.lastEditedBy && r.lastEditedBy !== r.createdBy ? (
                    <Badge tone="neutral" dashed>
                      edited by {r.lastEditedBy}
                    </Badge>
                  ) : null}
                </div>
              </Td>
              <Td className="font-mono text-xs">{formatTimestamp(r.updatedAt)}</Td>
              <Td>
                <Link
                  href={`/gaps/${r.gapId}?step=${step}`}
                  className="text-accent hover:underline"
                >
                  Continue workflow
                </Link>
              </Td>
            </Tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
