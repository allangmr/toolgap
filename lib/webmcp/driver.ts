import { getRegistry } from "./registry";
import type { McpToolResult } from "./types";

/** Dev/test agent driver — invokes tools through the same instrumentation path. */
export async function driveTool(
  name: string,
  params: Record<string, unknown> = {},
): Promise<McpToolResult> {
  return getRegistry().invoke(name, params);
}

export async function driveSequence(
  steps: Array<{ tool: string; params?: Record<string, unknown>; delayMs?: number }>,
): Promise<McpToolResult[]> {
  const results: McpToolResult[] = [];
  for (const step of steps) {
    if (step.delayMs) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
    results.push(await driveTool(step.tool, step.params ?? {}));
  }
  return results;
}
