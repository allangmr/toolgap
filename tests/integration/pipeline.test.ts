import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { resetDbForTests } from "@/lib/db/schema";
import { gapRepo, journeyRepo, sessionRepo, toolCallRepo } from "@/lib/db/repositories";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { simulate } from "@/lib/recommendations/simulation";
import { mergeSignalsIntoGaps } from "@/lib/gaps/engine";
import { runDetectors } from "@/lib/detectors/engine";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { registerStaticStoreTools } from "@/lib/webmcp/store-tools";
import { driveTool } from "@/lib/webmcp/driver";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";
import { approveRecommendation, publishRecommendation } from "@/lib/publishing/publish";
import { recommendationRepo, simulationRepo } from "@/lib/db/repositories";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { rewriteJourneySteps } from "@/lib/recommendations/simulation";
import { getTemplate } from "@/lib/recommendations/templates";

describe("seed → analysis → gap pipeline", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
  });

  it("seeds scenarios and detects capability gaps", async () => {
    await seedAllScenarios();
    const result = await runAnalysis();
    expect(result.journeysBuilt).toBeGreaterThan(0);

    const gaps = await gapRepo.all();
    expect(gaps.length).toBeGreaterThan(0);
    const compareGap = gaps.find((g) => g.type === "COMPARE");
    expect(compareGap).toBeDefined();
    expect(compareGap!.affectedSessions).toBeGreaterThanOrEqual(3);

    const failureGap = gaps.find((g) => g.type === "FAILURE_LOOP");
    expect(failureGap).toBeDefined();
    expect(buildRecommendation(failureGap!)).toBeNull();

    const filterGap = gaps.find((g) => g.type === "FILTER");
    expect(filterGap).toBeDefined();
    expect(buildRecommendation(filterGap!)).toBeNull();
  });

  it("re-seeding replaces observed data instead of appending", async () => {
    const first = await seedAllScenarios();
    const second = await seedAllScenarios();
    expect(second.sessions).toBe(first.sessions);
    const sessions = await sessionRepo.all();
    expect(sessions.length).toBe(first.sessions);
  });

  it("builds recommendation and simulation from a gap", async () => {
    await seedAllScenarios();
    await runAnalysis();
    const gap = (await gapRepo.all()).find((g) => g.type === "COMPARE");
    expect(gap).toBeDefined();
    const rec = buildRecommendation(gap!);
    expect(rec).not.toBeNull();
    expect(rec!.proposedToolName).toBe("compare_products");
    expect(rec!.explanation.generatedBy).toBe("deterministic");
    expect(rec!.estimatedBenefit.basis).toBe("estimated");

    const journeys = await journeyRepo.all();
    const supporting = journeys.filter((j) =>
      gap!.supportingSessionIds.includes(j.sessionId),
    );
    const sim = simulate(rec!, supporting);
    expect(sim.current.source).toBe("measured");
    expect(sim.proposed.source).toBe("estimated");
    expect(sim.proposed.calls).toBeLessThan(sim.current.calls);
  });
});

describe("webmcp registry instrumentation", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
    await ensureCatalogSeeded();
    await registerStaticStoreTools((def) => registry.registerTool(def));
  });

  it("records telemetry on driver invoke", async () => {
    const result = await driveTool("search_products", { category: "headphones" });
    expect(result.isError).toBeFalsy();
    await telemetryRecorder.flush();
    const events = await toolCallRepo.all();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.toolName).toBe("search_products");
    expect(events[0]!.surface).toBe("store");
    const sessions = await sessionRepo.all();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("publishes compare_products dynamically", async () => {
    await seedAllScenarios();
    await runAnalysis();
    const gap = (await gapRepo.all()).find((g) => g.type === "COMPARE")!;
    const rec = buildRecommendation(gap)!;
    await recommendationRepo.put(rec);
    const journeys = await journeyRepo.all();
    const sim = simulate(
      rec,
      journeys.filter((j) => gap.supportingSessionIds.includes(j.sessionId)),
    );
    await simulationRepo.put(sim);
    await approveRecommendation(rec.id);
    const cap = await publishRecommendation(rec.id);
    expect(cap.toolName).toBe("compare_products");
    expect(cap.status).toBe("active");

    const result = await driveTool("compare_products", {
      productIds: [SEED_PRODUCTS[0]!.id, SEED_PRODUCTS[1]!.id],
    });
    expect(result.isError).toBeFalsy();
    await telemetryRecorder.flush();
    const events = await toolCallRepo.byTool("compare_products");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.origin).toBe("dynamic");
    expect(events[0]!.capabilityId).toBe(cap.id);

    const resolvedGap = await gapRepo.get(gap.id);
    expect(resolvedGap?.status).toBe("resolved");
    expect(resolvedGap?.resolvedByCapabilityId).toBe(cap.id);
    expect(resolvedGap?.resolvedAt).toBeDefined();
  });
});

