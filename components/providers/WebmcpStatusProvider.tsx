"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { getRegistry } from "@/lib/webmcp/registry";
import type { WebmcpAdapter } from "@/lib/webmcp/types";

interface WebmcpStatusValue {
  kind: WebmcpAdapter["kind"];
  available: boolean;
  errors: string[];
  ready: boolean;
  degraded: boolean;
}

const WebmcpStatusContext = createContext<WebmcpStatusValue>({
  kind: "noop",
  available: false,
  errors: [],
  ready: false,
  degraded: false,
});

export function WebmcpStatusProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<WebmcpStatusValue>({
    kind: "noop",
    available: false,
    errors: [],
    ready: false,
    degraded: false,
  });

  useEffect(() => {
    let cancelled = false;
    const registry = getRegistry();

    const apply = () => {
      if (cancelled) return;
      setValue({
        kind: registry.getAdapterKind(),
        available: registry.isAvailable(),
        errors: registry.getErrors(),
        ready: true,
        degraded: telemetryRecorder.isDegraded,
      });
    };

    const timer = window.setTimeout(() => {
      void registry.whenReady().then(apply);
    }, 0);
    const unsubRegistry = registry.subscribe(apply);
    const unsubRecorder = telemetryRecorder.subscribe(() => apply());

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubRegistry();
      unsubRecorder();
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
