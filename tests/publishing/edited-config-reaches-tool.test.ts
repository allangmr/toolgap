import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { resetDbForTests } from "@/lib/db/schema";
import { gapRepo, recommendationRepo } from "@/lib/db/repositories";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { approveRecommendation, publishRecommendation } from "@/lib/publishing/publish";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { getRegistry, resetRegistryForTests } from "@/lib/webmcp/registry";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { driveTool } from "@/lib/webmcp/driver";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import type { CapabilityGap } from "@/lib/shared/types";

function compareGap(): CapabilityGap {
  return {
    id: "g-edit",
    title: "Missing compare capability",
    type: "COMPARE",
    entityType: "product",
    detectedIntent: "comparison",
    status: "detected",
    confidence: 0.8,
    severity: "high",
    supportingSessionIds: ["s1", "s2", "s3"],
    affectedSessions: 3,
    percentageOfRelevantJourneys: 0.5,
    currentAvgCallCount: 6,
    currentCompletionRate: 0,
    signalIds: ["f1"],
    mergeKey: "COMPARE:product:get_product",
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [{ status: "detected", at: 1, by: "system" }],
  };
}

describe("an edited config reaches the published WebMCP tool", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
    await ensureCatalogSeeded();
    await gapRepo.put(compareGap());
  });

  it("registers the human description, name, batch cap, and field selection", async () => {
    const built = buildRecommendation(compareGap(), {
      override: {
        toolName: "compare_gear",
        description: "Compare commuting headphones on battery and price.",
        maxBatchSize: 2,
        fields: ["id", "name", "price"],
      },
    });
    if (!built.ok) throw new Error("expected an editable COMPARE recommendation");
    await recommendationRepo.put(built.recommendation);
    await approveRecommendation(built.recommendation.id);
    const cap = await publishRecommendation(built.recommendation.id);

    expect(cap.toolName).toBe("compare_gear");
    expect(cap.config).toMatchObject({ maxBatchSize: 2 });

    const registered = getRegistry()
      .listTools()
      .find((t) => t.name === "compare_gear");
    expect(registered).toBeDefined();
    expect(registered!.description).toBe(
      "Compare commuting headphones on battery and price.",
    );

    const ids = [SEED_PRODUCTS[0]!.id, SEED_PRODUCTS[1]!.id];
    const ok = await driveTool("compare_gear", { productIds: ids });
    expect(ok.isError).toBeFalsy();
    const payload = JSON.parse(ok.content[0]!.text) as {
      products: Array<Record<string, unknown>>;
    };
    expect(Object.keys(payload.products[0]!).sort()).toEqual([
      "id",
      "name",
      "price",
    ]);

    const overCap = await driveTool("compare_gear", {
      productIds: [...ids, SEED_PRODUCTS[2]!.id],
    });
    expect(overCap.isError).toBe(true);
  });
});
