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
  getTools?: () => unknown;
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

function isListable(ctx: ModelContextLike | null): boolean {
  return !!ctx && typeof ctx.getTools === "function";
}

/**
 * ChatGPT's in-app browser and Chrome 149+ expose the canonical
 * `document.modelContext`. A navigator-only object is often a Chromium stub
 * (`registerTool` exists, tools never appear to agents).
 */
export function hasCanonicalNativeContext(): boolean {
  if (typeof document === "undefined") return false;
  const ctx = document.modelContext as unknown as ModelContextLike | undefined;
  return !!ctx && typeof ctx.registerTool === "function";
}

/**
 * `@mcp-b/webmcp-polyfill` copies `navigator.modelContext` onto `document` and
 * returns when the navigator surface already exists. Chrome 148's stub would
 * then block a real polyfill. Shadow the stub so the polyfill can install
 * `document.modelContext` + `modelContextTesting`.
 */
export function shadowIncompleteNavigatorContext(): void {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  if (document.modelContext) return;
  const nav = navigator.modelContext as unknown as ModelContextLike | undefined;
  if (!nav || typeof nav.registerTool !== "function") return;
  if (isListable(nav)) return;
  try {
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });
  } catch {
    // Native host objects may reject defineProperty.
  }
}

function polyfillEnabledFromEnv(): boolean {
  return (
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WEBMCP_POLYFILL === "1"
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
        if (resolved && typeof resolved === "object" && "unregister" in resolved) {
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
    shadowIncompleteNavigatorContext();
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
  const preferPolyfill = options?.preferPolyfill ?? polyfillEnabledFromEnv();

  // Canonical native must win so ChatGPT / Chrome 149 agents see Chromium tools.
  if (hasCanonicalNativeContext()) {
    const native = createNativeAdapter();
    if (native) return native;
  }

  if (preferPolyfill) {
    const polyfill = await createPolyfillAdapter();
    if (polyfill) return polyfill;
  }

  const native = createNativeAdapter();
  if (native) return native;

  return createNoopAdapter();
}
