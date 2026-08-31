"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import {
  gapRepo,
  journeyRepo,
  publishedRepo,
  recommendationRepo,
  sessionRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { simulate } from "@/lib/recommendations/simulation";
import { dismissGap, transitionGap } from "@/lib/gaps/engine";
import { computeToolMetrics } from "@/lib/analytics/metrics";
import { groupJourneyPatterns } from "@/lib/journeys/reconstruct";
import { getRegistry } from "@/lib/webmcp/registry";
import { simulationRepo } from "@/lib/db/repositories";
import { storeToolDefinitions } from "@/lib/webmcp/store-tools";

/**
 * Registers ToolGap dashboard WebMCP tools.
 * Publishing is intentionally NOT exposed to agents.
 */
export function DashboardWebmcpTools() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let cancelled = false;

    void (async () => {
      const registry = getRegistry();
      await registry.whenReady();
      if (cancelled) return;

      const tools = [
        {
          name: "get_agent_summary",
          description: "High-level ToolGap summary: sessions, journeys, gaps, published capabilities.",
          inputSchema: z.object({}),
          handler: async () => {
            const [sessions, journeys, gaps, published] = await Promise.all([
              sessionRepo.all(),
              journeyRepo.all(),
              gapRepo.all(),
              publishedRepo.all(),
            ]);
            return {
              sessions: sessions.length,
              journeys: journeys.length,
              openGaps: gaps.filter((g) => g.status !== "dismissed" && g.status !== "resolved").length,
              published: published.filter((p) => p.status === "active").length,
              frictionRate:
                journeys.length === 0
                  ? 0
                  : journeys.filter((j) => j.frictionScore > 0).length / journeys.length,
            };
          },
        },
        {
          name: "list_agent_sessions",
          description: "List recent agent sessions observed by ToolGap.",
          inputSchema: z.object({ limit: z.number().optional() }),
          handler: async (params: Record<string, unknown>) => {
            const sessions = await sessionRepo.all();
            return sessions.slice(0, (params.limit as number) ?? 20);
          },
        },
        {
          name: "get_agent_session",
          description: "Get one agent session and its tool calls.",
          inputSchema: z.object({ sessionId: z.string() }),
          handler: async (params: Record<string, unknown>) => {
            const session = await sessionRepo.get(params.sessionId as string);
            const calls = await toolCallRepo.bySession(params.sessionId as string);
            return { session, calls };
          },
        },
        {
          name: "list_agent_journeys",
          description: "List reconstructed agent journeys and common patterns.",
          inputSchema: z.object({}),
          handler: async () => {
            const journeys = await journeyRepo.all();
            return { journeys, patterns: groupJourneyPatterns(journeys) };
          },
        },
        {
          name: "get_agent_journey",
          description: "Get a single journey by id.",
          inputSchema: z.object({ journeyId: z.string() }),
          handler: async (params: Record<string, unknown>) => journeyRepo.get(params.journeyId as string),
        },
        {
          name: "get_tool_performance",
          description: "Get performance metrics for WebMCP tools on the demo store surface.",
          inputSchema: z.object({ toolName: z.string().optional() }),
          handler: async (params: Record<string, unknown>) => {
            const events = await toolCallRepo.storeSurface();
            const metrics = computeToolMetrics(
              events,
              storeToolDefinitions.map((t) => t.name),
            );
            if (params.toolName) {
              return metrics.find((m) => m.toolName === params.toolName) ?? null;
            }
            return metrics;
          },
        },
        {
          name: "list_capability_gaps",
          description: "List detected capability gaps.",
          inputSchema: z.object({}),
          handler: async () => gapRepo.all(),
        },
        {
          name: "get_capability_gap",
          description: "Get a capability gap by id.",
          inputSchema: z.object({ gapId: z.string() }),
          handler: async (params: Record<string, unknown>) => gapRepo.get(params.gapId as string),
        },
        {
          name: "list_recommendations",
          description: "List capability recommendations.",
          inputSchema: z.object({}),
          handler: async () => recommendationRepo.all(),
        },
        {
          name: "get_recommendation",
          description: "Get a recommendation by id.",
          inputSchema: z.object({ recommendationId: z.string() }),
          handler: async (params: Record<string, unknown>) =>
            recommendationRepo.get(params.recommendationId as string),
        },
        {
          name: "simulate_recommendation",
          description: "Simulate a recommendation against supporting journeys.",
          inputSchema: z.object({ recommendationId: z.string() }),
          handler: async (params: Record<string, unknown>) => {
            const rec = await recommendationRepo.get(params.recommendationId as string);
            if (!rec) throw Object.assign(new Error("Not found"), { category: "not_found" });
            const gap = await gapRepo.get(rec.gapId);
            const journeys = await journeyRepo.all();
            const supporting = journeys.filter((j) =>
              gap?.supportingSessionIds.includes(j.sessionId),
            );
            const sim = simulate(rec, supporting);
            await simulationRepo.put(sim);
            await recommendationRepo.put({
              ...rec,
              status: "simulated",
              updatedAt: Date.now(),
            });
            if (gap) await gapRepo.put(transitionGap(gap, "simulated", "agent"));
            return sim;
          },
        },
        {
          name: "list_published_capabilities",
          description: "List published dynamic WebMCP capabilities.",
          inputSchema: z.object({}),
          handler: async () => publishedRepo.all(),
        },
        {
          name: "create_recommendation",
          description:
            "Create a structured recommendation for a gap using an approved template. Does not publish.",
          inputSchema: z.object({ gapId: z.string() }),
          handler: async (params: Record<string, unknown>) => {
            const gap = await gapRepo.get(params.gapId as string);
            if (!gap) throw Object.assign(new Error("Gap not found"), { category: "not_found" });
            const published = await publishedRepo.all();
            const result = buildRecommendation(gap, {
              takenToolNames: published.map((p) => p.toolName),
              createdBy: "agent",
            });
            if (!result.ok) {
              throw new Error(
                result.reason === "no_template"
                  ? "No template for this gap type"
                  : result.issues.join(" "),
              );
            }
            const rec = result.recommendation;
            const existing = await recommendationRepo.byGap(gap.id);
            if (existing) {
              rec.id = existing.id;
            }
            await recommendationRepo.put(rec);
            await gapRepo.put(
              transitionGap(
                { ...gap, recommendationId: rec.id },
                "recommendation_ready",
                "agent",
              ),
            );
            return rec;
          },
        },
        {
          name: "dismiss_recommendation",
          description: "Dismiss a recommendation and its gap. Does not publish or unregister tools.",
          inputSchema: z.object({
            recommendationId: z.string(),
            reason: z.string(),
          }),
          handler: async (params: Record<string, unknown>) => {
            const rec = await recommendationRepo.get(params.recommendationId as string);
            if (!rec) throw Object.assign(new Error("Not found"), { category: "not_found" });
            await recommendationRepo.put({
              ...rec,
              status: "dismissed",
              updatedAt: Date.now(),
            });
            const gap = await gapRepo.get(rec.gapId);
            if (gap) {
              await gapRepo.put(
                dismissGap(gap, params.reason as string, "agent"),
              );
            }
            return { ok: true };
          },
        },
        {
          name: "mark_recommendation_for_review",
          description: "Mark a recommendation as ready for human review.",
          inputSchema: z.object({ recommendationId: z.string() }),
          handler: async (params: Record<string, unknown>) => {
            const rec = await recommendationRepo.get(params.recommendationId as string);
            if (!rec) throw Object.assign(new Error("Not found"), { category: "not_found" });
            const updated = { ...rec, status: "ready" as const, updatedAt: Date.now() };
            await recommendationRepo.put(updated);
            return updated;
          },
        },
      ];

      for (const tool of tools) {
        if (registry.has(tool.name)) continue;
        try {
          await registry.registerTool({
            ...tool,
            version: "1.0.0",
            surface: "dashboard",
            origin: "static",
            readOnly: !["create_recommendation", "dismiss_recommendation", "mark_recommendation_for_review", "simulate_recommendation"].includes(tool.name),
          });
        } catch (error) {
          console.warn("[toolgap] dashboard tool register failed", tool.name, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
