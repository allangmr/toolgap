import { createId, mean, nowMs, round } from "@/lib/shared";
import type {
  CapabilityGap,
  FrictionSignal,
  FrictionType,
  GapStatus,
  GapType,
  Journey,
  Severity,
} from "@/lib/shared/types";

export interface GapEngineConfig {
  minSupportingSessions: number;
  minRelevantShare: number;
  minConfidence: number;
  dismissalCooldownMs: number;
}

export const gapEngineConfig: GapEngineConfig = {
  minSupportingSessions: 3,
  minRelevantShare: 0.1,
  minConfidence: 0.6,
  dismissalCooldownMs: 7 * 24 * 60 * 60 * 1000,
};

function frictionToGapType(type: FrictionType, entityType?: string): GapType {
  switch (type) {
    case "MULTI_ENTITY_INSPECTION":
      return "COMPARE";
    case "MISSING_AGGREGATION":
      return entityType === "inventory" ? "AVAILABILITY_BATCH" : "BULK_READ";
    case "REPEATED_SEQUENCE":
    case "PARAMETER_ITERATION":
      return "FILTER";
    default:
      return "UNKNOWN";
  }
}

function titleFor(type: GapType, entityType: string): string {
  switch (type) {
    case "COMPARE":
      return `Missing compare_${entityType}s capability`;
    case "AVAILABILITY_BATCH":
      return "Missing batch availability capability";
    case "BULK_READ":
      return `Missing bulk read for ${entityType}`;
    case "FILTER":
      return "Search results may lack fields agents need";
    default:
      return "Unclassified capability gap";
  }
}

export function buildMergeKey(signal: FrictionSignal): string {
  const tools = [...signal.involvedTools].sort().join(",");
  return `${signal.type}:${signal.entityType ?? "any"}:${tools}`;
}

function severityFromScore(score: number): Severity {
  if (score >= 0.5) return "high";
  if (score >= 0.2) return "medium";
  return "low";
}

