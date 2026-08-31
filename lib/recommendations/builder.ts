import { createId, nowMs, round } from "@/lib/shared";
import { safeJsonSchema } from "@/lib/telemetry/redaction";
import type {
  Actor,
  CapabilityGap,
  GapType,
  Recommendation,
  TemplateType,
} from "@/lib/shared/types";
import {
  defaultCompareFields,
  getTemplate,
} from "./templates";

export const GAP_TO_TEMPLATE: Record<GapType, TemplateType | null> = {
  COMPARE: "COMPARE",
  AVAILABILITY_BATCH: "AVAILABILITY_BATCH",
  BULK_READ: "BULK_READ",
  FILTER: null,
  FAILURE_LOOP: null,
  UNKNOWN: null,
};

export function templateForGapType(type: GapType): TemplateType | null {
  return GAP_TO_TEMPLATE[type];
}

export function proposeToolName(
  preferred: string,
  taken: Set<string>,
): string {
  if (!taken.has(preferred)) return preferred;
  let i = 2;
  while (taken.has(`${preferred}_v${i}`)) i += 1;
  return `${preferred}_v${i}`;
}

export function buildRecommendation(
  gap: CapabilityGap,
  options: {
    takenToolNames?: string[];
    createdBy?: Actor;
  } = {},
): Recommendation | null {
  const templateType = templateForGapType(gap.type);
  if (!templateType) return null;

  const template = getTemplate(templateType);
  const taken = new Set(options.takenToolNames ?? []);
  const preferred = template.defaultToolName(gap.entityType);
  const toolName = proposeToolName(preferred, taken);

  let config: Record<string, unknown>;
  if (templateType === "COMPARE") {
    config = {
      entity: "product",
      fields: defaultCompareFields(),
      maxBatchSize: 10,
      toolName,
      description: `Compare multiple products in one call. Suggested by ToolGap from ${gap.affectedSessions} sessions.`,
    };
  } else if (templateType === "AVAILABILITY_BATCH") {
    config = {
      entity: "inventory",
      maxBatchSize: 20,
      toolName,
      description: `Batch-check availability for multiple products. Suggested from ${gap.affectedSessions} sessions.`,
    };
  } else {
    config = {
      entity: "product",
      fields: defaultCompareFields(),
      maxBatchSize: 20,
      toolName,
      description: `Bulk-read products. Suggested from ${gap.affectedSessions} sessions.`,
    };
  }

  const parsed = template.configSchema.safeParse(config);
  if (!parsed.success) return null;
  const validConfig = parsed.data as Record<string, unknown>;

  const inputSchema = template.buildInputSchema(validConfig as never);
  const proposedCalls = 2; // search + new capability (typical)
  const callReduction = Math.max(0, gap.currentAvgCallCount - proposedCalls);

  const explanation = buildExplanation(gap, toolName, callReduction);

  const now = nowMs();
  return {
    id: createId(),
    gapId: gap.id,
    templateType,
    proposedToolName: toolName,
    description: String(validConfig.description),
    inputSchemaJson: safeJsonSchema(inputSchema),
    outputShapeJson: template.outputShape(validConfig as never),
    templateConfig: validConfig,
    estimatedBenefit: {
      callReduction: round(callReduction, 2),
      basis: "estimated",
    },
    risks: [...template.risks],
    explanation: { text: explanation, generatedBy: "deterministic" },
    status: "ready",
    createdBy: options.createdBy ?? "system",
    createdAt: now,
    updatedAt: now,
  };
}

function buildExplanation(
  gap: CapabilityGap,
  toolName: string,
  callReduction: number,
): string {
  return [
    `ToolGap detected a ${gap.type} gap affecting ${gap.affectedSessions} sessions`,
    `(${round(gap.percentageOfRelevantJourneys * 100, 1)}% of relevant journeys).`,
    `Current average call count is ${gap.currentAvgCallCount} with completion rate`,
    `${round(gap.currentCompletionRate * 100, 1)}%.`,
    `Confidence ${round(gap.confidence, 2)} (inferred intent: ${gap.detectedIntent}).`,
    `Proposed capability \`${toolName}\` is estimated to reduce calls by ~${round(callReduction, 1)}`,
    `per affected journey (estimated, based on deterministic rewrite).`,
  ].join(" ");
}
