"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensureDefaults } from "@/lib/db/repositories";

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
