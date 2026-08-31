import { createId } from "@/lib/shared";
import { hashParams, paramKeyPaths } from "@/lib/telemetry/redaction";
import type {
  InferredIntent,
  Journey,
  JourneyOutcome,
  JourneyState,
  JourneyStep,
  ToolCallEvent,
} from "@/lib/shared/types";

export function buildJourneyFromEvents(
  sessionId: string,
  events: ToolCallEvent[],
  options: { state?: JourneyState } = {},
): Journey | null {
  if (events.length === 0) return null;
  const state = options.state ?? "final";

  const sorted = [...events].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const steps: JourneyStep[] = [];
  const toolRunCounts = new Map<string, number>();

  for (const event of sorted) {
    const run = (toolRunCounts.get(event.toolName) ?? 0) + 1;
    toolRunCounts.set(event.toolName, run);
    steps.push({
      toolName: event.toolName,
      entityIds: event.entityIds ?? event.resultMeta.entityIds ?? [],
      success: event.success,
      durationMs: event.durationMs,
      repeatIndex: run,
      paramsHash: hashParams(event.input),
      paramsKeys: event.inputKeys ?? paramKeyPaths(event.input),
      sequenceIndex: event.sequenceIndex,
      errorCategory: event.errorCategory,
    });
  }

  const signature = buildSignature(steps);
  const startedAt = sorted[0]!.timestamp;
  const endedAt = sorted[sorted.length - 1]!.timestamp + sorted[sorted.length - 1]!.durationMs;
  const lastEventSeq = sorted[sorted.length - 1]!.sequenceIndex;
  const outcome = classifyOutcome(steps, state);
  const inferredIntent = inferIntent(steps, signature);
  const repeatedToolCounts: Record<string, number> = {};
  for (const [tool, count] of toolRunCounts) {
    if (count > 1) repeatedToolCounts[tool] = count;
  }

  const distinctEntityCounts: Record<string, number> = {};
  const entitySets = new Map<string, Set<string>>();
  for (const step of steps) {
    const key = step.toolName.replace(/^get_/, "").replace(/s$/, "");
    if (!entitySets.has(key)) entitySets.set(key, new Set());
    for (const id of step.entityIds) entitySets.get(key)!.add(id);
  }
  for (const [key, set] of entitySets) {
    if (set.size > 0) distinctEntityCounts[key] = set.size;
  }

  return {
    id: createId(),
    sessionId,
    steps,
    signature,
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    callCount: steps.length,
    state,
    lastEventSeq,
    outcome,
    inferredIntent,
    frictionScore: 0,
    repeatedToolCounts,
    distinctEntityCounts,
  };
}

export function buildSignature(steps: JourneyStep[]): string {
  if (steps.length === 0) return "";
  const parts: string[] = [];
  let current = steps[0]!.toolName;
  let count = 1;
  for (let i = 1; i < steps.length; i++) {
    const name = steps[i]!.toolName;
    if (name === current) {
      count += 1;
    } else {
      parts.push(count > 1 ? `${current}×${count}` : current);
      current = name;
      count = 1;
    }
  }
  parts.push(count > 1 ? `${current}×${count}` : current!);
  return parts.join(">");
}

function classifyOutcome(steps: JourneyStep[], state: JourneyState): JourneyOutcome {
  const settled = classifySettledOutcome(steps);
  if (state === "final") return settled;

  // The session is still open, so only verdicts the calls already prove can
  // stand. Anything else is in progress, never abandoned.
  if (settled === "failed") return "failed";
  if (steps.some((s) => s.toolName === "complete_checkout" && s.success)) {
    return "completed";
  }
  return "in_progress";
}

function classifySettledOutcome(steps: JourneyStep[]): JourneyOutcome {
  if (steps.length === 0) return "abandoned";
  const last = steps[steps.length - 1]!;
  if (!last.success) return "failed";
  if (
    last.toolName === "complete_checkout" ||
    last.toolName === "add_to_cart" ||
    (last.toolName === "get_product" && steps.length <= 2)
  ) {
    return "completed";
  }
  if (steps.some((s) => s.toolName === "complete_checkout" && s.success)) {
    return "completed";
  }
  // Failed tools in the middle without recovery
  const failures = steps.filter((s) => !s.success);
  if (failures.length >= 3) return "failed";
  return "abandoned";
}

/**
 * A journey counts toward completion and drop-off rates only once its outcome
 * is settled. Provisional snapshots would otherwise read as drop-offs.
 */
export function isSettled(journey: Pick<Journey, "outcome">): boolean {
  return journey.outcome !== "in_progress";
}

export function completionRate(journeys: Array<Pick<Journey, "outcome">>): number {
  const settled = journeys.filter(isSettled);
  if (settled.length === 0) return 0;
  return settled.filter((j) => j.outcome === "completed").length / settled.length;
}

export function inferIntent(steps: JourneyStep[], signature: string): InferredIntent {
  const tools = steps.map((s) => s.toolName);
  if (tools.includes("complete_checkout") || tools.includes("add_to_cart")) {
    return "purchase";
  }
  const productGets = steps.filter((s) => s.toolName === "get_product");
  const distinctProducts = new Set(productGets.flatMap((s) => s.entityIds));
  if (distinctProducts.size >= 3 || signature.includes("get_product×")) {
    return "comparison";
  }
  if (tools.includes("search_products") && productGets.length <= 1) {
    return "lookup";
  }
  if (tools.includes("search_products")) return "browse";
  if (productGets.length === 1) return "lookup";
  return "unknown";
}

export function groupJourneyPatterns(
  journeys: Journey[],
): Array<{
  signature: string;
  journeyCount: number;
  avgCalls: number;
  avgDurationMs: number;
  completionRate: number;
  inferredIntent: InferredIntent;
  journeyIds: string[];
}> {
  const map = new Map<string, Journey[]>();
  for (const journey of journeys) {
    const list = map.get(journey.signature) ?? [];
    list.push(journey);
    map.set(journey.signature, list);
  }

  return [...map.entries()]
    .map(([signature, list]) => {
      const intentCounts = new Map<InferredIntent, number>();
      for (const j of list) {
        intentCounts.set(j.inferredIntent, (intentCounts.get(j.inferredIntent) ?? 0) + 1);
      }
      let inferredIntent: InferredIntent = "unknown";
      let best = 0;
      for (const [intent, count] of intentCounts) {
        if (count > best) {
          best = count;
          inferredIntent = intent;
        }
      }
      return {
        signature,
        journeyCount: list.length,
        avgCalls: list.reduce((s, j) => s + j.callCount, 0) / list.length,
        avgDurationMs: list.reduce((s, j) => s + j.durationMs, 0) / list.length,
        completionRate: completionRate(list),
        inferredIntent,
        journeyIds: list.map((j) => j.id),
      };
    })
    .sort((a, b) => b.journeyCount - a.journeyCount);
}
