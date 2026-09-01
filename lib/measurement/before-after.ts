import { createId, mean, nowMs, round } from "@/lib/shared";
import { completionRate } from "@/lib/journeys/reconstruct";
import type {
  InferredIntent,
  Journey,
  MetricSnapshot,
  PublishedCapability,
  ToolCallEvent,
} from "@/lib/shared/types";

export interface MeasurementConfig {
  minSampleSize: number;
}

export const measurementConfig: MeasurementConfig = {
  minSampleSize: 5,
};

export function computeBeforeAfter(args: {
  capability: PublishedCapability;
  journeys: Journey[];
  events: ToolCallEvent[];
  intent?: InferredIntent;
  signature?: string;
  config?: MeasurementConfig;
}): MetricSnapshot {
  const config = args.config ?? measurementConfig;
  const publishedAt = args.capability.publishedAt;

  const scoped = args.journeys.filter((j) => {
    if (args.intent && j.inferredIntent !== args.intent) return false;
    if (args.signature && j.signature !== args.signature) return false;
    return true;
  });

  const beforeJ = scoped.filter((j) => j.endedAt < publishedAt);

  const sessionsWithNewTool = new Set(
    args.events
      .filter(
        (e) =>
          e.toolName === args.capability.toolName ||
          e.capabilityId === args.capability.id,
      )
      .map((e) => e.sessionId),
  );
  const afterFromTool = args.journeys.filter((j) =>
    sessionsWithNewTool.has(j.sessionId),
  );
  const afterFinal =
    afterFromTool.length > 0
      ? afterFromTool
      : scoped.filter((j) => j.startedAt >= publishedAt);

  const summarize = (list: Journey[]) => {
    const rate = completionRate(list);
    return {
      avgCalls: round(mean(list.map((j) => j.callCount)), 2),
      completionRate: rate === null ? null : round(rate, 3),
      avgDurationMs: round(mean(list.map((j) => j.durationMs)), 1),
      sampleSize: list.length,
      source: "measured" as const,
    };
  };

  const before = summarize(beforeJ);
  const after = summarize(afterFinal);
  const sufficientData =
    before.sampleSize >= config.minSampleSize &&
    after.sampleSize >= config.minSampleSize;

  const earliest = Math.min(...args.journeys.map((j) => j.startedAt), publishedAt);
  const latest = Math.max(...args.journeys.map((j) => j.endedAt), nowMs());

  return {
    id: createId(),
    capabilityId: args.capability.id,
    version: args.capability.version,
    windowBefore: { from: earliest, to: publishedAt },
    windowAfter: { from: publishedAt, to: latest },
    journeyScope: { intent: args.intent, signature: args.signature },
    before,
    after,
    sufficientData,
    computedAt: nowMs(),
  };
}
