import type {
  FrictionSignal,
  FrictionType,
  InferredIntent,
  Journey,
  Severity,
} from "@/lib/shared/types";
import { clamp, createId, nowMs, percentile } from "@/lib/shared";

export interface DetectorConfig {
  multiEntityMin: number;
  repeatedSequenceMin: number;
  excessiveCallsMultiplier: number;
  excessiveCallsMinComparable: number;
  failureLoopMin: number;
  parameterIterationMin: number;
  parameterSimilarityMin: number;
  missingAggregationMin: number;
  missingAggregationWindow: number;
}

export const detectorConfig: DetectorConfig = {
  multiEntityMin: 3,
  repeatedSequenceMin: 3,
  excessiveCallsMultiplier: 1.5,
  excessiveCallsMinComparable: 10,
  failureLoopMin: 3,
  parameterIterationMin: 3,
  parameterSimilarityMin: 0.6,
  missingAggregationMin: 3,
  missingAggregationWindow: 10,
};

export interface DetectorContext {
  journeys: Journey[];
  config?: DetectorConfig;
}

export interface Detector {
  type: FrictionType;
  analyze: (journey: Journey, ctx: DetectorContext) => FrictionSignal | null;
}

function severityFromWasted(wasted: number): Severity {
  if (wasted > 5) return "high";
  if (wasted >= 2) return "medium";
  return "low";
}

function signal(
  partial: Omit<FrictionSignal, "id" | "detectedAt">,
): FrictionSignal {
  return {
    ...partial,
    id: createId(),
    detectedAt: nowMs(),
  };
}

export const multiEntityInspection: Detector = {
  type: "MULTI_ENTITY_INSPECTION",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    const hasSearch = journey.steps.some((s) => s.toolName === "search_products");
    const productSteps = journey.steps.filter((s) => s.toolName === "get_product");
    // Compare = search once, then inspect many. Interleaved search→get is FILTER.
    let cluster = new Set<string>();
    let entitiesInspected = 0;
    for (const step of journey.steps) {
      if (step.toolName === "search_products") {
        cluster = new Set();
        continue;
      }
      if (step.toolName !== "get_product") continue;
      for (const id of step.entityIds) cluster.add(id);
      if (cluster.size > entitiesInspected) entitiesInspected = cluster.size;
    }
    if (!hasSearch || entitiesInspected < config.multiEntityMin) return null;

    const availabilityFollowUps = journey.steps.filter(
      (s) => s.toolName === "get_availability",
    ).length;
    const hasAvailabilityFollowUp = availabilityFollowUps > 0;
    const confidence = clamp(
      0.5 + 0.1 * (entitiesInspected - 3) + (hasAvailabilityFollowUp ? 0.15 : 0),
      0,
      0.95,
    );
    const idealCalls = 2; // search + compare
    const wasted = Math.max(0, journey.callCount - idealCalls);

    return signal({
      type: "MULTI_ENTITY_INSPECTION",
      confidence,
      severity: severityFromWasted(wasted),
      journeyId: journey.id,
      sessionId: journey.sessionId,
      involvedTools: ["search_products", "get_product"],
      entityType: "product",
      wastedCallsEstimate: wasted,
      evidence: {
        entitiesInspected,
        callsSpent: productSteps.length,
        followedAvailabilityChecks: availabilityFollowUps,
      },
    });
  },
};

export const repeatedSequence: Detector = {
  type: "REPEATED_SEQUENCE",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    let cycles = 0;
    const queries = new Set<string>();
    for (let i = 0; i < journey.steps.length - 1; i++) {
      const a = journey.steps[i]!;
      const b = journey.steps[i + 1]!;
      if (a.toolName === "search_products" && b.toolName === "get_product") {
        cycles += 1;
        queries.add(a.paramsHash);
      }
    }
    if (cycles < config.repeatedSequenceMin) return null;
    const wasted = Math.max(0, cycles - 1);
    return signal({
      type: "REPEATED_SEQUENCE",
      confidence: clamp(0.55 + 0.1 * (cycles - 3), 0, 0.9),
      severity: severityFromWasted(wasted),
      journeyId: journey.id,
      sessionId: journey.sessionId,
      involvedTools: ["search_products", "get_product"],
      entityType: "product",
      wastedCallsEstimate: wasted,
      evidence: { cycleCount: cycles, distinctQueries: queries.size },
    });
  },
};

export const excessiveCalls: Detector = {
  type: "EXCESSIVE_CALLS",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    const comparable = ctx.journeys.filter(
      (j) =>
        j.id !== journey.id &&
        j.outcome === "completed" &&
        j.inferredIntent === journey.inferredIntent,
    );
    if (comparable.length < config.excessiveCallsMinComparable) return null;
    const calls = comparable.map((j) => j.callCount).sort((a, b) => a - b);
    const p75 = percentile(calls, 75);
    const threshold = p75 * config.excessiveCallsMultiplier;
    if (journey.callCount <= threshold) return null;
    const wasted = journey.callCount - p75;
    return signal({
      type: "EXCESSIVE_CALLS",
      confidence: clamp(0.5 + (journey.callCount - threshold) / 20, 0, 0.9),
      severity: severityFromWasted(wasted),
      journeyId: journey.id,
      sessionId: journey.sessionId,
      involvedTools: [...new Set(journey.steps.map((s) => s.toolName))],
      wastedCallsEstimate: Math.max(0, wasted),
      evidence: {
        calls: journey.callCount,
        comparableP75: p75,
        comparableCount: comparable.length,
      },
    });
  },
};

