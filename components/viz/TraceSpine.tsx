"use client";

import { motion, useReducedMotion } from "motion/react";
import type { FrictionSignal, ToolCallEvent } from "@/lib/shared/types";
import { formatDuration } from "@/lib/shared";
import { Badge, StatusBadge } from "@/components/ui";

type Cluster = {
  toolName: string;
  calls: ToolCallEvent[];
  frictionTypes: string[];
};

function clusterCalls(calls: ToolCallEvent[], signals: FrictionSignal[]): Cluster[] {
  const sorted = [...calls].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const clusters: Cluster[] = [];
  for (const call of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.toolName === call.toolName) {
      last.calls.push(call);
    } else {
      clusters.push({ toolName: call.toolName, calls: [call], frictionTypes: [] });
    }
  }
  for (const cluster of clusters) {
    const types = new Set<string>();
    for (const sig of signals) {
      if (sig.involvedTools.includes(cluster.toolName)) types.add(sig.type);
    }
    cluster.frictionTypes = [...types];
  }
  return clusters;
}

export function TraceSpine({
  calls,
  signals,
}: {
  calls: ToolCallEvent[];
  signals: FrictionSignal[];
}) {
  const reduce = useReducedMotion();
  const clusters = clusterCalls(calls, signals);

  return (
    <ol
      aria-label="Tool call timeline"
      className="relative ml-3 border-l border-border-strong"
    >
      {clusters.map((cluster, i) => {
        const failed = cluster.calls.some((c) => !c.success);
        const duration = cluster.calls.reduce((s, c) => s + c.durationMs, 0);
        return (
          <motion.li
            key={`${cluster.toolName}-${cluster.calls[0]?.id}`}
            className="relative pb-7 pl-7"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduce ? 0 : i * 0.04,
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full ${
                failed ? "bg-danger" : "bg-accent"
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-mono text-sm font-medium">{cluster.toolName}</p>
              {cluster.calls.length > 1 ? (
                <span className="font-mono text-xs text-accent">
                  ×{cluster.calls.length}
                </span>
              ) : null}
              <p className="font-mono text-[11px] text-muted">
                {formatDuration(duration)} · seq{" "}
                {cluster.calls.map((c) => c.sequenceIndex).join("-")}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={failed ? "failed" : "completed"} />
              {cluster.calls.some((c) => c.origin === "dynamic") ? (
                <Badge tone="accent">dynamic</Badge>
              ) : null}
              {cluster.frictionTypes.map((type) => (
                <Badge key={type} tone="warning">
                  {type}
                </Badge>
              ))}
            </div>
            {cluster.calls.map((call) => (
              <div key={call.id} className="mt-2 text-sm text-muted">
                {call.entityIds?.length ? (
                  <p className="font-mono text-xs">
                    Entities: {call.entityIds.join(", ")}
                  </p>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-accent">Parameters</summary>
                  <pre className="mt-1 overflow-x-auto rounded-[4px] bg-surface-muted p-2 font-mono text-xs text-foreground">
                    {JSON.stringify(call.input, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </motion.li>
        );
      })}
    </ol>
  );
}
