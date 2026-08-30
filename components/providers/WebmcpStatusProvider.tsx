"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getRegistry } from "@/lib/webmcp/registry";
import type { WebmcpAdapter } from "@/lib/webmcp/types";

interface WebmcpStatusValue {
  kind: WebmcpAdapter["kind"];
  available: boolean;
  errors: string[];
  ready: boolean;
}

const WebmcpStatusContext = createContext<WebmcpStatusValue>({
  kind: "noop",
  available: false,
  errors: [],
  ready: false,
});

export function WebmcpStatusProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<WebmcpStatusValue>({
    kind: "noop",
    available: false,
    errors: [],
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const registry = getRegistry();
      await registry.whenReady();
      if (cancelled) return;
      setValue({
        kind: registry.getAdapterKind(),
        available: registry.isAvailable(),
        errors: registry.getErrors(),
        ready: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WebmcpStatusContext.Provider value={value}>
      {children}
    </WebmcpStatusContext.Provider>
  );
}

export function useWebmcpStatus(): WebmcpStatusValue {
  return useContext(WebmcpStatusContext);
}
