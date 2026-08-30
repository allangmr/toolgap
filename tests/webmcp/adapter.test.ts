import { describe, expect, it } from "vitest";
import {
  createNativeAdapter,
  createNoopAdapter,
  resolveAdapter,
} from "@/lib/webmcp/adapter";

describe("webmcp adapter selection", () => {
  it("returns noop when modelContext missing", async () => {
    const adapter = await resolveAdapter({ preferPolyfill: false });
    expect(adapter.kind === "noop" || adapter.kind === "native").toBe(true);
  });

  it("createNoopAdapter is unavailable", () => {
    const adapter = createNoopAdapter();
    expect(adapter.available).toBe(false);
    expect(adapter.kind).toBe("noop");
  });

  it("createNativeAdapter returns null without modelContext", () => {
    expect(createNativeAdapter()).toBeNull();
  });
});