describe("simulation rewrite", () => {
  it("collapses get_product runs into compare tool", () => {
    const template = getTemplate("COMPARE");
    const rule = template.expectedJourneyRewrite({
      entity: "product",
      fields: ["name"],
      maxBatchSize: 10,
      toolName: "compare_products",
      description: "x",
    });
    const rewritten = rewriteJourneySteps(
      [
        {
          toolName: "search_products",
          entityIds: [],
          success: true,
          durationMs: 40,
          repeatIndex: 1,
          paramsHash: "h",
          sequenceIndex: 1,
        },
        {
          toolName: "get_product",
          entityIds: ["a"],
          success: true,
          durationMs: 40,
          repeatIndex: 1,
          paramsHash: "h",
          sequenceIndex: 2,
        },
        {
          toolName: "get_product",
          entityIds: ["b"],
          success: true,
          durationMs: 40,
          repeatIndex: 2,
          paramsHash: "h",
          sequenceIndex: 3,
        },
        {
          toolName: "get_product",
          entityIds: ["c"],
          success: true,
          durationMs: 40,
          repeatIndex: 3,
          paramsHash: "h",
          sequenceIndex: 4,
        },
      ],
      rule,
    );
    expect(rewritten.map((s) => s.toolName)).toEqual([
      "search_products",
      "compare_products",
    ]);
  });
});

describe("gap engine thresholds", () => {
  it("does not surface gaps with insufficient sessions", () => {
    const journeys = Array.from({ length: 2 }, (_, i) => ({
      id: `j${i}`,
      sessionId: `s${i}`,
      steps: [],
      signature: "x",
      startedAt: 1,
      endedAt: 2,
      durationMs: 1,
      callCount: 6,
      state: "final" as const,
      lastEventSeq: 6,
      outcome: "abandoned" as const,
      inferredIntent: "comparison" as const,
      frictionScore: 3,
      repeatedToolCounts: {},
      distinctEntityCounts: {},
    }));
    const signals = journeys.flatMap((j) =>
      runDetectors(
        {
          ...j,
          steps: [
            {
              toolName: "search_products",
              entityIds: [],
              success: true,
              durationMs: 1,
              repeatIndex: 1,
              paramsHash: "h",
              sequenceIndex: 1,
            },
            {
              toolName: "get_product",
              entityIds: ["a"],
              success: true,
              durationMs: 1,
              repeatIndex: 1,
              paramsHash: "h",
              sequenceIndex: 2,
            },
            {
              toolName: "get_product",
              entityIds: ["b"],
              success: true,
              durationMs: 1,
              repeatIndex: 2,
              paramsHash: "h",
              sequenceIndex: 3,
            },
            {
              toolName: "get_product",
              entityIds: ["c"],
              success: true,
              durationMs: 1,
              repeatIndex: 3,
              paramsHash: "h",
              sequenceIndex: 4,
            },
          ],
        },
        { journeys },
      ),
    );
    const gaps = mergeSignalsIntoGaps(signals, journeys, []);
    expect(gaps.length).toBe(0);
  });
});
