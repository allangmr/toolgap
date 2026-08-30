import {
  sessionRepo,
  settingsRepo,
  toolCallRepo,
} from "@/lib/db/repositories";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { createId, nowMs } from "@/lib/shared";
import type {
  AgentSession,
  ErrorCategory,
  ToolCallEvent,
  ToolOrigin,
} from "@/lib/shared/types";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";

interface SeedCall {
  toolName: string;
  input: Record<string, unknown>;
  success?: boolean;
  errorCategory?: ErrorCategory;
  durationMs?: number;
  origin?: ToolOrigin;
  capabilityId?: string;
  entityIds?: string[];
}

async function writeSession(
  calls: SeedCall[],
  opts: { startedAt: number; surface?: "store" | "dashboard" } = {
    startedAt: nowMs(),
  },
): Promise<string> {
  const sessionId = createId();
  const tabId = createId();
  const startedAt = opts.startedAt;
  let t = startedAt;

  const events: ToolCallEvent[] = calls.map((call, i) => {
    const durationMs = call.durationMs ?? 40 + Math.floor(Math.random() * 80);
    const timestamp = t;
    t += durationMs + 20 + Math.floor(Math.random() * 40);
    const entityIds =
      call.entityIds ??
      (typeof call.input.productId === "string"
        ? [call.input.productId]
        : Array.isArray(call.input.productIds)
          ? (call.input.productIds as string[])
          : undefined);

    return {
      id: createId(),
      sessionId,
      timestamp,
      sequenceIndex: i + 1,
      toolName: call.toolName,
      toolVersion: "1.0.0",
      origin: call.origin ?? "static",
      surface: opts.surface ?? "store",
      capabilityId: call.capabilityId,
      input: call.input,
      resultMeta: {
        ok: call.success !== false,
        entityIds,
        itemCount: entityIds?.length,
      },
      success: call.success !== false,
      errorCategory: call.errorCategory,
      errorMessage: call.success === false ? "seeded failure" : undefined,
      durationMs,
      page: "/store",
      entityIds,
    };
  });

  const session: AgentSession = {
    id: sessionId,
    surface: opts.surface ?? "store",
    startedAt,
    lastActivityAt: t,
    endedAt: t,
    status: "expired",
    callCount: events.length,
    tabId,
  };

  await sessionRepo.upsert(session);
  await toolCallRepo.bulkAdd(events);
  return sessionId;
}

const p = SEED_PRODUCTS;

