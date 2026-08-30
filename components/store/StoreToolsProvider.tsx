"use client";

import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { publishedRepo } from "@/lib/db/repositories";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import {
  registerStaticStoreTools,
} from "@/lib/webmcp/store-tools";
import { getRegistry } from "@/lib/webmcp/registry";
import {
  registerPublishedCapability,
} from "@/lib/publishing/publish";

export function StoreToolsProvider({ children }: { children: React.ReactNode }) {
  const registered = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureCatalogSeeded();
      const registry = getRegistry();
      await registry.whenReady();
      if (cancelled || registered.current) return;
      const existing = new Set(registry.listTools().map((t) => t.name));
      if (!existing.has("search_products")) {
        await registerStaticStoreTools((def) => registry.registerTool(def));
      }
      registered.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

export function DynamicCapabilityLoader() {
  const active = useLiveQuery(() => publishedRepo.active(), []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      const registry = getRegistry();
      await registry.whenReady();
      if (cancelled) return;

      const desired = new Set(active.map((c) => c.toolName));
      for (const tool of registry.listTools()) {
        if (tool.origin === "dynamic" && !desired.has(tool.name)) {
          registry.unregisterTool(tool.name);
        }
      }
      for (const cap of active) {
        if (!registry.has(cap.toolName)) {
          try {
            await registerPublishedCapability(cap);
          } catch (error) {
            console.warn("[toolgap] dynamic register failed", cap.toolName, error);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return null;
}