export function mergeSignalsIntoGaps(
  signals: FrictionSignal[],
  journeys: Journey[],
  existingGaps: CapabilityGap[],
  config: GapEngineConfig = gapEngineConfig,
  now = nowMs(),
): CapabilityGap[] {
  const gapsByKey = new Map<string, CapabilityGap>();
  for (const gap of existingGaps) {
    gapsByKey.set(gap.mergeKey, { ...gap });
  }

  const signalsByKey = new Map<string, FrictionSignal[]>();
  for (const signal of signals) {
    const key = buildMergeKey(signal);
    const list = signalsByKey.get(key) ?? [];
    list.push(signal);
    signalsByKey.set(key, list);
  }

  // Also include signals already on existing gaps when re-running
  for (const gap of existingGaps) {
    // keep existing signal ids; new signals append below
    void gap;
  }

  const journeyById = new Map(journeys.map((j) => [j.id, j]));
  const result: CapabilityGap[] = [];

  for (const [mergeKey, keySignals] of signalsByKey) {
    const existing = gapsByKey.get(mergeKey);
    if (
      existing?.status === "dismissed" &&
      existing.dismissedUntil &&
      existing.dismissedUntil > now &&
      keySignals.length < (existing.affectedSessions || 1) * 2
    ) {
      result.push(existing);
      gapsByKey.delete(mergeKey);
      continue;
    }

    const allSignalIds = new Set([
      ...(existing?.signalIds ?? []),
      ...keySignals.map((s) => s.id),
    ]);
    // For confidence, use the current batch + we don't have old signal objects; use keySignals avg
    // Prefer merging with existing confidence
    const sessionIds = new Set<string>([
      ...(existing?.supportingSessionIds ?? []),
      ...keySignals.map((s) => s.sessionId),
    ]);
    const journeyIds = new Set(keySignals.map((s) => s.journeyId));
    if (existing) {
      // approximate: keep prior journey influence via session count
    }

    const supportingJourneys = [...journeyIds]
      .map((id) => journeyById.get(id))
      .filter((j): j is Journey => j != null);

    const relevantIntent =
      supportingJourneys[0]?.inferredIntent ??
      existing?.detectedIntent ??
      "unknown";
    const relevantJourneys = journeys.filter(
      (j) => j.inferredIntent === relevantIntent || journeyIds.has(j.id),
    );
    const percentage =
      relevantJourneys.length === 0
        ? 0
        : sessionIds.size / Math.max(relevantJourneys.length, 1);

    const confidence = mean([
      ...(existing ? [existing.confidence] : []),
      ...keySignals.map((s) => s.confidence),
    ]);

    const avgCalls =
      supportingJourneys.length > 0
        ? mean(supportingJourneys.map((j) => j.callCount))
        : (existing?.currentAvgCallCount ?? 0);
    const completionRate =
      supportingJourneys.length > 0
        ? supportingJourneys.filter((j) => j.outcome === "completed").length /
          supportingJourneys.length
        : (existing?.currentCompletionRate ?? 0);

    const avgWasted = mean(keySignals.map((s) => s.wastedCallsEstimate));
    const severityScore =
      avgWasted * Math.min(1, percentage) * confidence;
    const severity = severityFromScore(severityScore / 5);

    const firstSignal = keySignals[0]!;
    const gapType = frictionToGapType(firstSignal.type, firstSignal.entityType);
    const entityType = firstSignal.entityType ?? existing?.entityType ?? "product";

    const meetsSurface =
      sessionIds.size >= config.minSupportingSessions &&
      percentage >= config.minRelevantShare &&
      confidence >= config.minConfidence;

    if (!meetsSurface && !existing) {
      // Accumulate silently as a soft gap with detected status only when thresholds met.
      // Still create a draft gap so seed with enough sessions works — wait, plan says
      // accumulate silently. We'll create but UI can filter by thresholds.
      // For MVP UX, create when thresholds met only.
      continue;
    }

    if (!meetsSurface && existing) {
      // Update counts but keep
    }

    const gap: CapabilityGap = existing
      ? {
          ...existing,
          confidence: round(confidence, 3),
          severity,
          supportingSessionIds: [...sessionIds],
          affectedSessions: sessionIds.size,
          percentageOfRelevantJourneys: round(percentage, 3),
          currentAvgCallCount: round(avgCalls, 2),
          currentCompletionRate: round(completionRate, 3),
          signalIds: [...allSignalIds],
          lastDetectedAt: now,
          detectedIntent: relevantIntent,
          status:
            existing.status === "dismissed" && meetsSurface
              ? "detected"
              : existing.status,
          statusHistory:
            existing.status === "dismissed" && meetsSurface
              ? [
                  ...existing.statusHistory,
                  { status: "detected" as GapStatus, at: now, by: "system" as const },
                ]
              : existing.statusHistory,
          dismissalReason:
            existing.status === "dismissed" && meetsSurface
              ? undefined
              : existing.dismissalReason,
          dismissedUntil:
            existing.status === "dismissed" && meetsSurface
              ? undefined
              : existing.dismissedUntil,
        }
      : {
          id: createId(),
          title: titleFor(gapType, entityType),
          type: gapType,
          entityType,
          detectedIntent: relevantIntent,
          status: "detected",
          confidence: round(confidence, 3),
          severity,
          supportingSessionIds: [...sessionIds],
          affectedSessions: sessionIds.size,
          percentageOfRelevantJourneys: round(percentage, 3),
          currentAvgCallCount: round(avgCalls, 2),
          currentCompletionRate: round(completionRate, 3),
          signalIds: [...allSignalIds],
          mergeKey,
          firstDetectedAt: now,
          lastDetectedAt: now,
          statusHistory: [{ status: "detected", at: now, by: "system" }],
        };

    if (meetsSurface || existing) {
      result.push(gap);
      gapsByKey.delete(mergeKey);
    }
  }

  // Keep gaps that had no new signals
  for (const leftover of gapsByKey.values()) {
    result.push(leftover);
  }

  return result;
}

export function dismissGap(
  gap: CapabilityGap,
  reason: string,
  by: "human" | "agent" = "human",
  cooldownMs = gapEngineConfig.dismissalCooldownMs,
  now = nowMs(),
): CapabilityGap {
  return {
    ...gap,
    status: "dismissed",
    dismissalReason: reason,
    dismissedUntil: now + cooldownMs,
    statusHistory: [
      ...gap.statusHistory,
      { status: "dismissed", at: now, by, reason },
    ],
  };
}

export function transitionGap(
  gap: CapabilityGap,
  status: GapStatus,
  by: "system" | "human" | "agent" = "system",
  now = nowMs(),
): CapabilityGap {
  return {
    ...gap,
    status,
    statusHistory: [...gap.statusHistory, { status, at: now, by }],
  };
}
