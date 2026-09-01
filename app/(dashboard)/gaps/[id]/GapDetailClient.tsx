"use client";

import { useMemo, useState } from "react";
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
} from "@/components/ui";
import { GapWorkflowStepper } from "@/components/dashboard/GapWorkflowStepper";
import { JourneySignature } from "@/components/dashboard/JourneySignature";
import { RecommendationConfigForm } from "@/components/dashboard/RecommendationConfigForm";
import { EvidencePulse } from "@/components/viz/EvidencePulse";
import { ConfidenceBand } from "@/components/viz/ConfidenceBand";
import { GapCollapse } from "@/components/viz/GapCollapse";
import {
  buildRecommendation,
  templateForGapType,
  type ConfigOverride,
} from "@/lib/recommendations/builder";
import type { Recommendation } from "@/lib/shared/types";
import { simulate } from "@/lib/recommendations/simulation";
import { dismissGap, transitionGap } from "@/lib/gaps/engine";
import {
  WORKFLOW_STEPS,
  nextStepAfter,
  parseWorkflowStepParam,
  resolveWorkflowStep,
  stepState,
  workflowStepHeadline,
  workflowStepNumber,
  type WorkflowStep,
} from "@/lib/gaps/workflow-steps";
import { approveRecommendation, publishRecommendation } from "@/lib/publishing/publish";
import { formatTimestamp, round } from "@/lib/shared";
import {
  formatCompletionRate,
  formatJourneyOutcome,
} from "@/lib/journeys/reconstruct";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";

