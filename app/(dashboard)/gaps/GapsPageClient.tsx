"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { gapRepo } from "@/lib/db/repositories";
import { templateForGapType } from "@/lib/recommendations/builder";
import { GapCard } from "@/components/dashboard/GapCard";
import { EmptyState } from "@/components/ui";

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
      return (
        actionable(b.type) - actionable(a.type) ||
        sev[b.severity] - sev[a.severity] ||
        b.confidence - a.confidence
      );
    });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Capability Gaps</h1>
        <p className="text-sm text-muted">
          Evidence that agents need higher-level WebMCP capabilities.
        </p>
      </header>

      <div className="flex gap-2 text-sm">
        {["open", "detected", "published", "resolved", "dismissed", "all"].map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded px-3 py-1 ${
              status === s ? "bg-accent text-white" : "bg-surface-muted"
            }`}
            onClick={() => router.push(`/gaps?status=${s}`)}
          >
            {s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No capability gaps yet"
          description="Gaps appear when enough sessions show inefficient tool patterns. Load sample data from Overview or Settings."
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
