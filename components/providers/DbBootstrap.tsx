"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensureDefaults } from "@/lib/db/repositories";
import { syncActiveCapabilities } from "@/lib/publishing/publish";
import { requestPersistentStorage } from "@/lib/telemetry/recorder";
import { getRegistry } from "@/lib/webmcp/registry";

export function DbBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await ensureDefaults();
          await requestPersistentStorage();
          const registry = getRegistry();
          await registry.whenReady();
          await syncActiveCapabilities();
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Starting ToolGap…
      </div>
    );
  }

  return <>{children}</>;
}
