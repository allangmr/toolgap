import Dexie from "dexie";
import { getDb } from "@/lib/db/schema";
import type {
  AgentSession,
  AppSettings,
  CapabilityGap,
  CapabilityVersion,
  Cart,
  FrictionSignal,
  Inventory,
  Journey,
  MetricSnapshot,
  Order,
  Product,
  PublishedCapability,
  Recommendation,
  RecommendationSimulation,
  SchemaMeta,
  ToolCallEvent,
} from "@/lib/shared/types";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  inactivityTimeoutMs: 3 * 60 * 1000,
  redactionKeys: [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "email",
    "card",
    "creditCard",
    "ssn",
    "authorization",
  ],
  maxTelemetryEvents: 20_000,
  dismissalCooldownMs: 7 * 24 * 60 * 60 * 1000,
  polyfillEnabled: false,
};

export const DEFAULT_META: SchemaMeta = {
  id: "meta",
  lastAnalyzedEventTimestamp: 0,
  analysisVersion: 1,
};

export async function ensureDefaults(): Promise<void> {
  const db = getDb();
  const settings = await db.settings.get("settings");
  if (!settings) {
    await db.settings.put(DEFAULT_SETTINGS);
  }
  const meta = await db.schemaMeta.get("meta");
  if (!meta) {
    await db.schemaMeta.put(DEFAULT_META);
  }
}

export const toolCallRepo = {
  async add(event: ToolCallEvent): Promise<void> {
    await getDb().toolCalls.add(event);
  },
  async bulkAdd(events: ToolCallEvent[]): Promise<void> {
    if (events.length === 0) return;
    await getDb().toolCalls.bulkAdd(events);
  },
  async bySession(sessionId: string): Promise<ToolCallEvent[]> {
    return getDb()
      .toolCalls.where("[sessionId+sequenceIndex]")
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .toArray();
  },
  async all(): Promise<ToolCallEvent[]> {
    return getDb().toolCalls.orderBy("timestamp").toArray();
  },
  async count(): Promise<number> {
    return getDb().toolCalls.count();
  },
  async afterTimestamp(ts: number): Promise<ToolCallEvent[]> {
    return getDb().toolCalls.where("timestamp").above(ts).toArray();
  },
  async byTool(toolName: string): Promise<ToolCallEvent[]> {
    return getDb().toolCalls.where("toolName").equals(toolName).toArray();
  },
  async storeSurface(): Promise<ToolCallEvent[]> {
    return getDb().toolCalls.where("surface").equals("store").toArray();
  },
  async pruneOldest(count: number): Promise<number> {
    if (count <= 0) return 0;
    const keys = await getDb()
      .toolCalls.orderBy("timestamp")
      .limit(count)
      .primaryKeys();
    if (keys.length === 0) return 0;
    await getDb().toolCalls.bulkDelete(keys);
    return keys.length;
  },
};

export const sessionRepo = {
  async upsert(session: AgentSession): Promise<void> {
    await getDb().sessions.put(session);
  },
  async get(id: string): Promise<AgentSession | undefined> {
    return getDb().sessions.get(id);
  },
  async all(): Promise<AgentSession[]> {
    return getDb().sessions.orderBy("startedAt").reverse().toArray();
  },
  async active(): Promise<AgentSession[]> {
    return getDb().sessions.where("status").equals("active").toArray();
  },
  async putMany(sessions: AgentSession[]): Promise<void> {
    await getDb().sessions.bulkPut(sessions);
  },
};

export const journeyRepo = {
  async put(journey: Journey): Promise<void> {
    await getDb().journeys.put(journey);
  },
  async putMany(journeys: Journey[]): Promise<void> {
    await getDb().journeys.bulkPut(journeys);
  },
  async all(): Promise<Journey[]> {
    return getDb().journeys.toArray();
  },
  async bySession(sessionId: string): Promise<Journey | undefined> {
    return getDb().journeys.where("sessionId").equals(sessionId).first();
  },
  async get(id: string): Promise<Journey | undefined> {
    return getDb().journeys.get(id);
  },
  async clear(): Promise<void> {
    await getDb().journeys.clear();
  },
};

