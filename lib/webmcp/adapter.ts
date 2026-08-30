import type { NativeToolDefinition, WebmcpAdapter } from "./types";

type ModelContextLike = {
  registerTool: (
    def: NativeToolDefinition,
  ) => void | Promise<void> | { unregister?: () => void };
  unregisterTool?: (name: string) => void;
};

function getModelContext(): ModelContextLike | null {
  if (typeof document !== "undefined" && document.modelContext) {
    return document.modelContext as unknown as ModelContextLike;
  }
  if (typeof navigator !== "undefined" && navigator.modelContext) {
    return navigator.modelContext as unknown as ModelContextLike;
  }
  return null;
}

export function createNoopAdapter(): WebmcpAdapter {
  return {
    kind: "noop",
    available: false,
    register() {
      /* no-op */
    },
    unregister() {
      /* no-op */
    },
  };
}

export function createNativeAdapter(): WebmcpAdapter | null {
  const ctx = getModelContext();
  if (!ctx) return null;

  const handles = new Map<string, { unregister?: () => void }>();

  return {
    kind: "native",
    available: true,
    register(def: NativeToolDefinition) {
      try {
        const result = ctx.registerTool(def);
        if (result && typeof result === "object" && "unregister" in result) {
          handles.set(def.name, result);
        } else if (result && typeof (result as Promise<unknown>).then === "function") {
          void (result as Promise<unknown>).catch((error) => {
            console.warn("[toolgap] registerTool failed", def.name, error);
          });
        }
      } catch (error) {
        console.warn("[toolgap] registerTool failed", def.name, error);
        throw error;
      }
    },
    unregister(name: string) {
      const handle = handles.get(name);
      if (handle?.unregister) {
        handle.unregister();
        handles.delete(name);
        return;
      }
      if (typeof ctx.unregisterTool === "function") {
        ctx.unregisterTool(name);
      }
    },
  };
}

export async function createPolyfillAdapter(): Promise<WebmcpAdapter | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = await import("@mcp-b/global");
    if (typeof mod.initializeWebModelContext === "function") {
      mod.initializeWebModelContext({ installTestingShim: true });
    }
    const native = createNativeAdapter();
    if (!native) return null;
    return { ...native, kind: "polyfill" };
  } catch {
    return null;
  }
}

export async function resolveAdapter(options?: {
  preferPolyfill?: boolean;
}): Promise<WebmcpAdapter> {
  const native = createNativeAdapter();
  if (native) return native;

  const preferPolyfill =
    options?.preferPolyfill ??
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_WEBMCP_POLYFILL === "1");

  if (preferPolyfill) {
    const polyfill = await createPolyfillAdapter();
    if (polyfill) return polyfill;
  }

  return createNoopAdapter();
}
