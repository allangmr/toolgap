"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  metricRepo,
  publishedRepo,
  journeyRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { Button, Dialog, StatusBadge } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DeltaFigure } from "@/components/viz/DeltaFigure";
import { deactivateCapability } from "@/lib/publishing/publish";
import { computeBeforeAfter } from "@/lib/measurement/before-after";
import { seedPostPublishTraffic } from "@/lib/seed/scenarios";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { formatTimestamp, round } from "@/lib/shared";
import { getRegistry } from "@/lib/webmcp/registry";

export default function PublishedPage() {
  const capabilities = useLiveQuery(() => publishedRepo.all(), []) ?? [];
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const analysis = useAnalysisStatus();

  async function onDeactivate(id: string) {
    await deactivateCapability(id);
    setConfirmId(null);
    setMessage("Capability deactivated and unregistered.");
  }

  async function onMeasure(id: string) {
    const cap = await publishedRepo.get(id);
    if (!cap) return;
    const [allJourneys, allEvents] = await Promise.all([
      journeyRepo.all(),
      toolCallRepo.storeSurface(),
    ]);
    const snapshot = computeBeforeAfter({
      capability: cap,
      journeys: allJourneys,
      events: allEvents,
      intent: "comparison",
    });
    await metricRepo.put(snapshot);
    setMessage(
      snapshot.sufficientData
        ? "Before/after snapshot updated."
        : "Snapshot saved - insufficient sample size for firm conclusions.",
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Published Capabilities"
        description="Dynamically registered WebMCP tools from approved recommendations."
      />

      <p className="text-sm text-muted" aria-live="polite">
        {message}
      </p>

      {capabilities.some((c) => c.status === "active") ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const active = capabilities.find((c) => c.status === "active");
            if (!active) return;
            setBusy(true);
            void seedPostPublishTraffic(active.id)
              .then(() => analysis.refresh())
              .then(() => setMessage("Post-publish traffic loaded."))
              .catch((e) => setMessage(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        >
          Load post-publish traffic
        </Button>
      ) : null}

      <div className="grid gap-3">
        {capabilities.map((cap) => (
          <PublishedCard
            key={cap.id}
            capId={cap.id}
            onDeactivate={() => setConfirmId(cap.id)}
            onMeasure={() => void onMeasure(cap.id)}
          />
        ))}
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted">No published capabilities yet.</p>
        ) : null}
      </div>

      <Dialog
        open={confirmId != null}
        title="Deactivate capability"
        onClose={() => setConfirmId(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmId && void onDeactivate(confirmId)}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This will unregister the dynamic WebMCP tool from the demo store and mark the
          capability inactive. Telemetry already recorded keeps its version tags.
        </p>
      </Dialog>
    </div>
  );
}

function useRegistryHas(toolName: string): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);

  useEffect(() => {
    const registry = getRegistry();
    let cancelled = false;
    const apply = () => {
      if (!cancelled) setHas(registry.has(toolName));
    };
    const timer = window.setTimeout(() => {
      void registry.whenReady().then(apply);
    }, 0);
    const stop = registry.subscribe(apply);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, [toolName]);

  return has;
}

function PublishedCard({
  capId,
  onDeactivate,
  onMeasure,
}: {
  capId: string;
  onDeactivate: () => void;
  onMeasure: () => void;
}) {
  const cap = useLiveQuery(() => publishedRepo.get(capId), [capId]);
  const snapshot = useLiveQuery(() => metricRepo.byCapability(capId), [capId]);
  const hasInTab = useRegistryHas(cap?.toolName ?? "");

  if (!cap) return null;

  return (
    <article className="border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xl font-medium">{cap.toolName}</h2>
          <p className="font-mono text-xs text-muted">
            {cap.templateType} v{cap.version} published {formatTimestamp(cap.publishedAt)}
          </p>
        </div>
        <StatusBadge status={cap.status} />
      </div>
      {cap.registrationError ? (
        <p className="mt-2 text-sm text-danger">
          Registration error: {cap.registrationError}
        </p>
      ) : cap.status === "active" ? (
        <p className="mt-2 text-sm text-muted">
          {hasInTab === null
            ? "Checking live registration…"
            : hasInTab
              ? "Live in this tab"
              : "Not registered in this tab"}
        </p>
      ) : null}

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Before / after</h3>
        {!snapshot ? (
          <p className="mt-1 text-sm text-muted">
            No snapshot yet. Measure after collecting post-publish sessions.
          </p>
        ) : !snapshot.sufficientData ? (
          <p className="mt-1 text-sm text-muted">
            Insufficient data (need ≥5 journeys before and after). Before n=
            {snapshot.before.sampleSize}, after n={snapshot.after.sampleSize}.
          </p>
        ) : (
          <div className="mt-3">
            <DeltaFigure
              before={snapshot.before.avgCalls}
              after={snapshot.after.avgCalls}
              unit="avg calls"
            />
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <p className="font-mono text-xs text-muted">
                Before completion{" "}
                {snapshot.before.completionRate === null
                  ? "Not measured"
                  : `${round(snapshot.before.completionRate * 100, 1)}%`}{" "}
                · duration {snapshot.before.avgDurationMs}ms · n=
                {snapshot.before.sampleSize}
              </p>
              <p className="font-mono text-xs text-muted">
                After completion{" "}
                {snapshot.after.completionRate === null
                  ? "Not measured"
                  : `${round(snapshot.after.completionRate * 100, 1)}%`}{" "}
                · duration {snapshot.after.avgDurationMs}ms · n={snapshot.after.sampleSize}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onMeasure}>
          Compute before/after
        </Button>
        {cap.status === "active" ? (
          <Button variant="ghost" onClick={onDeactivate}>
            Deactivate…
          </Button>
        ) : null}
      </div>
    </article>
  );
}
