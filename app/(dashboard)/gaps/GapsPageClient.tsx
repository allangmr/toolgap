"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { gapRepo } from "@/lib/db/repositories";
import { templateForGapType } from "@/lib/recommendations/builder";
import { GapCard } from "@/components/dashboard/GapCard";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EvidencePulse } from "@/components/viz/EvidencePulse";

export default function GapsPageClient() {
  const gaps = useLiveQuery(() => gapRepo.all(), []) ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status") ?? "open";
  const showDismissed = status === "dismissed" || status === "all";

  const visible = gaps
    .filter((g) => {
      if (status === "open") return !["dismissed", "resolved"].includes(g.status);
      if (status === "all") return true;
      return g.status === status;
    })
    .sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      const actionable = (type: (typeof a)["type"]) =>
        templateForGapType(type) === null ? 0 : 1;
      // Gaps whose evidence entirely predates a published capability are
      // workaround residue — rank them below gaps with current evidence.
      const fresh = (g: typeof a) => (g.staleEvidenceCapabilityId ? 0 : 1);
      return (
        fresh(b) - fresh(a) ||
        actionable(b.type) - actionable(a.type) ||
        sev[b.severity] - sev[a.severity] ||
        b.confidence - a.confidence
      );
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capability Gaps"
        description="Evidence that agents need higher-level WebMCP capabilities."
      />

      <div className="flex flex-wrap gap-1 text-sm">
        {["open", "detected", "published", "resolved", "dismissed", "all"].map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded-sm px-3 py-1 ${
              status === s
                ? "bg-accent text-accent-ink"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
            onClick={() => router.push(`/gaps?status=${s}`)}
          >
            {s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No repeated gap signal yet"
          description="ToolGap waits for repeated agent behavior before recommending changes. 3 supporting sessions are required."
          visual={<EvidencePulse filled={0} threshold={3} />}
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((gap) => (
            <Link key={gap.id} href={`/gaps/${gap.id}`}>
              <GapCard gap={gap} />
            </Link>
          ))}
        </div>
      )}

      {!showDismissed && gaps.some((g) => g.status === "dismissed") ? (
        <button
          type="button"
          className="text-sm text-accent hover:underline"
          onClick={() => router.push("/gaps?status=dismissed")}
        >
          Show dismissed gaps
        </button>
      ) : null}
    </div>
  );
}
