"use client";

import { useWebmcpStatus } from "@/components/providers/WebmcpStatusProvider";
import { Badge } from "@/components/ui";

export function WebmcpStatusBadge() {
  const status = useWebmcpStatus();
  if (!status.ready) {
    return <Badge tone="neutral">WebMCP …</Badge>;
  }
  if (status.kind === "native") {
    return <Badge tone="success">WebMCP native</Badge>;
  }
  if (status.kind === "polyfill") {
    return <Badge tone="info">WebMCP polyfill</Badge>;
  }
  return <Badge tone="warning">WebMCP unavailable</Badge>;
}
