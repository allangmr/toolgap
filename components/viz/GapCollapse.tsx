"use client";

import { motion, useReducedMotion } from "motion/react";
import { StatusBadge } from "@/components/ui";
import { SequenceChips } from "./SequenceChips";
import { CountUp } from "./CountUp";

export function GapCollapse({
  currentSignature,
  proposedSignature,
  currentCalls,
  proposedCalls,
  currentDurationMs,
  proposedDurationMs,
}: {
  currentSignature: string;
  proposedSignature: string;
  currentCalls: number;
  proposedCalls: number;
  currentDurationMs: number;
  proposedDurationMs: number;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <motion.section
        layout={!reduce}
        className="min-w-0 rounded-2xl border border-accent/35 bg-accent-subtle/40 p-5"
        aria-label="New estimated journey"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-medium tracking-tight">New flow</h2>
          <StatusBadge status="estimated" />
        </div>
        <p className="mt-3 font-display text-4xl font-medium tracking-tight tabular-nums md:text-5xl">
          <CountUp value={proposedCalls} decimals={proposedCalls % 1 === 0 ? 0 : 2} />
          <span className="ml-2 font-sans text-sm font-normal text-muted">calls</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          est. duration {proposedDurationMs}ms
        </p>
        <div className="mt-5">
          <SequenceChips
            signature={proposedSignature}
            emphasize
            caption="One capability. Clear intent."
          />
        </div>
      </motion.section>

      <motion.section
        layout={!reduce}
        className="min-w-0 rounded-2xl border border-border bg-surface p-5"
        aria-label="Previous measured journey"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-medium tracking-tight">Previous flow</h2>
          <StatusBadge status="measured" />
        </div>
        <p className="mt-3 font-display text-4xl font-medium tracking-tight tabular-nums md:text-5xl">
          <CountUp value={currentCalls} decimals={currentCalls % 1 === 0 ? 0 : 2} />
          <span className="ml-2 font-sans text-sm font-normal text-muted">calls</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          avg duration {currentDurationMs}ms
        </p>
        <div className="mt-5">
          <SequenceChips
            signature={currentSignature}
            dashed
            caption="Multiple calls. More friction."
          />
        </div>
      </motion.section>
    </div>
  );
}
