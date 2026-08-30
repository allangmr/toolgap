import type { ToolCallEvent } from "@/lib/shared/types";
import { mean, percentile, round } from "@/lib/shared";

export interface ToolMetrics {
  toolName: string;
  calls: number;
  uniqueSessions: number;
  successRate: number;
  failureRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  origin: "static" | "dynamic" | "mixed";
  versions: string[];
  errorDistribution: Record<string, number>;
  unused: boolean;
}

export function computeToolMetrics(
  events: ToolCallEvent[],
  knownTools: string[] = [],
): ToolMetrics[] {
  const storeEvents = events.filter((e) => e.surface === "store");
  const byTool = new Map<string, ToolCallEvent[]>();
  for (const event of storeEvents) {
    const list = byTool.get(event.toolName) ?? [];
    list.push(event);
    byTool.set(event.toolName, list);
  }
  for (const name of knownTools) {
    if (!byTool.has(name)) byTool.set(name, []);
  }

  return [...byTool.entries()]
    .map(([toolName, list]) => {
      const successes = list.filter((e) => e.success).length;
      const latencies = list.map((e) => e.durationMs).sort((a, b) => a - b);
      const sessions = new Set(list.map((e) => e.sessionId));
      const origins = new Set(list.map((e) => e.origin));
      const versions = [...new Set(list.map((e) => e.toolVersion))];
      const errorDistribution: Record<string, number> = {};
      for (const e of list) {
        if (!e.success && e.errorCategory) {
          errorDistribution[e.errorCategory] =
            (errorDistribution[e.errorCategory] ?? 0) + 1;
        }
      }
      return {
        toolName,
        calls: list.length,
        uniqueSessions: sessions.size,
        successRate: list.length === 0 ? 0 : round(successes / list.length, 3),
        failureRate:
          list.length === 0 ? 0 : round((list.length - successes) / list.length, 3),
        avgLatencyMs: round(mean(latencies), 1),
        p50LatencyMs: round(percentile(latencies, 50), 1),
        p95LatencyMs: round(percentile(latencies, 95), 1),
        origin:
          origins.size === 0
            ? ("static" as const)
            : origins.size > 1
              ? ("mixed" as const)
              : ([...origins][0] as "static" | "dynamic"),
        versions,
        errorDistribution,
        unused: list.length === 0,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

export function coOccurrence(
  events: ToolCallEvent[],
  toolName: string,
): Array<{ tool: string; count: number }> {
  const bySession = new Map<string, Set<string>>();
  for (const e of events.filter((x) => x.surface === "store")) {
    const set = bySession.get(e.sessionId) ?? new Set();
    set.add(e.toolName);
    bySession.set(e.sessionId, set);
  }
  const counts = new Map<string, number>();
  for (const tools of bySession.values()) {
    if (!tools.has(toolName)) continue;
    for (const t of tools) {
      if (t === toolName) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}
