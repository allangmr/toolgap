import { z } from "zod";
import { PRODUCT_FIELD_WHITELIST } from "@/lib/store-domain/catalog";
import type { StoreDomainServices } from "@/lib/store-domain/services";
import type { EntityType, TemplateType } from "@/lib/shared/types";
import type { ToolHandler } from "@/lib/webmcp/types";

export interface RewriteRule {
  collapseTools: string[];
  intoTool: string;
  keepPrefixTools?: string[];
  estimatedNewToolLatencyFactor?: number;
}

export interface CapabilityTemplate<C extends Record<string, unknown>> {
  type: TemplateType;
  allowedEntities: EntityType[];
  configSchema: z.ZodType<C>;
  buildInputSchema: (config: C) => z.ZodType;
  outputShape: (config: C) => Record<string, unknown>;
  createHandler: (config: C, services: StoreDomainServices) => ToolHandler;
  expectedJourneyRewrite: (config: C) => RewriteRule;
  risks: string[];
  readOnly: boolean;
  defaultToolName: (entity: EntityType) => string;
}

export type CompareConfig = {
  entity: EntityType;
  fields: string[];
  maxBatchSize: number;
  toolName: string;
  description: string;
};

export const compareTemplate: CapabilityTemplate<CompareConfig> = {
  type: "COMPARE",
  allowedEntities: ["product"],
  readOnly: true,
  risks: [
    "Limited to whitelisted product fields",
    "Batch size capped to prevent oversized responses",
    "Read-only - cannot mutate inventory or cart",
  ],
  defaultToolName: () => "compare_products",
  configSchema: z.object({
    entity: z.literal("product"),
    fields: z.array(z.string()).min(1),
    maxBatchSize: z.number().int().min(2).max(10),
    toolName: z.string().min(1),
    description: z.string().min(1),
  }),
  buildInputSchema: (config) =>
    z.object({
      productIds: z.array(z.string()).min(2).max(config.maxBatchSize),
      fields: z.array(z.string()).optional(),
    }),
  outputShape: () => ({
    type: "object",
    properties: {
      products: { type: "array", items: { type: "object" } },
      fields: { type: "array", items: { type: "string" } },
    },
  }),
  createHandler: (config, services) => {
    return async (params) => {
      const productIds = params.productIds as string[];
      if (productIds.length > config.maxBatchSize) {
        throw Object.assign(new Error(`Max batch size is ${config.maxBatchSize}`), {
          category: "validation" as const,
        });
      }
      const fields = effectiveFields(
        config.fields,
        params.fields as string[] | undefined,
      );
      return services.compareProducts(productIds, fields);
    };
  },
  expectedJourneyRewrite: (config) => ({
    collapseTools: ["get_product", "get_availability"],
    intoTool: config.toolName,
    keepPrefixTools: ["search_products"],
    estimatedNewToolLatencyFactor: 0.6,
  }),
};

export type AvailabilityBatchConfig = {
  entity: EntityType;
  maxBatchSize: number;
  toolName: string;
  description: string;
};

export const availabilityBatchTemplate: CapabilityTemplate<AvailabilityBatchConfig> = {
  type: "AVAILABILITY_BATCH",
  allowedEntities: ["inventory"],
  readOnly: true,
  risks: ["Read-only inventory snapshot", "Batch size capped"],
  defaultToolName: () => "get_availability_batch",
  configSchema: z.object({
    entity: z.literal("inventory"),
    maxBatchSize: z.number().int().min(2).max(20),
    toolName: z.string().min(1),
    description: z.string().min(1),
  }),
  buildInputSchema: (config) =>
    z.object({
      productIds: z.array(z.string()).min(1).max(config.maxBatchSize),
    }),
  outputShape: () => ({
    type: "array",
    items: {
      type: "object",
      properties: {
        productId: { type: "string" },
        stock: { type: "number" },
        warehouse: { type: "string" },
      },
    },
  }),
  createHandler: (config, services) => async (params) => {
    const productIds = params.productIds as string[];
    if (productIds.length > config.maxBatchSize) {
      throw Object.assign(new Error(`Max batch size is ${config.maxBatchSize}`), {
        category: "validation" as const,
      });
    }
    return services.getAvailabilityBatch(productIds);
  },
  expectedJourneyRewrite: (config) => ({
    collapseTools: ["get_availability"],
    intoTool: config.toolName,
    estimatedNewToolLatencyFactor: 0.5,
  }),
};

export type BulkReadConfig = {
  entity: EntityType;
  fields: string[];
  maxBatchSize: number;
  toolName: string;
  description: string;
};

export const bulkReadTemplate: CapabilityTemplate<BulkReadConfig> = {
  type: "BULK_READ",
  allowedEntities: ["product"],
  readOnly: true,
  risks: ["Whitelisted fields only", "Read-only"],
  defaultToolName: () => "get_products",
  configSchema: z.object({
    entity: z.literal("product"),
    fields: z.array(z.string()).min(1),
    maxBatchSize: z.number().int().min(2).max(20),
    toolName: z.string().min(1),
    description: z.string().min(1),
  }),
  buildInputSchema: (config) =>
    z.object({
      productIds: z.array(z.string()).min(1).max(config.maxBatchSize),
    }),
  outputShape: () => ({
    type: "array",
    items: { type: "object" },
  }),
  createHandler: (config, services) => async (params) => {
    const productIds = params.productIds as string[];
    const products = await services.getProducts(productIds);
    const fields = effectiveFields(config.fields);
    return products.map((p) => {
      const row: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.startsWith("specs.")) {
          row[field] = p.specs[field.slice(6)] ?? null;
        } else {
          row[field] = (p as unknown as Record<string, unknown>)[field];
        }
      }
      return row;
    });
  },
  expectedJourneyRewrite: (config) => ({
    collapseTools: ["get_product"],
    intoTool: config.toolName,
    estimatedNewToolLatencyFactor: 0.55,
  }),
};

export const templates = {
  COMPARE: compareTemplate,
  AVAILABILITY_BATCH: availabilityBatchTemplate,
  BULK_READ: bulkReadTemplate,
} as const;

export function getTemplate(type: TemplateType) {
  return templates[type];
}

export function effectiveFields(configured: string[], requested?: string[]): string[] {
  const whitelist = new Set<string>(PRODUCT_FIELD_WHITELIST);
  const allowed = configured.filter((f) => whitelist.has(f));
  const allowedSet = new Set(allowed);
  const source = requested && requested.length > 0 ? requested : allowed;
  return source.filter((f) => allowedSet.has(f));
}

export function defaultCompareFields(): string[] {
  return [
    "id",
    "name",
    "brand",
    "price",
    "category",
    ...PRODUCT_FIELD_WHITELIST.filter((f) => f.startsWith("specs.")).slice(0, 6),
  ];
}
