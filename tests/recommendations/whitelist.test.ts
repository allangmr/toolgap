import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";
import { ensureCatalogSeeded, storeServices } from "@/lib/store-domain/services";
import {
  bulkReadTemplate,
  compareTemplate,
  effectiveFields,
} from "@/lib/recommendations/templates";

describe("product field whitelist", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    await ensureCatalogSeeded();
  });

  it("strips fields outside the global whitelist even when config includes them", async () => {
    expect(
      effectiveFields(["name", "price", "ssn", "internalCost"], [
        "name",
        "ssn",
        "internalCost",
      ]),
    ).toEqual(["name"]);

    const handler = compareTemplate.createHandler(
      {
        entity: "product",
        fields: ["name", "price", "ssn", "internalCost"],
        maxBatchSize: 10,
        toolName: "compare_products",
        description: "test",
      },
      storeServices,
    );
    const result = (await handler({
      productIds: [SEED_PRODUCTS[0]!.id, SEED_PRODUCTS[1]!.id],
      fields: ["name", "ssn", "internalCost"],
    })) as { products: Array<Record<string, unknown>>; fields: string[] };

    expect(result.fields).toEqual(["name"]);
    for (const row of result.products) {
      expect(row).not.toHaveProperty("ssn");
      expect(row).not.toHaveProperty("internalCost");
      expect(row).toHaveProperty("name");
    }
  });

  it("strips leaked fields from bulk read config", async () => {
    const handler = bulkReadTemplate.createHandler(
      {
        entity: "product",
        fields: ["id", "name", "internalCost"],
        maxBatchSize: 10,
        toolName: "get_products",
        description: "test",
      },
      storeServices,
    );
    const rows = (await handler({
      productIds: [SEED_PRODUCTS[0]!.id],
    })) as Array<Record<string, unknown>>;
    expect(rows[0]).not.toHaveProperty("internalCost");
    expect(rows[0]).toHaveProperty("name");
  });
});
