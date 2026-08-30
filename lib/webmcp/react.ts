"use client";

import { useEffect, useRef } from "react";
import { getRegistry, type ToolgapToolDefinition } from "./registry";
import type { ToolHandler } from "./types";

/**
 * Registers a WebMCP tool for the lifetime of the component.
 * Handler is kept fresh via ref to avoid stale closures without re-registering.
 */
export function useWebmcpTool(
  definition: Omit<ToolgapToolDefinition, "handler"> & { handler: ToolHandler },
): void {
  const handlerRef = useRef(definition.handler);
  handlerRef.current = definition.handler;

  const name = definition.name;
  const version = definition.version;
  const description = definition.description;
  const surface = definition.surface;
  const origin = definition.origin;
  const capabilityId = definition.capabilityId;
  const readOnly = definition.readOnly;
  const inputSchema = definition.inputSchema;

  useEffect(() => {
    const registry = getRegistry();
    let cancelled = false;

    void (async () => {
      await registry.whenReady();
      if (cancelled) return;
      if (registry.has(name)) {
        registry.updateHandler(name, (params) => handlerRef.current(params));
        return;
      }
      try {
        await registry.registerTool({
          name,
          description,
          version,
          inputSchema,
          surface,
          origin,
          capabilityId,
          readOnly,
          redactKeys: definition.redactKeys,
          entityExtractor: definition.entityExtractor,
          handler: (params) => handlerRef.current(params),
        });
      } catch (error) {
        console.warn(`[toolgap] failed to register ${name}`, error);
      }
    })();

    return () => {
      cancelled = true;
      // Keep static tools registered across soft navigations within the same surface.
      // Dynamic tools are managed by DynamicCapabilityLoader.
      if (origin === "dynamic") {
        getRegistry().unregisterTool(name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, version, description, surface, origin, capabilityId, readOnly]);
}