export async function seedScenarioDirectLookup(baseTime: number): Promise<void> {
  await writeSession(
    [
      { toolName: "search_products", input: { q: "laptop" } },
      { toolName: "get_product", input: { productId: p[6]!.id } },
      { toolName: "add_to_cart", input: { productId: p[6]!.id, qty: 1 } },
      { toolName: "complete_checkout", input: {} },
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioComparisonDetour(baseTime: number): Promise<void> {
  const ids = [p[0]!.id, p[1]!.id, p[2]!.id];
  await writeSession(
    [
      { toolName: "search_products", input: { category: "headphones" } },
      { toolName: "get_product", input: { productId: ids[0]! } },
      { toolName: "get_product", input: { productId: ids[1]! } },
      { toolName: "get_product", input: { productId: ids[2]! } },
      { toolName: "get_availability", input: { productId: ids[0]! } },
      { toolName: "get_availability", input: { productId: ids[1]! } },
      { toolName: "get_availability", input: { productId: ids[2]! } },
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioRepeatedAvailability(baseTime: number): Promise<void> {
  const ids = [p[13]!.id, p[14]!.id, p[15]!.id, p[16]!.id];
  await writeSession(
    [
      { toolName: "search_products", input: { category: "chairs" } },
      ...ids.map((id) => ({
        toolName: "get_availability",
        input: { productId: id },
      })),
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioFailureLoop(baseTime: number): Promise<void> {
  await writeSession(
    [
      { toolName: "search_products", input: { q: "missing-sku" } },
      {
        toolName: "get_product",
        input: { productId: "does-not-exist" },
        success: false,
        errorCategory: "not_found",
      },
      {
        toolName: "get_product",
        input: { productId: "does-not-exist" },
        success: false,
        errorCategory: "not_found",
      },
      {
        toolName: "get_product",
        input: { productId: "does-not-exist" },
        success: false,
        errorCategory: "not_found",
      },
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioEfficientCheckout(baseTime: number): Promise<void> {
  await writeSession(
    [
      { toolName: "get_product", input: { productId: p[20]!.id } },
      { toolName: "get_availability", input: { productId: p[20]!.id } },
      { toolName: "add_to_cart", input: { productId: p[20]!.id, qty: 1 } },
      { toolName: "get_cart", input: {} },
      { toolName: "complete_checkout", input: {} },
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioFilterIteration(baseTime: number): Promise<void> {
  await writeSession(
    [
      { toolName: "search_products", input: { category: "laptops", maxPrice: 2000 } },
      { toolName: "get_product", input: { productId: p[7]!.id } },
      { toolName: "search_products", input: { category: "laptops", maxPrice: 1500 } },
      { toolName: "get_product", input: { productId: p[10]!.id } },
      { toolName: "search_products", input: { category: "laptops", maxPrice: 1000 } },
      { toolName: "get_product", input: { productId: p[8]!.id } },
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioMultiProductInspection(baseTime: number): Promise<void> {
  const ids = [p[21]!.id, p[22]!.id, p[23]!.id, p[24]!.id];
  await writeSession(
    [
      { toolName: "search_products", input: { category: "cameras" } },
      ...ids.map((id) => ({
        toolName: "get_product",
        input: { productId: id },
      })),
    ],
    { startedAt: baseTime },
  );
}

export async function seedScenarioPostPublishCompare(
  baseTime: number,
  capabilityId?: string,
): Promise<void> {
  const ids = [p[0]!.id, p[1]!.id, p[2]!.id];
  await writeSession(
    [
      { toolName: "search_products", input: { category: "headphones" } },
      {
        toolName: "compare_products",
        input: { productIds: ids, fields: ["name", "price", "brand"] },
        origin: "dynamic",
        capabilityId,
        entityIds: ids,
      },
      { toolName: "add_to_cart", input: { productId: ids[0]!, qty: 1 } },
    ],
    { startedAt: baseTime },
  );
}

export async function seedAllScenarios(options?: {
  includePostPublish?: boolean;
  capabilityId?: string;
}): Promise<{ sessions: number }> {
  await ensureCatalogSeeded();
  const base = nowMs() - 2 * 60 * 60 * 1000;
  const step = 5 * 60 * 1000;

  // Multiple comparison detours so gap thresholds are met
  for (let i = 0; i < 5; i++) {
    await seedScenarioComparisonDetour(base + i * step);
  }
  for (let i = 0; i < 4; i++) {
    await seedScenarioMultiProductInspection(base + 30 * step + i * step);
  }
  for (let i = 0; i < 4; i++) {
    await seedScenarioRepeatedAvailability(base + 50 * step + i * step);
  }

  await seedScenarioDirectLookup(base + 70 * step);
  await seedScenarioDirectLookup(base + 71 * step);
  await seedScenarioFailureLoop(base + 72 * step);
  await seedScenarioEfficientCheckout(base + 73 * step);
  await seedScenarioEfficientCheckout(base + 74 * step);
  await seedScenarioFilterIteration(base + 75 * step);
  await seedScenarioFilterIteration(base + 76 * step);

  if (options?.includePostPublish) {
    for (let i = 0; i < 6; i++) {
      await seedScenarioPostPublishCompare(
        base + 80 * step + i * step,
        options.capabilityId,
      );
    }
  }

  const settings = await settingsRepo.get();
  await settingsRepo.put({ ...settings, seededAt: nowMs() });

  const sessions = await sessionRepo.all();
  return { sessions: sessions.length };
}