export const frictionRepo = {
  async putMany(signals: FrictionSignal[]): Promise<void> {
    await getDb().frictionSignals.bulkPut(signals);
  },
  async all(): Promise<FrictionSignal[]> {
    return getDb().frictionSignals.toArray();
  },
  async byJourney(journeyId: string): Promise<FrictionSignal[]> {
    return getDb().frictionSignals.where("journeyId").equals(journeyId).toArray();
  },
  async deleteByJourneys(journeyIds: string[]): Promise<void> {
    if (journeyIds.length === 0) return;
    await getDb().frictionSignals.where("journeyId").anyOf(journeyIds).delete();
  },
  async clear(): Promise<void> {
    await getDb().frictionSignals.clear();
  },
};

export const gapRepo = {
  async put(gap: CapabilityGap): Promise<void> {
    await getDb().capabilityGaps.put(gap);
  },
  async putMany(gaps: CapabilityGap[]): Promise<void> {
    await getDb().capabilityGaps.bulkPut(gaps);
  },
  async all(): Promise<CapabilityGap[]> {
    return getDb().capabilityGaps.toArray();
  },
  async get(id: string): Promise<CapabilityGap | undefined> {
    return getDb().capabilityGaps.get(id);
  },
  async byMergeKey(mergeKey: string): Promise<CapabilityGap | undefined> {
    return getDb().capabilityGaps.where("mergeKey").equals(mergeKey).first();
  },
  async clear(): Promise<void> {
    await getDb().capabilityGaps.clear();
  },
};

export const recommendationRepo = {
  async put(rec: Recommendation): Promise<void> {
    await getDb().recommendations.put(rec);
  },
  async get(id: string): Promise<Recommendation | undefined> {
    return getDb().recommendations.get(id);
  },
  async byGap(gapId: string): Promise<Recommendation | undefined> {
    return getDb().recommendations.where("gapId").equals(gapId).first();
  },
  async all(): Promise<Recommendation[]> {
    return getDb().recommendations.orderBy("createdAt").reverse().toArray();
  },
  async clear(): Promise<void> {
    await getDb().recommendations.clear();
  },
};

export const simulationRepo = {
  async put(sim: RecommendationSimulation): Promise<void> {
    await getDb().simulations.put(sim);
  },
  async byRecommendation(
    recommendationId: string,
  ): Promise<RecommendationSimulation | undefined> {
    return getDb().simulations.where("recommendationId").equals(recommendationId).first();
  },
  async deleteByRecommendation(recommendationId: string): Promise<void> {
    await getDb()
      .simulations.where("recommendationId")
      .equals(recommendationId)
      .delete();
  },
  async clear(): Promise<void> {
    await getDb().simulations.clear();
  },
};

export const publishedRepo = {
  async put(cap: PublishedCapability): Promise<void> {
    await getDb().publishedCapabilities.put(cap);
  },
  async all(): Promise<PublishedCapability[]> {
    return getDb().publishedCapabilities.toArray();
  },
  async active(): Promise<PublishedCapability[]> {
    return getDb().publishedCapabilities.where("status").equals("active").toArray();
  },
  async byToolName(toolName: string): Promise<PublishedCapability | undefined> {
    return getDb().publishedCapabilities.where("toolName").equals(toolName).first();
  },
  async get(id: string): Promise<PublishedCapability | undefined> {
    return getDb().publishedCapabilities.get(id);
  },
  async clear(): Promise<void> {
    await getDb().publishedCapabilities.clear();
  },
};

export const versionRepo = {
  async put(version: CapabilityVersion): Promise<void> {
    await getDb().capabilityVersions.put(version);
  },
  async clear(): Promise<void> {
    await getDb().capabilityVersions.clear();
  },
};

export const metricRepo = {
  async put(snapshot: MetricSnapshot): Promise<void> {
    await getDb().metricSnapshots.put(snapshot);
  },
  async byCapability(capabilityId: string): Promise<MetricSnapshot | undefined> {
    const rows = await getDb()
      .metricSnapshots.where("capabilityId")
      .equals(capabilityId)
      .toArray();
    return rows.sort((a, b) => b.computedAt - a.computedAt)[0];
  },
  async clear(): Promise<void> {
    await getDb().metricSnapshots.clear();
  },
};

