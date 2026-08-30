import Dexie, { type EntityTable } from "dexie";
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

export class ToolGapDB extends Dexie {
  toolCalls!: EntityTable<ToolCallEvent, "id">;
  sessions!: EntityTable<AgentSession, "id">;
  journeys!: EntityTable<Journey, "id">;
  frictionSignals!: EntityTable<FrictionSignal, "id">;
  capabilityGaps!: EntityTable<CapabilityGap, "id">;
  recommendations!: EntityTable<Recommendation, "id">;
  simulations!: EntityTable<RecommendationSimulation, "id">;
  publishedCapabilities!: EntityTable<PublishedCapability, "id">;
  capabilityVersions!: EntityTable<CapabilityVersion, "id">;
  metricSnapshots!: EntityTable<MetricSnapshot, "id">;
  products!: EntityTable<Product, "id">;
  inventory!: EntityTable<Inventory, "productId">;
  carts!: EntityTable<Cart, "id">;
  orders!: EntityTable<Order, "id">;
  settings!: EntityTable<AppSettings, "id">;
  schemaMeta!: EntityTable<SchemaMeta, "id">;

  constructor() {
    super("toolgap");
    this.version(1).stores({
      toolCalls:
        "id, sessionId, [sessionId+sequenceIndex], toolName, timestamp, capabilityId, surface",
      sessions: "id, status, surface, startedAt, lastActivityAt, tabId",
      journeys: "id, sessionId, signature, startedAt, inferredIntent, outcome",
      frictionSignals: "id, type, journeyId, sessionId, detectedAt",
      capabilityGaps: "id, status, mergeKey, type, severity, lastDetectedAt",
      recommendations: "id, gapId, status, proposedToolName, createdAt",
      simulations: "id, recommendationId, createdAt",
      publishedCapabilities: "id, toolName, status, recommendationId",
      capabilityVersions: "id, capabilityId, [capabilityId+version]",
      metricSnapshots: "id, capabilityId, computedAt",
      products: "id, category, brand, price, name",
      inventory: "productId",
      carts: "id",
      orders: "id, createdAt",
      settings: "id",
      schemaMeta: "id",
    });
  }
}

let dbInstance: ToolGapDB | null = null;

export function getDb(): ToolGapDB {
  if (!dbInstance) {
    dbInstance = new ToolGapDB();
  }
  return dbInstance;
}

/** Test helper — replace the singleton with a fresh DB. */
export function resetDbForTests(): ToolGapDB {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new ToolGapDB();
  return dbInstance;
}

export async function deleteDatabase(): Promise<void> {
  const db = getDb();
  db.close();
  await Dexie.delete("toolgap");
  dbInstance = null;
}
