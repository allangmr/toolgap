import { publishedRepo, sessionRepo, settingsRepo } from "@/lib/db/repositories";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { nowMs } from "@/lib/shared";
import type { PublishedCapability } from "@/lib/shared/types";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";
import { peekSessionizer, resetSessionizer } from "@/lib/sessions/sessionizer";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { driveSequence } from "@/lib/webmcp/driver";
import { getRegistry } from "@/lib/webmcp/registry";
import { registerStaticStoreTools } from "@/lib/webmcp/store-tools";
import { registerPublishedCapability } from "@/lib/publishing/publish";

const p = SEED_PRODUCTS;

async function ensureSeedRuntime(): Promise<void> {
  await ensureCatalogSeeded();
  const registry = getRegistry();
  await registry.whenReady();
  if (!registry.has("search_products")) {
    await registerStaticStoreTools((def) => registry.registerTool(def));
  }
}

async function driveScenario(
  steps: Array<{ tool: string; params?: Record<string, unknown> }>,
): Promise<void> {
  resetSessionizer();
  await driveSequence(steps);
  await telemetryRecorder.flush();
  const state = peekSessionizer();
  if (state) {
    const session = await sessionRepo.get(state.sessionId);
    if (session) {
      session.status = "expired";
      session.endedAt = session.lastActivityAt;
      await sessionRepo.upsert(session);
    }
  }
  resetSessionizer();
}

export async function seedScenarioDirectLookup(): Promise<void> {
  await driveScenario([
    { tool: "search_products", params: { q: "laptop" } },
    { tool: "get_product", params: { productId: p[6]!.id } },
    { tool: "add_to_cart", params: { productId: p[6]!.id, qty: 1 } },
    { tool: "complete_checkout", params: {} },
  ]);
}

export async function seedScenarioComparisonDetour(): Promise<void> {
  const ids = [p[0]!.id, p[1]!.id, p[2]!.id];
  await driveScenario([
    { tool: "search_products", params: { category: "headphones" } },
    { tool: "get_product", params: { productId: ids[0]! } },
    { tool: "get_product", params: { productId: ids[1]! } },
    { tool: "get_product", params: { productId: ids[2]! } },
    { tool: "get_availability", params: { productId: ids[0]! } },
    { tool: "get_availability", params: { productId: ids[1]! } },
    { tool: "get_availability", params: { productId: ids[2]! } },
  ]);
}

export async function seedScenarioRepeatedAvailability(): Promise<void> {
  const ids = [p[13]!.id, p[14]!.id, p[15]!.id, p[16]!.id];
  await driveScenario([
    { tool: "search_products", params: { category: "chairs" } },
    ...ids.map((id) => ({
      tool: "get_availability",
      params: { productId: id },
    })),
  ]);
}

export async function seedScenarioFailureLoop(): Promise<void> {
  await driveScenario([
    { tool: "search_products", params: { q: "missing-sku" } },
    { tool: "get_product", params: { productId: "does-not-exist" } },
    { tool: "get_product", params: { productId: "does-not-exist" } },
    { tool: "get_product", params: { productId: "does-not-exist" } },
  ]);
}

export async function seedScenarioEfficientCheckout(): Promise<void> {
  await driveScenario([
    { tool: "get_product", params: { productId: p[20]!.id } },
    { tool: "get_availability", params: { productId: p[20]!.id } },
    { tool: "add_to_cart", params: { productId: p[20]!.id, qty: 1 } },
    { tool: "get_cart", params: {} },
    { tool: "complete_checkout", params: {} },
  ]);
}

export async function seedScenarioFilterIteration(): Promise<void> {
  await driveScenario([
    { tool: "search_products", params: { category: "laptops", maxPrice: 2000 } },
    { tool: "get_product", params: { productId: p[7]!.id } },
    { tool: "search_products", params: { category: "laptops", maxPrice: 1500 } },
    { tool: "get_product", params: { productId: p[10]!.id } },
    { tool: "search_products", params: { category: "laptops", maxPrice: 1000 } },
    { tool: "get_product", params: { productId: p[8]!.id } },
  ]);
}

export async function seedScenarioMultiProductInspection(): Promise<void> {
  const ids = [p[21]!.id, p[22]!.id, p[23]!.id, p[24]!.id];
  await driveScenario([
    { tool: "search_products", params: { category: "cameras" } },
    ...ids.map((id) => ({
      tool: "get_product",
      params: { productId: id },
    })),
  ]);
}

function postPublishSteps(cap: PublishedCapability): Array<{
  tool: string;
  params?: Record<string, unknown>;
}> {
  const ids = [p[0]!.id, p[1]!.id, p[2]!.id];
  if (cap.templateType === "AVAILABILITY_BATCH") {
    const chairIds = [p[13]!.id, p[14]!.id, p[15]!.id];
    return [
      { tool: "search_products", params: { category: "chairs" } },
      { tool: cap.toolName, params: { productIds: chairIds } },
    ];
  }
  if (cap.templateType === "BULK_READ") {
    return [
      { tool: "search_products", params: { category: "headphones" } },
      { tool: cap.toolName, params: { productIds: ids } },
    ];
  }
  return [
    { tool: "search_products", params: { category: "headphones" } },
    {
      tool: cap.toolName,
      params: { productIds: ids, fields: ["name", "price", "brand"] },
    },
    { tool: "add_to_cart", params: { productId: ids[0]!, qty: 1 } },
  ];
}

export async function seedPostPublishTraffic(capabilityId?: string): Promise<{
  sessions: number;
}> {
  await ensureSeedRuntime();
  const cap = capabilityId
    ? await publishedRepo.get(capabilityId)
    : (await publishedRepo.active())[0];
  if (!cap || cap.status !== "active") {
    throw new Error("Publish a capability first, then load post-publish traffic.");
  }
  const registry = getRegistry();
  await registry.whenReady();
  if (!registry.has(cap.toolName)) {
    await registerPublishedCapability(cap);
  }
  for (let i = 0; i < 6; i++) {
    await driveScenario(postPublishSteps(cap));
  }
  const settings = await settingsRepo.get();
  await settingsRepo.put({ ...settings, seededAt: nowMs() });
  const sessions = await sessionRepo.all();
  return { sessions: sessions.length };
}

export async function seedAllScenarios(options?: {
  includePostPublish?: boolean;
  capabilityId?: string;
}): Promise<{ sessions: number }> {
  await ensureSeedRuntime();

  for (let i = 0; i < 5; i++) {
    await seedScenarioComparisonDetour();
  }
  for (let i = 0; i < 4; i++) {
    await seedScenarioMultiProductInspection();
  }
  for (let i = 0; i < 4; i++) {
    await seedScenarioRepeatedAvailability();
  }

  await seedScenarioDirectLookup();
  await seedScenarioDirectLookup();
  for (let i = 0; i < 3; i++) {
    await seedScenarioFailureLoop();
  }
  await seedScenarioEfficientCheckout();
  await seedScenarioEfficientCheckout();
  for (let i = 0; i < 3; i++) {
    await seedScenarioFilterIteration();
  }

  if (options?.includePostPublish) {
    await seedPostPublishTraffic(options.capabilityId);
  }

  const settings = await settingsRepo.get();
  await settingsRepo.put({ ...settings, seededAt: nowMs() });

  const sessions = await sessionRepo.all();
  return { sessions: sessions.length };
}
