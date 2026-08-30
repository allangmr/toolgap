"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import {
  frictionRepo,
  gapRepo,
  journeyRepo,
  publishedRepo,
  recommendationRepo,
  simulationRepo,
} from "@/lib/db/repositories";
import {
  Badge,
  Button,
  Card,
  Dialog,
  StatusBadge,
  TabPanel,
  Tabs,
} from "@/components/ui";
import { JourneySignature } from "@/components/dashboard/JourneySignature";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { simulate } from "@/lib/recommendations/simulation";
import { dismissGap, transitionGap } from "@/lib/gaps/engine";
import {
  approveRecommendation,
  publishRecommendation,
} from "@/lib/publishing/publish";
import { formatTimestamp, round } from "@/lib/shared";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";

export default function GapDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const gap = useLiveQuery(() => gapRepo.get(id), [id]);
  const recommendation = useLiveQuery(
    async () => (gap?.recommendationId ? recommendationRepo.get(gap.recommendationId) : recommendationRepo.byGap(id)),
    [gap?.recommendationId, id],
  );
  const simulation = useLiveQuery(
    async () =>
      recommendation
        ? simulationRepo.byRecommendation(recommendation.id)
        : undefined,
    [recommendation?.id],
  );
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const signals = useLiveQuery(() => frictionRepo.all(), []) ?? [];
  const published = useLiveQuery(() => publishedRepo.all(), []) ?? [];
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "evidence";
  const analysis = useAnalysisStatus();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  const supportingJourneys = useMemo(() => {
    if (!gap) return [];
    return journeys.filter((j) => gap.supportingSessionIds.includes(j.sessionId));
  }, [gap, journeys]);

  const gapSignals = useMemo(() => {
    if (!gap) return [];
    return signals.filter((s) => gap.signalIds.includes(s.id));
  }, [gap, signals]);

  if (!gap) return <p className="text-muted">Gap not found.</p>;

  function setTab(next: string) {
    router.push(`/gaps/${id}?tab=${next}`);
  }

  async function onBuildRecommendation() {
    setBusy(true);
    setMessage(null);
    try {
      const rec = buildRecommendation(gap!, {
        takenToolNames: published.map((p) => p.toolName),
        createdBy: "human",
      });
      if (!rec) throw new Error("No template available for this gap type");
      const existing = await recommendationRepo.byGap(gap!.id);
      if (existing) rec.id = existing.id;
      await recommendationRepo.put(rec);
      await gapRepo.put(
        transitionGap(
          { ...gap!, recommendationId: rec.id },
          "recommendation_ready",
          "human",
        ),
      );
      setMessage("Recommendation created.");
      setTab("recommendation");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSimulate() {
    if (!recommendation) return;
    setBusy(true);
    try {
      const sim = simulate(recommendation, supportingJourneys);
      await simulationRepo.put(sim);
      await recommendationRepo.put({
        ...recommendation,
        status: "simulated",
        updatedAt: Date.now(),
      });
      await gapRepo.put(transitionGap(gap!, "simulated", "human"));
      setMessage("Simulation complete.");
      setTab("simulation");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    if (!recommendation) return;
    setBusy(true);
    try {
      await approveRecommendation(recommendation.id);
      setMessage("Approved. Ready to publish.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!recommendation) return;
    setBusy(true);
    try {
      let rec = recommendation;
      if (rec.status !== "approved") {
        rec = await approveRecommendation(rec.id);
      }
      const cap = await publishRecommendation(rec.id);
      setPublishOpen(false);
      setMessage(`Published ${cap.toolName} v${cap.version} on the demo store.`);
      await analysis.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDismiss() {
    setBusy(true);
    try {
      await gapRepo.put(dismissGap(gap!, dismissReason || "Dismissed by human", "human"));
      if (recommendation) {
        await recommendationRepo.put({
          ...recommendation,
          status: "dismissed",
          updatedAt: Date.now(),
        });
      }
      setDismissOpen(false);
      setMessage("Gap dismissed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const dominantSignature = supportingJourneys[0]?.signature;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gaps" className="text-sm text-accent hover:underline">
          ← Capability gaps
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{gap.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={gap.status} />
          <StatusBadge status={gap.severity} />
          <Badge tone="info">inferred: {gap.detectedIntent}</Badge>
          <Badge tone="neutral">confidence {round(gap.confidence, 2)}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Gap actions">
        {!recommendation ? (
          <Button onClick={() => void onBuildRecommendation()} disabled={busy}>
            Build recommendation
          </Button>
        ) : null}
        {recommendation && !simulation ? (
          <Button onClick={() => void onSimulate()} disabled={busy}>
            Simulate
          </Button>
        ) : null}
        {recommendation && recommendation.status !== "approved" && recommendation.status !== "published" ? (
          <Button variant="secondary" onClick={() => void onApprove()} disabled={busy}>
            Approve
          </Button>
        ) : null}
        {recommendation &&
        (recommendation.status === "approved" || recommendation.status === "simulated") ? (
          <Button onClick={() => setPublishOpen(true)} disabled={busy}>
            Publish…
          </Button>
        ) : null}
        {gap.status !== "dismissed" && gap.status !== "published" ? (
          <Button variant="ghost" onClick={() => setDismissOpen(true)} disabled={busy}>
            Dismiss…
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {message}
      </p>

      <Tabs
        tabs={[
          { id: "evidence", label: "Evidence" },
          { id: "recommendation", label: "Recommendation" },
          { id: "simulation", label: "Simulation" },
          { id: "history", label: "History" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <TabPanel id="evidence" active={tab}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card as="section">
            <h2 className="font-semibold">Supporting evidence</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {gapSignals.map((s) => (
                <li key={s.id} className="rounded border border-border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{s.type}</span>
                    <StatusBadge status={s.severity} />
                  </div>
                  <p className="text-muted">
                    confidence {round(s.confidence, 2)} · wasted calls est.{" "}
                    {s.wastedCallsEstimate}
                  </p>
                  <pre className="mt-1 overflow-x-auto text-xs">
                    {JSON.stringify(s.evidence, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </Card>
          <Card as="section">
            <h2 className="font-semibold">Dominant journey pattern</h2>
            {dominantSignature ? (
              <div className="mt-3">
                <JourneySignature signature={dominantSignature} />
                <p className="mt-2 text-sm text-muted">
                  {supportingJourneys.length} supporting journeys · avg{" "}
                  {gap.currentAvgCallCount} calls ·{" "}
                  {round(gap.currentCompletionRate * 100, 1)}% completion
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {supportingJourneys.slice(0, 8).map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`/sessions/${j.sessionId}`}
                        className="text-accent hover:underline"
                      >
                        Session {j.sessionId.slice(0, 8)}
                      </Link>{" "}
                      · {j.callCount} calls · {j.outcome}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">No supporting journeys.</p>
            )}
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="recommendation" active={tab}>
        {!recommendation ? (
          <p className="text-sm text-muted">
            No recommendation yet. Build one from the actions above.
          </p>
        ) : (
          <Card as="section" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={recommendation.status} />
              <Badge tone="neutral">
                created by {recommendation.createdBy}
              </Badge>
              <Badge tone="info">
                explanation: {recommendation.explanation.generatedBy}
              </Badge>
              <Badge tone="warning">benefit: estimated</Badge>
            </div>
            <div>
              <h2 className="font-mono text-lg font-semibold">
                {recommendation.proposedToolName}
              </h2>
              <p className="mt-1 text-sm">{recommendation.description}</p>
            </div>
            <p className="text-sm">{recommendation.explanation.text}</p>
            <div>
              <h3 className="text-sm font-semibold">Input schema</h3>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-3 text-xs">
                {JSON.stringify(recommendation.inputSchemaJson, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Template config</h3>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-3 text-xs">
                {JSON.stringify(recommendation.templateConfig, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Risks</h3>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {recommendation.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-muted">
              Estimated call reduction:{" "}
              {recommendation.estimatedBenefit.callReduction} · estimated latency
              reduction: {recommendation.estimatedBenefit.latencyReductionMs}ms
            </p>
          </Card>
        )}
      </TabPanel>

      <TabPanel id="simulation" active={tab}>
        {!simulation ? (
          <p className="text-sm text-muted">Run a simulation to compare current vs proposed journeys.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Current (measured)</h2>
              <p className="mt-2 font-mono text-2xl">{simulation.current.calls} calls</p>
              <p className="text-sm text-muted">
                avg duration {simulation.current.avgDurationMs}ms ·{" "}
                <StatusBadge status="measured" />
              </p>
              {dominantSignature ? (
                <div className="mt-3">
                  <JourneySignature signature={dominantSignature} />
                </div>
              ) : null}
            </Card>
            <Card>
              <h2 className="font-semibold">Proposed (estimated)</h2>
              <p className="mt-2 font-mono text-2xl">{simulation.proposed.calls} calls</p>
              <p className="text-sm text-muted">
                est. duration {simulation.proposed.estDurationMs}ms ·{" "}
                <StatusBadge status="estimated" />
              </p>
              {recommendation ? (
                <div className="mt-3">
                  <JourneySignature
                    signature={`search_products>${recommendation.proposedToolName}`}
                  />
                </div>
              ) : null}
            </Card>
            <Card className="lg:col-span-2">
              <h3 className="font-semibold">Assumptions</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                {simulation.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                Affected sessions (measured): {simulation.affectedSessions}
              </p>
              <p className="text-sm text-muted">
                Completion improvement is not quantified numerically in MVP.
              </p>
            </Card>
          </div>
        )}
      </TabPanel>

      <TabPanel id="history" active={tab}>
        <ol className="space-y-2">
          {gap.statusHistory.map((h, i) => (
            <li key={`${h.at}-${i}`} className="flex gap-3 text-sm">
              <StatusBadge status={h.status} />
              <span>{formatTimestamp(h.at)}</span>
              <span className="text-muted">by {h.by}</span>
              {h.reason ? <span className="text-muted">— {h.reason}</span> : null}
            </li>
          ))}
        </ol>
      </TabPanel>

      <Dialog
        open={publishOpen}
        title="Publish WebMCP capability"
        onClose={() => setPublishOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void onPublish()} disabled={busy}>
              Confirm publish
            </Button>
          </>
        }
      >
        {recommendation ? (
          <div className="space-y-3 text-sm">
            <p>
              This will register a <strong>dynamic</strong> WebMCP tool on the{" "}
              <strong>demo store</strong> surface.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">Name</dt>
              <dd className="font-mono">{recommendation.proposedToolName}</dd>
              <dt className="text-muted">Template</dt>
              <dd>{recommendation.templateType}</dd>
              <dt className="text-muted">Description</dt>
              <dd>{recommendation.description}</dd>
            </dl>
            <pre className="max-h-48 overflow-auto rounded bg-surface-muted p-2 text-xs">
              {JSON.stringify(recommendation.inputSchemaJson, null, 2)}
            </pre>
            <p className="text-muted">
              No arbitrary code will execute. The tool is instantiated from a safe
              capability template over existing store services.
            </p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={dismissOpen}
        title="Dismiss gap"
        onClose={() => setDismissOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDismissOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void onDismiss()} disabled={busy}>
              Dismiss
            </Button>
          </>
        }
      >
        <label className="block text-sm">
          Reason
          <textarea
            className="mt-1 w-full rounded border border-border p-2"
            rows={3}
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
          />
        </label>
      </Dialog>
    </div>
  );
}
