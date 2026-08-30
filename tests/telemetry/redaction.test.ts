import { describe, expect, it } from "vitest";
import { paramKeyPaths, redactValue } from "@/lib/telemetry/redaction";
import { percentile } from "@/lib/shared/math";

describe("redaction", () => {
  it("redacts sensitive keys", () => {
    const result = redactValue({
      productId: "hp-01",
      password: "secret",
      nested: { token: "abc", ok: true },
    });
    expect(result.productId).toBe("hp-01");
    expect(result.password).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).token).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).ok).toBe(true);
  });

  it("applies extra redaction keys on top of the defaults", () => {
    const result = redactValue({ nickname: "Ada", productId: "hp-01" }, [
      "nickname",
    ]);
    expect(result.nickname).toBe("[redacted]");
    expect(result.productId).toBe("hp-01");
  });

  it("extracts sorted parameter key paths without values", () => {
    expect(
      paramKeyPaths({
        category: "laptops",
        maxPrice: 1500,
        nested: { ram: 16 },
        productIds: ["a", "b"],
      }),
    ).toEqual(["category", "maxPrice", "nested.ram", "productIds"]);
  });
});

describe("percentile", () => {
  it("computes p50 and p95", () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentile(values, 50)).toBe(30);
    expect(percentile(values, 95)).toBeGreaterThan(40);
  });
});
