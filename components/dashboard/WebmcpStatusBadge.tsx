"use client";

import { useId } from "react";
import { useWebmcpStatus } from "@/components/providers/WebmcpStatusProvider";
import { Badge } from "@/components/ui";

function kindLabel(kind: string): string {
  if (kind === "native") return "WebMCP native";
  if (kind === "polyfill") return "WebMCP polyfill";
  return "WebMCP unavailable";
}

function kindTone(kind: string, hasErrors: boolean) {
  if (hasErrors) return "danger" as const;
  if (kind === "native") return "success" as const;
  if (kind === "polyfill") return "info" as const;
  return "warning" as const;
}

export function WebmcpStatusBadge() {
  const status = useWebmcpStatus();
  const panelId = useId();

  if (!status.ready) {
    return <Badge tone="neutral">WebMCP …</Badge>;
  }

  const label = kindLabel(status.kind);
  const hasErrors = status.errors.length > 0;
  const badge = (
    <Badge tone={kindTone(status.kind, hasErrors)}>
      {hasErrors ? `${label} · ${status.errors.length} error${status.errors.length === 1 ? "" : "s"}` : label}
    </Badge>
  );

  if (!hasErrors) return badge;

  return (
    <details className="relative">
      <summary
        className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        aria-controls={panelId}
      >
        {badge}
      </summary>
      <div
        id={panelId}
        role="dialog"
        aria-label="WebMCP registry errors"
        className="absolute left-0 z-20 mt-2 w-72 rounded-md border border-border bg-surface p-3 text-xs shadow-lg"
      >
        <ul className="space-y-1 text-danger">
          {status.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
