import type {
  AdapterRegisterOptions,
  NativeToolDefinition,
  WebmcpAdapter,
} from "./types";

type RegisterToolResult =
  | void
  | Promise<void | { unregister?: () => void }>
  | { unregister?: () => void };

type ModelContextLike = {
  registerTool: (
    def: NativeToolDefinition,
    options?: { signal?: AbortSignal },
  ) => RegisterToolResult;
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

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export function createNoopAdapter(): WebmcpAdapter {
  return {
    kind: "noop",
    available: false,
    async register() {
      return;
    },
    unregister() {
      return;
    },
  };
}

export function createNativeAdapter(): WebmcpAdapter | null {
  const ctx = getModelContext();
  if (!ctx) return null;

  const handles = new Map<string, { unregister?: () => void }>();
  const controllers = new Map<string, AbortController>();

  return {
    kind: "native",
    available: true,
    async register(def: NativeToolDefinition, options?: AdapterRegisterOptions) {
      if (options?.signal?.aborted) {
        throw new DOMException("Registration aborted", "AbortError");
      }

      const local = new AbortController();
      const onAbort = () => {
        local.abort();
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });
      controllers.set(def.name, local);

      try {
        const result = ctx.registerTool(def, { signal: local.signal });
        const resolved = isThenable(result) ? await result : result;
        if (
          resolved &&
          typeof resolved === "object" &&
          "unregister" in resolved
        ) {
          handles.set(def.name, resolved);
        }
      } catch (error) {
        controllers.delete(def.name);
        options?.signal?.removeEventListener("abort", onAbort);
        console.warn("[toolgap] registerTool failed", def.name, error);
        throw error;
      }
    },
    unregister(name: string) {
      const local = controllers.get(name);
      controllers.delete(name);
      if (local && !local.signal.aborted) {
        local.abort();
      }

      const handle = handles.get(name);
      handles.delete(name);
      if (handle?.unregister) {
        handle.unregister();
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
