import { createId, mean, median, nowMs, round } from "@/lib/shared";
import type {
  Journey,
  JourneyStep,
  Recommendation,
  RecommendationSimulation,
} from "@/lib/shared/types";
import { getTemplate, type RewriteRule } from "./templates";

export function rewriteJourneySteps(
  steps: JourneyStep[],
  rule: RewriteRule,
): JourneyStep[] {
  const collapse = new Set(rule.collapseTools);
  const result: JourneyStep[] = [];
  let collapsed = false;
  let collapsedDuration = 0;
  let prefixDone = false;

  for (const step of steps) {
    const isPrefix =
      rule.keepPrefixTools?.includes(step.toolName) && !prefixDone && !collapsed;

    if (isPrefix) {
      result.push(step);
      continue;
    }
    if (rule.keepPrefixTools?.includes(step.toolName)) {
      prefixDone = true;
    }

    if (collapse.has(step.toolName)) {
      collapsedDuration += step.durationMs;
      if (!collapsed) {
        collapsed = true;
        prefixDone = true;
      }
      continue;
    }

    if (collapsed) {
      result.push({
        toolName: rule.intoTool,
        entityIds: [],
        success: true,
        durationMs: Math.round(
          collapsedDuration * (rule.estimatedNewToolLatencyFactor ?? 0.6),
        ),
        repeatIndex: 1,
        paramsHash: "simulated",
        sequenceIndex: result.length + 1,
      });
      collapsed = false;
      collapsedDuration = 0;
    }

    result.push(step);
  }

  if (collapsed) {
    result.push({
      toolName: rule.intoTool,
      entityIds: [],
      success: true,
      durationMs: Math.round(
        collapsedDuration * (rule.estimatedNewToolLatencyFactor ?? 0.6),
      ),
      repeatIndex: 1,
      paramsHash: "simulated",
      sequenceIndex: result.length + 1,
    });
  }

  return result;
}

export function simulate(
  recommendation: Recommendation,
  supportingJourneys: Journey[],
): RecommendationSimulation {
  const template = getTemplate(recommendation.templateType);
  const rule = template.expectedJourneyRewrite(
    recommendation.templateConfig as never,
  );

  const currentCalls = supportingJourneys.map((j) => j.callCount);
  const currentDurations = supportingJourneys.map((j) => j.durationMs);
  const rewrittenCounts: number[] = [];
  const estimatedDurations: number[] = [];

  for (const journey of supportingJourneys) {
    const rewritten = rewriteJourneySteps(journey.steps, rule);
    rewrittenCounts.push(rewritten.length);
    estimatedDurations.push(rewritten.reduce((s, step) => s + step.durationMs, 0));
  }

  const patternSignature =
    supportingJourneys[0]?.signature ?? "unknown";

  const assumptions = [
    "Proposed duration uses measured step latencies with a batch-discount factor from the template.",
    "Completion improvement is not quantified numerically in MVP.",
    "Rewrite assumes the new capability replaces the collapsed tool run after any kept prefix tools.",
  ];

  return {
    id: createId(),
    recommendationId: recommendation.id,
    patternSignature,
    current: {
      calls: round(mean(currentCalls), 2),
      avgDurationMs: round(mean(currentDurations), 1),
      source: "measured",
    },
    proposed: {
      calls: round(mean(rewrittenCounts), 2),
      estDurationMs: round(median(estimatedDurations), 1),
      source: "estimated",
    },
    affectedSessions: new Set(supportingJourneys.map((j) => j.sessionId)).size,
    assumptions,
    createdAt: nowMs(),
  };
}