export const failureLoop: Detector = {
  type: "FAILURE_LOOP",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    let best: { toolName: string; category: string; attempts: number } | null = null;
    let runTool = "";
    let runCategory = "";
    let runCount = 0;

    for (const step of journey.steps) {
      if (!step.success) {
        const cat = step.errorCategory ?? "unknown";
        if (step.toolName === runTool && cat === runCategory) {
          runCount += 1;
        } else {
          runTool = step.toolName;
          runCategory = cat;
          runCount = 1;
        }
        if (runCount >= config.failureLoopMin) {
          if (!best || runCount > best.attempts) {
            best = { toolName: runTool, category: runCategory, attempts: runCount };
          }
        }
      } else {
        runTool = "";
        runCategory = "";
        runCount = 0;
      }
    }

    if (!best) return null;
    return signal({
      type: "FAILURE_LOOP",
      confidence: clamp(0.7 + 0.05 * (best.attempts - 3), 0, 0.95),
      severity: "high",
      journeyId: journey.id,
      sessionId: journey.sessionId,
      involvedTools: [best.toolName],
      wastedCallsEstimate: best.attempts - 1,
      evidence: {
        toolName: best.toolName,
        errorCategory: best.category,
        attempts: best.attempts,
      },
    });
  },
};

function jaccardKeys(a: string[] | undefined, b: string[] | undefined): number {
  const as = new Set(a ?? []);
  const bs = new Set(b ?? []);
  if (as.size === 0 && bs.size === 0) return 0;
  let inter = 0;
  for (const x of as) if (bs.has(x)) inter += 1;
  const union = as.size + bs.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const parameterIteration: Detector = {
  type: "PARAMETER_ITERATION",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    const byTool = new Map<string, typeof journey.steps>();
    for (const step of journey.steps) {
      const list = byTool.get(step.toolName) ?? [];
      list.push(step);
      byTool.set(step.toolName, list);
    }

    for (const [toolName, steps] of byTool) {
      const usable = steps.filter(
        (s) => (s.paramsKeys?.length ?? 0) > 0,
      );
      if (usable.length < config.parameterIterationMin) continue;
      const unique = new Set(usable.map((s) => s.paramsHash));
      if (unique.size < 2) continue;
      let similarPairs = 0;
      for (let i = 0; i < usable.length - 1; i++) {
        const a = usable[i]!;
        const b = usable[i + 1]!;
        if (a.paramsHash === b.paramsHash) continue;
        if (jaccardKeys(a.paramsKeys, b.paramsKeys) >= config.parameterSimilarityMin) {
          similarPairs += 1;
        }
      }
      if (similarPairs + 1 < config.parameterIterationMin) continue;
      return signal({
        type: "PARAMETER_ITERATION",
        confidence: clamp(0.55 + 0.08 * similarPairs, 0, 0.9),
        severity: severityFromWasted(usable.length - 1),
        journeyId: journey.id,
        sessionId: journey.sessionId,
        involvedTools: [toolName],
        entityType: toolName.includes("product") ? "product" : undefined,
        wastedCallsEstimate: usable.length - 1,
        evidence: {
          toolName,
          iterations: usable.length,
          similarity: config.parameterSimilarityMin,
          changedKeys: unique.size,
        },
      });
    }
    return null;
  },
};

export const missingAggregation: Detector = {
  type: "MISSING_AGGREGATION",
  analyze(journey, ctx) {
    const config = ctx.config ?? detectorConfig;
    const candidates = ["get_product", "get_availability"] as const;

    for (const toolName of candidates) {
      const steps = journey.steps.filter((s) => s.toolName === toolName);
      if (steps.length < config.missingAggregationMin) continue;

      for (let start = 0; start < journey.steps.length; start++) {
        const window = journey.steps.slice(start, start + config.missingAggregationWindow);
        const inWindow = window.filter((s) => s.toolName === toolName);
        const entities = new Set(inWindow.flatMap((s) => s.entityIds));
        if (entities.size >= config.missingAggregationMin) {
          const wasted = entities.size - 1;
          return signal({
            type: "MISSING_AGGREGATION",
            confidence: clamp(0.6 + 0.08 * (entities.size - 3), 0, 0.92),
            severity: severityFromWasted(wasted),
            journeyId: journey.id,
            sessionId: journey.sessionId,
            involvedTools: [toolName],
            entityType: toolName === "get_availability" ? "inventory" : "product",
            wastedCallsEstimate: wasted,
            evidence: {
              toolName,
              distinctEntities: entities.size,
              windowCalls: inWindow.length,
            },
          });
        }
      }
    }
    return null;
  },
};

export const allDetectors: Detector[] = [
  multiEntityInspection,
  repeatedSequence,
  excessiveCalls,
  failureLoop,
  parameterIteration,
  missingAggregation,
];

export function runDetectors(
  journey: Journey,
  ctx: DetectorContext,
): FrictionSignal[] {
  const signals: FrictionSignal[] = [];
  const seen = new Set<string>();
  for (const detector of allDetectors) {
    const result = detector.analyze(journey, ctx);
    if (!result) continue;
    const key = `${result.type}:${result.involvedTools.slice().sort().join(",")}:${result.entityType ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    signals.push(result);
  }
  return signals;
}

export function intentCorpusSize(
  journeys: Journey[],
  intent: InferredIntent,
): number {
  return journeys.filter((j) => j.inferredIntent === intent).length;
}
