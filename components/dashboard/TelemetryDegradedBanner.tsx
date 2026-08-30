"use client";

import { useWebmcpStatus } from "@/components/providers/WebmcpStatusProvider";

export function TelemetryDegradedBanner() {
  const status = useWebmcpStatus();
  if (!status.ready || !status.degraded) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-warning bg-warning-subtle px-4 py-2 text-sm text-warning"
    >
      Telemetry writes are failing. New tool calls may not be recorded until storage
      recovers.
    </div>
  );
}