export default function GapDetailClient({ id }: { id: string }) {
  const gap = useLiveQuery(() => gapRepo.get(id), [id]);
  const recommendation = useLiveQuery(
    async () =>
      gap?.recommendationId
        ? recommendationRepo.get(gap.recommendationId)
        : recommendationRepo.byGap(id),
    [gap?.recommendationId, id],
  );
  const simulation = useLiveQuery(
    async () =>
      recommendation ? simulationRepo.byRecommendation(recommendation.id) : undefined,
    [recommendation?.id],
  );
  const journeys = useLiveQuery(() => journeyRepo.all(), []) ?? [];
  const signals = useLiveQuery(() => frictionRepo.all(), []) ?? [];
  const published = useLiveQuery(() => publishedRepo.all(), []) ?? [];
  const searchParams = useSearchParams();
  const router = useRouter();
  const analysis = useAnalysisStatus();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const supportingJourneys = useMemo(() => {
    if (!gap) return [];
    return journeys.filter((j) => gap.supportingSessionIds.includes(j.sessionId));
  }, [gap, journeys]);

  const gapSignals = useMemo(() => {
    if (!gap) return [];
    return signals.filter((s) => gap.signalIds.includes(s.id));
  }, [gap, signals]);

  const requestedStep = parseWorkflowStepParam(
    searchParams.get("step"),
    searchParams.get("tab"),
  );

  const activeStep: WorkflowStep = gap
    ? resolveWorkflowStep(gap, recommendation, simulation, requestedStep)
    : "evidence";

  const stepStates = useMemo(() => {
    if (!gap) {
      return Object.fromEntries(
        WORKFLOW_STEPS.map((s) => [s, "blocked"]),
      ) as Record<WorkflowStep, ReturnType<typeof stepState>>;
    }
    return Object.fromEntries(
      WORKFLOW_STEPS.map((s) => [
        s,
        stepState(s, activeStep, gap, recommendation, simulation),
      ]),
    ) as Record<WorkflowStep, ReturnType<typeof stepState>>;
  }, [activeStep, gap, recommendation, simulation]);

  if (!gap) return <p className="text-muted">Gap not found.</p>;

  function setStep(next: WorkflowStep) {
    router.push(`/gaps/${id}?step=${next}`);
  }

  async function onBuildRecommendation() {
    setBusy(true);
    setMessage(null);
    setIssues([]);
    try {
      const result = buildRecommendation(gap!, {
        takenToolNames: published.map((p) => p.toolName),
        createdBy: "human",
      });
      if (!result.ok) {
        throw new Error(
          result.reason === "no_template"
            ? "No template available for this gap type"
            : result.issues.join(" "),
        );
      }
      const rec = result.recommendation;
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
      setStep(nextStepAfter("build"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveConfig(override: ConfigOverride) {
    if (!recommendation || !gap) return;
    setBusy(true);
    setMessage(null);
    setIssues([]);
    try {
      const takenToolNames = published
        .filter(
          (p) => p.status === "active" && p.toolName !== recommendation.proposedToolName,
        )
        .map((p) => p.toolName);
      const result = buildRecommendation(gap, {
        takenToolNames,
        createdBy: recommendation.createdBy,
        override,
      });
      if (!result.ok) {
        setIssues(
          result.reason === "no_template"
            ? ["No template available for this gap type"]
            : result.issues,
        );
        return;
      }

      const rebuilt: Recommendation = {
        ...result.recommendation,
        id: recommendation.id,
        createdAt: recommendation.createdAt,
        // Editing must not overwrite original authorship.
        createdBy: recommendation.createdBy,
        lastEditedBy: "human",
        updatedAt: Date.now(),
      };
      await recommendationRepo.put(rebuilt);
      await simulationRepo.deleteByRecommendation(recommendation.id);
      await gapRepo.put(
        transitionGap(
          { ...gap, recommendationId: rebuilt.id },
          "recommendation_ready",
          "human",
        ),
      );
      setMessage("Configuration saved. Run simulation to compare impact.");
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
      setStep(nextStepAfter("simulate"));
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
      setStep(nextStepAfter("approve"));
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
      setMessage(`Published ${cap.toolName} v${cap.version} on the demo store.`);
      setStep(nextStepAfter("publish"));
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
  const canBuild = templateForGapType(gap.type) !== null;
  const isResolved = gap.status === "resolved" || gap.status === "published";

  function renderPrimaryAction() {
    switch (activeStep) {
      case "evidence":
        if (!recommendation && canBuild) {
          return (
            <Button onClick={() => void onBuildRecommendation()} disabled={busy}>
              Build recommendation
            </Button>
          );
        }
        return null;
      case "propose":
        if (!recommendation && canBuild) {
          return (
            <Button onClick={() => void onBuildRecommendation()} disabled={busy}>
              Build recommendation
            </Button>
          );
        }
        if (recommendation && !simulation) {
          return (
            <Button onClick={() => void onSimulate()} disabled={busy}>
              Run simulation
            </Button>
          );
        }
        return null;
      case "compare":
        if (
          recommendation &&
          recommendation.status !== "approved" &&
          recommendation.status !== "published"
        ) {
          return (
            <Button onClick={() => void onApprove()} disabled={busy}>
              Approve for publish
            </Button>
          );
        }
        return null;
      case "approve":
        if (recommendation && recommendation.status === "approved") {
          return (
            <Button onClick={() => setStep("publish")} disabled={busy}>
              Continue to publish
            </Button>
          );
        }
        return null;
      case "publish":
        if (recommendation && !isResolved) {
          return (
            <Button onClick={() => void onPublish()} disabled={busy}>
              Confirm publish
            </Button>
          );
        }
        return null;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/gaps" className="text-sm text-accent hover:underline">
          ← Capability gaps
        </Link>
        <p className="mt-5 inline-flex items-center rounded-lg border border-accent/45 bg-accent-subtle px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          Step {workflowStepNumber(activeStep)}
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
          {workflowStepHeadline(activeStep)}
        </h1>
        <p className="mt-2 text-base text-muted">{gap.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={gap.status} />
          <StatusBadge status={gap.severity} />
          <Badge tone="info" dashed>
            inferred: {gap.detectedIntent}
          </Badge>
          <Badge tone="neutral">confidence {round(gap.confidence, 2)}</Badge>
        </div>
        {!isResolved && gap.staleEvidenceCapabilityId ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning-subtle/50 p-4">
            <p className="text-sm">
              All supporting evidence predates published capability{" "}
              <span className="font-mono">
                {gap.staleEvidenceCapabilityId.slice(0, 8)}
              </span>
              . Re-evaluate only if new post-publish sessions show this friction.
            </p>
          </div>
        ) : null}
        {isResolved && gap.resolvedByCapabilityId ? (
          <div className="mt-4 rounded-md border border-success/30 bg-success-subtle/50 p-4">
            <p className="text-sm">
              Resolved by publishing capability{" "}
              <span className="font-mono">{gap.resolvedByCapabilityId.slice(0, 8)}</span>
              {gap.resolvedAt ? ` at ${formatTimestamp(gap.resolvedAt)}` : ""}.
            </p>
            <Link href="/published" className="mt-2 inline-block text-sm text-accent hover:underline">
              View published capabilities
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 rounded-2xl border border-accent/30 bg-accent-subtle/40 p-6 md:grid-cols-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            What agents are trying to do
          </p>
          <p className="mt-2 font-display text-xl">{gap.detectedIntent}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            What they do today
          </p>
          <div className="mt-2">
            {dominantSignature ? (
              <JourneySignature signature={dominantSignature} />
            ) : (
              <p className="text-sm text-muted">No supporting journeys.</p>
            )}
          </div>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            What is missing
          </p>
          <p className="mt-2 font-mono text-lg text-accent">
            {recommendation?.proposedToolName ?? "capability not proposed yet"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EvidencePulse filled={gap.supportingSessionIds.length} threshold={3} />
        <ConfidenceBand value={gap.confidence} />
      </div>

      <GapWorkflowStepper
        activeStep={activeStep}
        stepStates={stepStates}
        onStepChange={setStep}
      />

      <div
        className="flex flex-wrap items-center gap-3"
        role="group"
        aria-label="Workflow action"
      >
        {renderPrimaryAction()}
        {gap.status !== "dismissed" && !isResolved ? (
          <Button variant="ghost" size="md" onClick={() => setDismissOpen(true)} disabled={busy}>
            Dismiss…
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {message}
        {!message && !recommendation && !canBuild && activeStep === "evidence"
          ? `No publishable template for ${gap.type} gaps. Dismiss if this is not actionable.`
          : null}
      </p>

      {activeStep === "evidence" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card as="section">
            <h2 className="font-display text-lg font-medium">Supporting evidence</h2>
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
            <h2 className="font-display text-lg font-medium">Dominant journey pattern</h2>
            {dominantSignature ? (
              <div className="mt-3">
                <JourneySignature signature={dominantSignature} />
                <p className="mt-2 text-sm text-muted">
                  {supportingJourneys.length} supporting journeys · avg{" "}
                  {gap.currentAvgCallCount} calls · Task completion:{" "}
                  {formatCompletionRate(supportingJourneys)}
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
                      · {j.callCount} calls · {formatJourneyOutcome(j.outcome)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">No supporting journeys.</p>
            )}
          </Card>
        </div>
      ) : null}

      {activeStep === "propose" ? (
        !recommendation ? (
          <p className="text-sm text-muted">
            {canBuild
              ? "No recommendation yet. Build one from the Evidence step."
              : `No publishable template for ${gap.type} gaps.`}
          </p>
        ) : (
          <Card as="section" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={recommendation.status} />
              <Badge tone="neutral">created by {recommendation.createdBy}</Badge>
              {recommendation.lastEditedBy ? (
                <Badge tone="info">edited by {recommendation.lastEditedBy}</Badge>
              ) : null}
              <Badge tone="info">
                explanation: {recommendation.explanation.generatedBy}
              </Badge>
              <Badge tone="warning">benefit: estimated</Badge>
            </div>
            <div>
              <h2 className="font-mono text-2xl font-medium">
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
            {recommendation.status === "published" ? (
              <div>
                <h3 className="text-sm font-semibold">Template config</h3>
                <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-3 text-xs">
                  {JSON.stringify(recommendation.templateConfig, null, 2)}
                </pre>
              </div>
            ) : (
              <RecommendationConfigForm
                key={recommendation.updatedAt}
                templateConfig={recommendation.templateConfig}
                issues={issues}
                busy={busy}
                onSave={(override) => void onSaveConfig(override)}
              />
            )}
            <div>
              <h3 className="text-sm font-semibold">Risks</h3>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {recommendation.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </Card>
        )
      ) : null}

      {activeStep === "compare" ? (
        !simulation ? (
          <p className="text-sm text-muted">
            Run a simulation from the Propose step to compare current vs proposed journeys.
          </p>
        ) : (
          <div className="space-y-6">
            <GapCollapse
              currentSignature={dominantSignature ?? ""}
              proposedSignature={
                recommendation ? `search_products>${recommendation.proposedToolName}` : ""
              }
              currentCalls={simulation.current.calls}
              proposedCalls={simulation.proposed.calls}
              currentDurationMs={simulation.current.avgDurationMs}
              proposedDurationMs={simulation.proposed.estDurationMs}
            />
            <aside className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface-raised/90 p-5 shadow-[var(--shadow-card)] md:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent via-accent/50 to-transparent"
              />
              <div className="flex flex-wrap items-end justify-between gap-3 pl-3">
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                    Model notes
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    Simulation assumptions
                  </h3>
                </div>
                <p className="rounded-xl border border-border bg-surface-muted px-3 py-2 font-mono text-[11px] tracking-wide text-muted uppercase">
                  Sessions measured · {simulation.affectedSessions}
                </p>
              </div>
              <ul className="mt-4 space-y-2.5 pl-3">
                {simulation.assumptions.map((a) => (
                  <li
                    key={a}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )
      ) : null}

      {activeStep === "approve" ? (
        <Card as="section" className="space-y-4">
          <h2 className="font-display text-lg font-medium">Human approval</h2>
          <p className="text-sm text-muted">
            AI proposes. Human decides. Every published capability is a read-only template
            someone simulated, edited, and approved.
          </p>
          {recommendation ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">Tool</dt>
              <dd className="font-mono">{recommendation.proposedToolName}</dd>
              <dt className="text-muted">Template</dt>
              <dd>{recommendation.templateType}</dd>
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge status={recommendation.status} />
              </dd>
            </dl>
          ) : null}
          {simulation ? (
            <p className="text-sm">
              Estimated {simulation.proposed.calls} calls vs {simulation.current.calls} today
              per affected journey.
            </p>
          ) : null}
        </Card>
      ) : null}

      {activeStep === "publish" ? (
        <Card as="section" className="space-y-4">
          <h2 className="font-display text-lg font-medium">Publish WebMCP capability</h2>
          {isResolved ? (
            <p className="text-sm text-muted">
              This gap is resolved. The dynamic tool is registered on the demo store.
            </p>
          ) : recommendation ? (
            <>
              <p className="text-sm">
                This will register a <strong>dynamic</strong> WebMCP tool on the{" "}
                <strong>demo store</strong> surface.
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
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
              <p className="text-sm text-muted">
                No arbitrary code will execute. The tool is instantiated from a safe
                capability template over existing store services.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Complete prior steps before publishing.</p>
          )}
        </Card>
      ) : null}

      <div className="border-t border-border pt-4">
        <button
          type="button"
          className="text-sm font-medium text-accent hover:underline"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? "Hide status history" : "View status history"}
        </button>
        {historyOpen ? (
          <ol className="mt-3 space-y-2">
            {gap.statusHistory.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex flex-wrap gap-3 text-sm">
                <StatusBadge status={h.status} />
                <span>{formatTimestamp(h.at)}</span>
                <span className="text-muted">by {h.by}</span>
                {h.reason ? <span className="text-muted">- {h.reason}</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

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
            className="lab-input mt-1"
            rows={3}
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
          />
        </label>
      </Dialog>
    </div>
  );
}
