import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { journeyRepo, sessionRepo } from "@/lib/db/repositories";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { registerStaticStoreTools } from "@/lib/webmcp/store-tools";
import { driveSequence } from "@/lib/webmcp/driver";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";

const p = SEED_PRODUCTS;

/**
 * Every session here is produced by the real recorder path — driveSequence goes
 * through ToolRegistry.invokeInternal → nextCallContext → telemetryRecorder,
 * exactly as an external WebMCP agent does. Nothing is hand-constructed and no
 * seed writer runs, so sessions stay `active` the way production leaves them.
 */
async function bootStore(): Promise<void> {
  const db = resetDbForTests();
  await db.delete();
  resetDbForTests();
  resetSessionizer();
  const registry = resetRegistryForTests();
  registry.setAdapterForTests(createNoopAdapter());
  await ensureCatalogSeeded();
  await registerStaticStoreTools((def) => registry.registerTool(def));
}

const comparisonDetour = [
  { tool: "search_products", params: { category: "headphones" } },
  { tool: "get_product", params: { productId: p[0]!.id } },
  { tool: "get_product", params: { productId: p[1]!.id } },
  { tool: "get_product", params: { productId: p[2]!.id } },
  { tool: "get_availability", params: { productId: p[0]!.id } },
  { tool: "get_availability", params: { productId: p[1]!.id } },
  { tool: "get_availability", params: { productId: p[2]!.id } },
];

describe("production-shaped session reaches analysis", () => {
  beforeEach(bootStore);

  it("builds a journey for a session that is still active", async () => {
    await driveSequence(comparisonDetour);

    const sessions = await sessionRepo.all();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("active");
    expect(sessions[0]!.endedAt).toBeUndefined();

    await runAnalysis();

    const journeys = await journeyRepo.all();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.sessionId).toBe(sessions[0]!.id);
    expect(journeys[0]!.callCount).toBe(7);
  });
});
