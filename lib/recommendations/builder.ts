import type { z } from "zod";
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
  effectiveFields,
  getTemplate,
} from "./templates";

/**
 * The keys a human may change. `entity` is deliberately absent because it
 * selects which handler the template builds.
 */
export interface ConfigOverride {
  toolName?: string;
  description?: string;
  maxBatchSize?: number;
  fields?: string[];
}

export type BuildResult =
  | { ok: true; recommendation: Recommendation }
  | { ok: false; reason: "no_template" }
  | { ok: false; reason: "invalid_config"; issues: string[] };

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

const DEFAULT_CONFIG: Record<
  TemplateType,
  (gap: CapabilityGap, toolName: string) => Record<string, unknown>
> = {
  COMPARE: (gap, toolName) => ({
    entity: "product",
    fields: defaultCompareFields(),
    maxBatchSize: 10,
    toolName,
    description:
      "Compare multiple products in one call using selected product fields. Use this when the user needs to evaluate two or more products side by side.",
  }),
  AVAILABILITY_BATCH: (gap, toolName) => ({
    entity: "inventory",
    maxBatchSize: 20,
    toolName,
    description: `Batch-check availability for multiple products. Suggested from ${gap.affectedSessions} sessions.`,
  }),
  BULK_READ: (gap, toolName) => ({
    entity: "product",
    fields: defaultCompareFields(),
    maxBatchSize: 20,
    toolName,
    description: `Bulk-read products. Suggested from ${gap.affectedSessions} sessions.`,
  }),
};

function overrideEntries(override?: ConfigOverride): Record<string, unknown> {
  if (!override) return {};
  const out: Record<string, unknown> = {};
  if (override.description !== undefined) out.description = override.description;
  if (override.maxBatchSize !== undefined) out.maxBatchSize = override.maxBatchSize;
  if (override.fields !== undefined) out.fields = effectiveFields(override.fields);
  return out;
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function buildRecommendation(
  gap: CapabilityGap,
  options: {
    takenToolNames?: string[];
    createdBy?: Actor;
    override?: ConfigOverride;
  } = {},
): BuildResult {
  const templateType = templateForGapType(gap.type);
  if (!templateType) return { ok: false, reason: "no_template" };

  const template = getTemplate(templateType);
  const taken = new Set(options.takenToolNames ?? []);
  const requestedName = options.override?.toolName?.trim();

  let toolName: string;
  if (requestedName) {
    if (taken.has(requestedName)) {
      return {
        ok: false,
        reason: "invalid_config",
        issues: [
          `toolName: "${requestedName}" is already published. Pick a different name.`,
        ],
      };
    }
    toolName = requestedName;
  } else {
    toolName = proposeToolName(template.defaultToolName(gap.entityType), taken);
  }

  const config = {
    ...DEFAULT_CONFIG[templateType](gap, toolName),
    ...overrideEntries(options.override),
    toolName,
  };

  const parsed = template.configSchema.safeParse(config);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_config",
      issues: formatIssues(parsed.error),
    };
  }
  const validConfig = parsed.data as Record<string, unknown>;

  const inputSchema = template.buildInputSchema(validConfig as never);
  const proposedCalls = 2; // search + new capability (typical)
  const callReduction = Math.max(0, gap.currentAvgCallCount - proposedCalls);

  const explanation = buildExplanation(gap, toolName, callReduction);

  const now = nowMs();
  return {
    ok: true,
    recommendation: {
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
    },
  };
}

export function configOverrideFrom(
  templateConfig: Record<string, unknown>,
): ConfigOverride {
  const override: ConfigOverride = {
    toolName: String(templateConfig.toolName ?? ""),
    description: String(templateConfig.description ?? ""),
    maxBatchSize: Number(templateConfig.maxBatchSize ?? 0),
  };
  if (Array.isArray(templateConfig.fields)) {
    override.fields = templateConfig.fields.map(String);
  }
  return override;
}

function buildExplanation(
  gap: CapabilityGap,
  toolName: string,
  callReduction: number,
): string {
  return [
    `ToolGap detected a ${gap.type} gap affecting ${gap.affectedSessions} sessions`,
    `(${round(gap.percentageOfRelevantJourneys * 100, 1)}% of relevant journeys).`,
    `Current average call count is ${gap.currentAvgCallCount} with task completion`,
    gap.currentCompletionRate === null
      ? "not measured."
      : `${round(gap.currentCompletionRate * 100, 1)}%.`,
    `Confidence ${round(gap.confidence, 2)} (inferred intent: ${gap.detectedIntent}).`,
    `Proposed capability \`${toolName}\` is estimated to reduce calls by ~${round(callReduction, 1)}`,
    `per affected journey (estimated, based on deterministic rewrite).`,
  ].join(" ");
}