export const productRepo = {
  async putMany(products: Product[]): Promise<void> {
    await getDb().products.bulkPut(products);
  },
  async all(): Promise<Product[]> {
    return getDb().products.toArray();
  },
  async get(id: string): Promise<Product | undefined> {
    return getDb().products.get(id);
  },
  async search(query: {
    q?: string;
    category?: string;
    brand?: string;
    maxPrice?: number;
  }): Promise<Product[]> {
    let products = await getDb().products.toArray();
    if (query.category) {
      products = products.filter((p) => p.category === query.category);
    }
    if (query.brand) {
      products = products.filter(
        (p) => p.brand.toLowerCase() === query.brand!.toLowerCase(),
      );
    }
    if (query.maxPrice != null) {
      products = products.filter((p) => p.price <= query.maxPrice!);
    }
    if (query.q) {
      const needle = query.q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.brand.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle),
      );
    }
    return products;
  },
  async clear(): Promise<void> {
    await getDb().products.clear();
  },
};

export const inventoryRepo = {
  async putMany(items: Inventory[]): Promise<void> {
    await getDb().inventory.bulkPut(items);
  },
  async get(productId: string): Promise<Inventory | undefined> {
    return getDb().inventory.get(productId);
  },
  async getMany(productIds: string[]): Promise<Inventory[]> {
    return getDb().inventory.bulkGet(productIds).then((rows) =>
      rows.filter((r): r is Inventory => r != null),
    );
  },
  async clear(): Promise<void> {
    await getDb().inventory.clear();
  },
};

export const cartRepo = {
  async get(id: string): Promise<Cart | undefined> {
    return getDb().carts.get(id);
  },
  async put(cart: Cart): Promise<void> {
    await getDb().carts.put(cart);
  },
  async clear(): Promise<void> {
    await getDb().carts.clear();
  },
};

export const orderRepo = {
  async put(order: Order): Promise<void> {
    await getDb().orders.put(order);
  },
  async all(): Promise<Order[]> {
    return getDb().orders.toArray();
  },
  async clear(): Promise<void> {
    await getDb().orders.clear();
  },
};

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const existing = await getDb().settings.get("settings");
    return existing ?? DEFAULT_SETTINGS;
  },
  async put(settings: AppSettings): Promise<void> {
    await getDb().settings.put(settings);
  },
};

export const metaRepo = {
  async get(): Promise<SchemaMeta> {
    const existing = await getDb().schemaMeta.get("meta");
    return existing ?? DEFAULT_META;
  },
  async put(meta: SchemaMeta): Promise<void> {
    await getDb().schemaMeta.put(meta);
  },
};

export async function resetAllData(): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.toolCalls.clear(),
    db.sessions.clear(),
    db.journeys.clear(),
    db.frictionSignals.clear(),
    db.capabilityGaps.clear(),
    db.recommendations.clear(),
    db.simulations.clear(),
    db.publishedCapabilities.clear(),
    db.capabilityVersions.clear(),
    db.metricSnapshots.clear(),
    db.carts.clear(),
    db.orders.clear(),
  ]);
  await db.settings.put({ ...DEFAULT_SETTINGS, seededAt: undefined });
  await db.schemaMeta.put(DEFAULT_META);
}

export async function clearTelemetryData(): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.toolCalls.clear(),
    db.sessions.clear(),
    db.journeys.clear(),
    db.frictionSignals.clear(),
    db.capabilityGaps.clear(),
    db.recommendations.clear(),
    db.simulations.clear(),
    db.metricSnapshots.clear(),
    db.carts.clear(),
    db.orders.clear(),
  ]);
  await db.schemaMeta.put(DEFAULT_META);
}

export async function clearDerivedData(): Promise<void> {
  await Promise.all([
    journeyRepo.clear(),
    frictionRepo.clear(),
    gapRepo.clear(),
    recommendationRepo.clear(),
    simulationRepo.clear(),
    metricRepo.clear(),
  ]);
  await metaRepo.put(DEFAULT_META);
}
