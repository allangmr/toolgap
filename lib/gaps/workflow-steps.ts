import { templateForGapType } from "@/lib/recommendations/builder";
import type {
  CapabilityGap,
  Recommendation,
  RecommendationSimulation,
} from "@/lib/shared/types";

export const WORKFLOW_STEPS = [
  "evidence",
  "propose",
  "compare",
  "approve",
  "publish",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export type WorkflowStepState = "complete" | "current" | "upcoming" | "blocked";

export type WorkflowAction =
  | "build"
  | "save_config"
  | "simulate"
  | "approve"
  | "publish";

const STEP_LABELS: Record<WorkflowStep, string> = {
  evidence: "Evidence",
  propose: "Propose",
  compare: "Compare",
  approve: "Approve",
  publish: "Publish",
};

const LEGACY_TAB_TO_STEP: Record<string, WorkflowStep> = {
  evidence: "evidence",
  recommendation: "propose",
  simulation: "compare",
};

export function workflowStepLabel(step: WorkflowStep): string {
  return STEP_LABELS[step];
}

export function parseWorkflowStepParam(
  step: string | null,
  tab: string | null,
): WorkflowStep | null {
  if (step && WORKFLOW_STEPS.includes(step as WorkflowStep)) {
    return step as WorkflowStep;
  }
  if (tab && LEGACY_TAB_TO_STEP[tab]) {
    return LEGACY_TAB_TO_STEP[tab];
  }
  return null;
}

export function isGapPublished(gap: CapabilityGap): boolean {
  return gap.status === "resolved" || gap.status === "published";
}

export function isEvidenceComplete(gap: CapabilityGap): boolean {
  return gap.supportingSessionIds.length >= 3 || gap.status !== "detected";
}

export function isProposeComplete(
  gap: CapabilityGap,
  recommendation: Recommendation | undefined,
): boolean {
  return Boolean(recommendation) || gap.recommendationId != null;
}

export function isCompareComplete(simulation: RecommendationSimulation | undefined): boolean {
  return Boolean(simulation);
}

export function isApproveComplete(recommendation: Recommendation | undefined): boolean {
  if (!recommendation) return false;
  return recommendation.status === "approved" || recommendation.status === "published";
}

export function isPublishComplete(gap: CapabilityGap): boolean {
  return isGapPublished(gap);
}

export function isStepComplete(
  step: WorkflowStep,
  gap: CapabilityGap,
  recommendation: Recommendation | undefined,
  simulation: RecommendationSimulation | undefined,
): boolean {
  switch (step) {
    case "evidence":
      return isEvidenceComplete(gap);
    case "propose":
      return isProposeComplete(gap, recommendation);
    case "compare":
      return isCompareComplete(simulation);
    case "approve":
      return isApproveComplete(recommendation);
    case "publish":
      return isPublishComplete(gap);
    default:
      return false;
  }
}

export function canEnterStep(
  step: WorkflowStep,
  gap: CapabilityGap,
  recommendation: Recommendation | undefined,
  simulation: RecommendationSimulation | undefined,
): boolean {
  if (isGapPublished(gap) && step !== "publish") {
    return true;
  }

  const index = WORKFLOW_STEPS.indexOf(step);
  if (index <= 0) return true;

  for (let i = 0; i < index; i++) {
    const prior = WORKFLOW_STEPS[i]!;
    if (!isStepComplete(prior, gap, recommendation, simulation)) {
      if (prior === "propose" && templateForGapType(gap.type) === null) {
        return false;
      }
      if (prior === "evidence" && !isEvidenceComplete(gap)) return false;
      return false;
    }
  }

  if (step === "propose" && templateForGapType(gap.type) === null) {
    return false;
  }

  return true;
}

export function resolveWorkflowStep(
  gap: CapabilityGap,
  recommendation: Recommendation | undefined,
  simulation: RecommendationSimulation | undefined,
  requested?: WorkflowStep | null,
): WorkflowStep {
  if (requested && canEnterStep(requested, gap, recommendation, simulation)) {
    return requested;
  }

  if (isGapPublished(gap)) return "publish";
  if (isApproveComplete(recommendation) && recommendation?.status !== "published") {
    return "publish";
  }
  if (isCompareComplete(simulation) && !isApproveComplete(recommendation)) {
    return "compare";
  }
  if (isProposeComplete(gap, recommendation) && !isCompareComplete(simulation)) {
    return "propose";
  }
  if (isEvidenceComplete(gap) && templateForGapType(gap.type) !== null) {
    return "propose";
  }

  return "evidence";
}

export function stepState(
  step: WorkflowStep,
  activeStep: WorkflowStep,
  gap: CapabilityGap,
  recommendation: Recommendation | undefined,
  simulation: RecommendationSimulation | undefined,
): WorkflowStepState {
  if (step === activeStep) return "current";
  if (isStepComplete(step, gap, recommendation, simulation)) return "complete";
  if (canEnterStep(step, gap, recommendation, simulation)) return "upcoming";
  return "blocked";
}

export function nextStepAfter(action: WorkflowAction): WorkflowStep {
  switch (action) {
    case "build":
      return "propose";
    case "save_config":
      return "propose";
    case "simulate":
      return "compare";
    case "approve":
      return "publish";
    case "publish":
      return "publish";
    default:
      return "evidence";
  }
}

export function workflowStepForRecommendationStatus(
  status: Recommendation["status"],
): WorkflowStep {
  switch (status) {
    case "draft":
    case "ready":
      return "propose";
    case "simulated":
      return "approve";
    case "approved":
      return "publish";
    case "published":
      return "publish";
    default:
      return "evidence";
  }
}
