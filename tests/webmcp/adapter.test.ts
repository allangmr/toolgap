import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNativeAdapter,
  createNoopAdapter,
  hasCanonicalNativeContext,
  resolveAdapter,
  shadowIncompleteNavigatorContext,
} from "@/lib/webmcp/adapter";
import type { NativeToolDefinition } from "@/lib/webmcp/types";

const sampleDef: NativeToolDefinition = {
  name: "probe_tool",
  description: "probe",
  inputSchema: { type: "object" },
  execute: async () => ({ content: [{ type: "text", text: "{}" }] }),
};

function clearModelContext(): void {
  Reflect.deleteProperty(navigator, "modelContext");
  Reflect.deleteProperty(document, "modelContext");
}

function installModelContext(ctx: {
  registerTool: ReturnType<typeof vi.fn>;
  unregisterTool?: ReturnType<typeof vi.fn>;
}): void {
  Object.defineProperty(navigator, "modelContext", {
    value: ctx,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, "modelContext", {
    value: ctx,
    configurable: true,
    writable: true,
  });
}

vi.mock("@mcp-b/global", () => ({
  initializeWebModelContext: () => {
    Object.defineProperty(navigator, "modelContext", {
      value: {
        registerTool: vi.fn(),
        unregisterTool: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(document, "modelContext", {
      value: navigator.modelContext,
      configurable: true,
      writable: true,
    });
  },
}));

function installNavigatorOnly(ctx: {
  registerTool: ReturnType<typeof vi.fn>;
  unregisterTool?: ReturnType<typeof vi.fn>;
  getTools?: ReturnType<typeof vi.fn>;
}): void {
  Reflect.deleteProperty(document, "modelContext");
  Object.defineProperty(navigator, "modelContext", {
    value: ctx,
    configurable: true,
    writable: true,
  });
}

describe("webmcp adapter selection", () => {
  afterEach(() => {
    clearModelContext();
    vi.unstubAllGlobals();
  });

  it("returns noop when modelContext is missing and polyfill is off", async () => {
    clearModelContext();
    const adapter = await resolveAdapter({ preferPolyfill: false });
    expect(adapter.kind).toBe("noop");
    expect(adapter.available).toBe(false);
  });

  it("selects native when document.modelContext exists", async () => {
    installModelContext({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    const adapter = await resolveAdapter({ preferPolyfill: false });
    expect(adapter.kind).toBe("native");
    expect(adapter.available).toBe(true);
  });

  it("keeps canonical native even when preferPolyfill is set", async () => {
    installModelContext({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    const adapter = await resolveAdapter({ preferPolyfill: true });
    expect(adapter.kind).toBe("native");
  });

  it("selects polyfill when native is missing and preferPolyfill is set", async () => {
    clearModelContext();
    const adapter = await resolveAdapter({ preferPolyfill: true });
    expect(adapter.kind).toBe("polyfill");
    expect(adapter.available).toBe(true);
  });

  it("does not treat a navigator-only stub as native when polyfill is preferred", async () => {
    installNavigatorOnly({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    const adapter = await resolveAdapter({ preferPolyfill: true });
    expect(adapter.kind).toBe("polyfill");
  });

  it("uses navigator-only native when polyfill is off", async () => {
    installNavigatorOnly({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    const adapter = await resolveAdapter({ preferPolyfill: false });
    expect(adapter.kind).toBe("native");
  });

  it("createNoopAdapter is unavailable", async () => {
    const adapter = createNoopAdapter();
    expect(adapter.available).toBe(false);
    expect(adapter.kind).toBe("noop");
    await expect(adapter.register(sampleDef)).resolves.toBeUndefined();
  });

  it("createNativeAdapter returns null without modelContext", () => {
    clearModelContext();
    expect(createNativeAdapter()).toBeNull();
  });

  it("hasCanonicalNativeContext is true only for document.modelContext", () => {
    installNavigatorOnly({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    expect(hasCanonicalNativeContext()).toBe(false);
    installModelContext({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    expect(hasCanonicalNativeContext()).toBe(true);
  });

  it("shadows a navigator-only stub that cannot list tools", () => {
    installNavigatorOnly({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    shadowIncompleteNavigatorContext();
    expect(navigator.modelContext).toBeUndefined();
    expect(document.modelContext).toBeUndefined();
  });
});

describe("webmcp adapter registration lifecycle", () => {
  afterEach(() => {
    clearModelContext();
  });

  it("awaits an async registerTool before resolving", async () => {
    let resolveRegister: ((value: void) => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRegister = resolve;
    });
    const registerTool = vi.fn(() => pending);
    installModelContext({ registerTool, unregisterTool: vi.fn() });
    const adapter = createNativeAdapter();
    expect(adapter).not.toBeNull();

    let finished = false;
    const done = adapter!.register(sampleDef).then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    resolveRegister?.();
    await done;
    expect(finished).toBe(true);
    expect(registerTool).toHaveBeenCalledOnce();
  });

  it("passes AbortSignal and uses the returned unregister handle", async () => {
    const unregister = vi.fn();
    const registerTool = vi.fn(
      (_def: NativeToolDefinition, options?: { signal?: AbortSignal }) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        return { unregister };
      },
    );
    const unregisterTool = vi.fn();
    installModelContext({ registerTool, unregisterTool });
    const adapter = createNativeAdapter()!;
    const ac = new AbortController();
    await adapter.register(sampleDef, { signal: ac.signal });
    adapter.unregister(sampleDef.name);
    expect(unregister).toHaveBeenCalledOnce();
    expect(unregisterTool).not.toHaveBeenCalled();
  });

  it("calls unregisterTool when registerTool returns void", async () => {
    const unregisterTool = vi.fn();
    installModelContext({
      registerTool: vi.fn(() => undefined),
      unregisterTool,
    });
    const adapter = createNativeAdapter()!;
    await adapter.register(sampleDef);
    adapter.unregister(sampleDef.name);
    expect(unregisterTool).toHaveBeenCalledWith("probe_tool");
  });

  it("rejects when the provided signal is already aborted", async () => {
    installModelContext({
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
    });
    const adapter = createNativeAdapter()!;
    const ac = new AbortController();
    ac.abort();
    await expect(
      adapter.register(sampleDef, { signal: ac.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
