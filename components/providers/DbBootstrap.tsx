"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensureDefaults } from "@/lib/db/repositories";
import { requestPersistentStorage } from "@/lib/telemetry/recorder";

/**
 * Ensures IndexedDB defaults exist outside liveQuery read contexts.
 */
export function DbBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDefaults();
        await requestPersistentStorage();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
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
