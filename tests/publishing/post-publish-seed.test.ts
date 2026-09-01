import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { resetDbForTests } from "@/lib/db/schema";
import { publishedRepo, sessionRepo, toolCallRepo } from "@/lib/db/repositories";
import { seedPostPublishTraffic } from "@/lib/seed/scenarios";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { getRegistry, resetRegistryForTests } from "@/lib/webmcp/registry";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import type { PublishedCapability } from "@/lib/shared/types";

const cap: PublishedCapability = {
  id: "cap-seed",
  recommendationId: "rec-seed",
  toolName: "compare_products",
  templateType: "COMPARE",
  config: {
    entity: "product",
    fields: ["id", "name", "price"],
    maxBatchSize: 10,
    toolName: "compare_products",
    description: "seed demo",
  },
  version: 1,
  status: "active",
  publishedAt: 1,
  schemaJson: {},
};

describe("seedPostPublishTraffic on the dashboard surface", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
    await ensureCatalogSeeded();
    window.history.replaceState(null, "", "/settings");
  });

  it("drives the dynamic tool via temporary registration, then removes it", async () => {
    await publishedRepo.put(cap);
    expect(getRegistry().has("compare_products")).toBe(false);

    const { sessions } = await seedPostPublishTraffic(cap.id);
    expect(sessions).toBeGreaterThanOrEqual(6);

    const compareCalls = await toolCallRepo.byTool("compare_products");
    expect(compareCalls.length).toBeGreaterThanOrEqual(6);
    expect(compareCalls[0]!.origin).toBe("dynamic");
    expect(compareCalls[0]!.success).toBe(true);

    // The temporary registration must not leak into the dashboard tab.
    expect(getRegistry().has("compare_products")).toBe(false);
    const stored = await sessionRepo.all();
    expect(stored.length).toBeGreaterThanOrEqual(6);
  });
});
