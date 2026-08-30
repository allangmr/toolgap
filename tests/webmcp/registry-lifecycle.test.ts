import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { resetDbForTests } from "@/lib/db/schema";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import {
  getRegistry,
  resetRegistryForTests,
  type ToolgapToolDefinition,
} from "@/lib/webmcp/registry";

function dummyTool(name: string): ToolgapToolDefinition {
  return {
    name,
    description: "test tool",
    version: "1.0.0",
    inputSchema: z.object({}),
    handler: async () => ({ ok: true }),
    surface: "store",
    origin: "static",
  };
}

describe("registry registration lifecycle", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetRegistryForTests();
  });

  it("awaits adapter.register before registerTool resolves", async () => {
    const registry = getRegistry();
    let resolveRegister: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRegister = resolve;
    });
    let adapterFinished = false;
    registry.setAdapterForTests({
      kind: "native",
      available: true,
      async register() {
        await pending;
        adapterFinished = true;
      },
      unregister() {
        return;
      },
    });

    let registryFinished = false;
    const done = registry.registerTool(dummyTool("await_me")).then(() => {
      registryFinished = true;
    });
    await Promise.resolve();
    expect(adapterFinished).toBe(false);
    expect(registryFinished).toBe(false);
    resolveRegister?.();
    await done;
    expect(adapterFinished).toBe(true);
    expect(registryFinished).toBe(true);
  });

  it("aborts the registration signal on unregister", async () => {
    const registry = getRegistry();
    let seen: AbortSignal | undefined;
    registry.setAdapterForTests({
      kind: "native",
      available: true,
      async register(_def, options) {
        seen = options?.signal;
      },
      unregister() {
        return;
      },
    });
    await registry.registerTool(dummyTool("abort_me"));
    expect(seen?.aborted).toBe(false);
    registry.unregisterTool("abort_me");
    expect(seen?.aborted).toBe(true);
    expect(registry.has("abort_me")).toBe(false);
  });

  it("records registry errors and notifies subscribers", async () => {
    const registry = getRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.setAdapterForTests({
      kind: "native",
      available: true,
      async register() {
        throw new Error("denied");
      },
      unregister() {
        return;
      },
    });
    await expect(registry.registerTool(dummyTool("failing"))).rejects.toThrow(
      "denied",
    );
    expect(registry.getErrors()[0]).toContain("failing");
    expect(registry.getErrors()[0]).toContain("denied");
    expect(listener).toHaveBeenCalled();
    expect(registry.has("failing")).toBe(false);
  });

  it("keeps noop adapter tools invokable after register", async () => {
    const registry = getRegistry();
    registry.setAdapterForTests(createNoopAdapter());
    await registry.registerTool(dummyTool("noop_ok"));
    const result = await registry.invoke("noop_ok");
    expect(result.isError).toBeFalsy();
  });
});
