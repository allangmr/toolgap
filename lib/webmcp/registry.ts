import type { z } from "zod";
import { createId, nowMs } from "@/lib/shared";
import type {
  ErrorCategory,
  ResultMeta,
  Surface,
  ToolCallEvent,
  ToolOrigin,
} from "@/lib/shared/types";
import { nextCallContext } from "@/lib/sessions/sessionizer";
import { redactValue, safeJsonSchema, truncateError } from "@/lib/telemetry/redaction";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { createNoopAdapter, resolveAdapter } from "./adapter";
import type {
  McpToolResult,
  NativeToolDefinition,
  ToolHandler,
  WebmcpAdapter,
} from "./types";

export interface ToolgapToolDefinition {
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodType;
  handler: ToolHandler;
  surface: Surface;
  origin: ToolOrigin;
  capabilityId?: string;
  redactKeys?: string[];
  entityExtractor?: (
    input: Record<string, unknown>,
    result: unknown,
  ) => string[] | undefined;
  readOnly?: boolean;
  /** When true, skip telemetry (rarely used). */
  silent?: boolean;
}

interface RegisteredTool {
  definition: ToolgapToolDefinition;
  handlerRef: { current: ToolHandler };
  native: NativeToolDefinition;
}

function textResult(payload: unknown, isError = false): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
}

function categorizeError(error: unknown): ErrorCategory {
  if (error && typeof error === "object" && "category" in error) {
    const cat = (error as { category?: string }).category;
    if (
      cat === "validation" ||
      cat === "execution" ||
      cat === "not_found" ||
      cat === "timeout" ||
      cat === "unavailable"
    ) {
      return cat;
    }
  }
  return "execution";
}

