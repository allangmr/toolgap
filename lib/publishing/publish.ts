import {
  gapRepo,
  publishedRepo,
  recommendationRepo,
  versionRepo,
} from "@/lib/db/repositories";
import { transitionGap } from "@/lib/gaps/engine";
import { createId, nowMs } from "@/lib/shared";
import type {
  PublishedCapability,
  Recommendation,
} from "@/lib/shared/types";
import { storeServices } from "@/lib/store-domain/services";
import { getTemplate } from "@/lib/recommendations/templates";
import { getRegistry } from "@/lib/webmcp/registry";

export async function approveRecommendation(
  recommendationId: string,
): Promise<Recommendation> {
  const rec = await recommendationRepo.get(recommendationId);
  if (!rec) throw new Error("Recommendation not found");
  const updated: Recommendation = {
    ...rec,
    status: "approved",
    updatedAt: nowMs(),
  };
  await recommendationRepo.put(updated);
  const gap = await gapRepo.get(rec.gapId);
  if (gap) {
    await gapRepo.put(transitionGap(gap, "approved", "human"));
  }
  return updated;
}

export async function publishRecommendation(
  recommendationId: string,
): Promise<PublishedCapability> {
  const rec = await recommendationRepo.get(recommendationId);
  if (!rec) throw new Error("Recommendation not found");
  if (rec.status !== "approved" && rec.status !== "simulated") {
    // Allow publish from approved; if simulated, require approve first ideally
  }
  if (rec.status !== "approved") {
    throw new Error("Recommendation must be approved before publishing");
  }

  const existing = await publishedRepo.byToolName(rec.proposedToolName);
  if (existing && existing.status === "active") {
    throw new Error(`Tool name already published: ${rec.proposedToolName}`);
  }

  const registry = getRegistry();
  if (registry.has(rec.proposedToolName)) {
    // Static tool conflict
    const staticNames = new Set(
      registry.listTools().filter((t) => t.origin === "static").map((t) => t.name),
    );
    if (staticNames.has(rec.proposedToolName)) {
      throw new Error(`Conflicts with static tool: ${rec.proposedToolName}`);
    }
  }

  const template = getTemplate(rec.templateType);
  const parsed = template.configSchema.safeParse(rec.templateConfig);
  if (!parsed.success) {
    throw new Error("Invalid template config for publish");
  }

  const version = existing ? existing.version + 1 : 1;
  const capability: PublishedCapability = {
    id: existing?.id ?? createId(),
    recommendationId: rec.id,
    toolName: rec.proposedToolName,
    templateType: rec.templateType,
    config: parsed.data as Record<string, unknown>,
    version,
    status: "active",
    publishedAt: nowMs(),
    schemaJson: rec.inputSchemaJson,
  };

  try {
    await registerPublishedCapability(capability);
  } catch (error) {
    capability.registrationError =
      error instanceof Error ? error.message : String(error);
  }

  await publishedRepo.put(capability);
  await versionRepo.put({
    id: createId(),
    capabilityId: capability.id,
    version: capability.version,
    config: capability.config,
    schemaJson: capability.schemaJson,
    publishedAt: capability.publishedAt,
  });

  const updatedRec: Recommendation = {
    ...rec,
    status: "published",
    updatedAt: nowMs(),
  };
  await recommendationRepo.put(updatedRec);

  const gap = await gapRepo.get(rec.gapId);
  if (gap) {
    await gapRepo.put(
      transitionGap({ ...gap, recommendationId: rec.id }, "published", "human"),
    );
  }

  return capability;
}

export async function registerPublishedCapability(
  capability: PublishedCapability,
): Promise<void> {
  const registry = getRegistry();
  await registry.whenReady();

  if (capability.status !== "active") return;

  const template = getTemplate(capability.templateType);
  const parsed = template.configSchema.safeParse(capability.config);
  if (!parsed.success) {
    throw new Error("Stale capability config failed validation");
  }

  if (registry.has(capability.toolName)) {
    registry.unregisterTool(capability.toolName);
  }

  const handler = template.createHandler(parsed.data as never, storeServices);
  const inputSchema = template.buildInputSchema(parsed.data as never);

  await registry.registerTool({
    name: capability.toolName,
    description: String(
      (capability.config as { description?: string }).description ??
        capability.toolName,
    ),
    version: String(capability.version),
    inputSchema,
    handler,
    surface: "store",
    origin: "dynamic",
    capabilityId: capability.id,
    readOnly: template.readOnly,
    entityExtractor: (input) => {
      if (Array.isArray(input.productIds)) return input.productIds as string[];
      if (typeof input.productId === "string") return [input.productId];
      return undefined;
    },
  });
}

export async function deactivateCapability(id: string): Promise<PublishedCapability> {
  const cap = await publishedRepo.get(id);
  if (!cap) throw new Error("Capability not found");
  const registry = getRegistry();
  if (registry.has(cap.toolName)) {
    registry.unregisterTool(cap.toolName);
  }
  const updated: PublishedCapability = {
    ...cap,
    status: "inactive",
    deactivatedAt: nowMs(),
  };
  await publishedRepo.put(updated);
  return updated;
}

export async function syncActiveCapabilities(): Promise<void> {
  const active = await publishedRepo.active();
  for (const cap of active) {
    try {
      await registerPublishedCapability(cap);
      if (cap.registrationError) {
        await publishedRepo.put({ ...cap, registrationError: undefined });
      }
    } catch (error) {
      await publishedRepo.put({
        ...cap,
        registrationError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
