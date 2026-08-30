import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { publishedRepo } from "@/lib/db/repositories";
import { syncActiveCapabilities } from "@/lib/publishing/publish";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { getRegistry, resetRegistryForTests } from "@/lib/webmcp/registry";
import type { PublishedCapability } from "@/lib/shared/types";

const cap: PublishedCapability = {
  id: "cap-boot",
  recommendationId: "rec-boot",
  toolName: "compare_products",
  templateType: "COMPARE",
  config: {
    entity: "product",
    fields: ["id", "name", "price"],
    maxBatchSize: 10,
    toolName: "compare_products",
    description: "boot restore",
  },
  version: 1,
  status: "active",
  publishedAt: 1,
  schemaJson: {},
  registrationError: "stale",
};

describe("syncActiveCapabilities", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetRegistryForTests();
    getRegistry().setAdapterForTests(createNoopAdapter());
    await ensureCatalogSeeded();
  });

  it("registers active published tools and clears a recovered registrationError", async () => {
    await publishedRepo.put(cap);
    expect(getRegistry().has("compare_products")).toBe(false);
    await syncActiveCapabilities();
    expect(getRegistry().has("compare_products")).toBe(true);
    const stored = await publishedRepo.get(cap.id);
    expect(stored?.registrationError).toBeUndefined();
  });

  it("records registrationError when the adapter rejects", async () => {
    getRegistry().setAdapterForTests({
      kind: "native",
      available: true,
      async register() {
        throw new Error("adapter down");
      },
      unregister() {
        return;
      },
    });
    await publishedRepo.put({ ...cap, registrationError: undefined });
    await syncActiveCapabilities();
    const stored = await publishedRepo.get(cap.id);
    expect(stored?.registrationError).toBe("adapter down");
  });
});