function buildResultMeta(success: boolean, result: unknown, entityIds?: string[]): ResultMeta {
  let itemCount: number | undefined;
  if (Array.isArray(result)) itemCount = result.length;
  else if (result && typeof result === "object" && "products" in result) {
    const products = (result as { products?: unknown }).products;
    if (Array.isArray(products)) itemCount = products.length;
  } else if (result && typeof result === "object" && "items" in result) {
    const items = (result as { items?: unknown }).items;
    if (Array.isArray(items)) itemCount = items.length;
  }

  let resultBytes: number | undefined;
  try {
    resultBytes = JSON.stringify(result ?? null).length;
  } catch {
    resultBytes = undefined;
  }

  return {
    ok: success,
    itemCount,
    entityIds,
    resultBytes,
  };
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private adapter: WebmcpAdapter = createNoopAdapter();
  private ready: Promise<void>;
  private registryErrors: string[] = [];

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    this.adapter = await resolveAdapter();
  }

  async whenReady(): Promise<void> {
    await this.ready;
  }

  getAdapterKind(): WebmcpAdapter["kind"] {
    return this.adapter.kind;
  }

  isAvailable(): boolean {
    return this.adapter.available;
  }

  getErrors(): string[] {
    return [...this.registryErrors];
  }

  listTools(): ToolgapToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  updateHandler(name: string, handler: ToolHandler): void {
    const existing = this.tools.get(name);
    if (!existing) return;
    existing.handlerRef.current = handler;
    existing.definition = { ...existing.definition, handler };
  }

  async registerTool(definition: ToolgapToolDefinition): Promise<void> {
    await this.ready;

    if (this.tools.has(definition.name)) {
      throw new Error(`Tool already registered: ${definition.name}`);
    }

    const handlerRef = { current: definition.handler };
    const inputSchemaJson = safeJsonSchema(definition.inputSchema);

    const execute = async (
      params: Record<string, unknown>,
    ): Promise<McpToolResult> => {
      return this.invokeInternal(definition.name, params, { viaAdapter: true });
    };

    // Keep handlerRef in sync for invokeInternal
    void handlerRef;

    const native: NativeToolDefinition = {
      name: definition.name,
      description: definition.description,
      inputSchema: inputSchemaJson,
      annotations: definition.readOnly ? { readOnlyHint: true } : undefined,
      execute,
    };

    this.tools.set(definition.name, {
      definition: { ...definition, handler: (...args) => handlerRef.current(...args) },
      handlerRef,
      native,
    });

    // Re-bind execute to use current definition lookup
    native.execute = async (params) =>
      this.invokeInternal(definition.name, params, { viaAdapter: true });

    try {
      this.adapter.register(native);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.registryErrors.push(`register ${definition.name}: ${message}`);
      this.tools.delete(definition.name);
      throw error;
    }
  }

  unregisterTool(name: string): void {
    if (!this.tools.has(name)) return;
    try {
      this.adapter.unregister(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.registryErrors.push(`unregister ${name}: ${message}`);
    }
    this.tools.delete(name);
  }

  /** Invoke as an agent would — used by driver and tests. */
  async invoke(
    name: string,
    params: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    await this.ready;
    return this.invokeInternal(name, params, { viaAdapter: false });
  }

  private async invokeInternal(
    name: string,
    params: Record<string, unknown>,
    _opts: { viaAdapter: boolean },
  ): Promise<McpToolResult> {
    const registered = this.tools.get(name);
    if (!registered) {
      return textResult({ error: `Unknown tool: ${name}` }, true);
    }

    const def = registered.definition;
    const started = nowMs();
    const page =
      typeof window !== "undefined" ? window.location.pathname : "/";

    const parsed = def.inputSchema.safeParse(params ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      await this.emitEvent({
        def,
        params,
        page,
        started,
        success: false,
        errorCategory: "validation",
        errorMessage: message,
        result: null,
      });
      return textResult({ error: "validation_failed", details: message }, true);
    }

    try {
      const result = await registered.handlerRef.current(parsed.data as Record<string, unknown>);
      await this.emitEvent({
        def,
        params: parsed.data as Record<string, unknown>,
        page,
        started,
        success: true,
        result,
      });
      return textResult(result);
    } catch (error) {
      const category = categorizeError(error);
      const message = error instanceof Error ? error.message : String(error);
      await this.emitEvent({
        def,
        params: parsed.data as Record<string, unknown>,
        page,
        started,
        success: false,
        errorCategory: category,
        errorMessage: message,
        result: null,
      });
      return textResult({ error: category, message }, true);
    }
  }

  private async emitEvent(args: {
    def: ToolgapToolDefinition;
    params: Record<string, unknown>;
    page: string;
    started: number;
    success: boolean;
    errorCategory?: ErrorCategory;
    errorMessage?: string;
    result: unknown;
  }): Promise<void> {
    if (args.def.silent) return;

    const { sessionId, sequenceIndex } = await nextCallContext(args.def.surface);
    const entityIds =
      args.def.entityExtractor?.(args.params, args.result) ??
      extractDefaultEntityIds(args.params, args.result);

    const event: ToolCallEvent = {
      id: createId(),
      sessionId,
      timestamp: args.started,
      sequenceIndex,
      toolName: args.def.name,
      toolVersion: args.def.version,
      origin: args.def.origin,
      surface: args.def.surface,
      capabilityId: args.def.capabilityId,
      input: redactValue(args.params, args.def.redactKeys),
      resultMeta: buildResultMeta(args.success, args.result, entityIds),
      success: args.success,
      errorCategory: args.errorCategory,
      errorMessage: args.errorMessage
        ? truncateError(args.errorMessage)
        : undefined,
      durationMs: Math.max(0, nowMs() - args.started),
      page: args.page,
      entityIds,
    };

    telemetryRecorder.record(event);
  }

  /** Test helper */
  setAdapterForTests(adapter: WebmcpAdapter): void {
    this.adapter = adapter;
    this.ready = Promise.resolve();
  }

  clearForTests(): void {
    for (const name of [...this.tools.keys()]) {
      this.unregisterTool(name);
    }
    this.registryErrors = [];
  }
}

function extractDefaultEntityIds(
  params: Record<string, unknown>,
  result: unknown,
): string[] | undefined {
  const ids = new Set<string>();
  if (typeof params.productId === "string") ids.add(params.productId);
  if (Array.isArray(params.productIds)) {
    for (const id of params.productIds) {
      if (typeof id === "string") ids.add(id);
    }
  }
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
  }
  return ids.size > 0 ? [...ids] : undefined;
}

let singleton: ToolRegistry | null = null;

export function getRegistry(): ToolRegistry {
  if (!singleton) singleton = new ToolRegistry();
  return singleton;
}

export function resetRegistryForTests(): ToolRegistry {
  if (singleton) singleton.clearForTests();
  singleton = new ToolRegistry();
  return singleton;
}
