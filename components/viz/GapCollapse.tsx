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
    <div className="grid gap-8 lg:grid-cols-2">
      <motion.section
        layout={!reduce}
        className="min-w-0"
        aria-label="Current measured journey"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-medium">Current (measured)</h2>
          <StatusBadge status="measured" />
        </div>
        <p className="mt-3 font-display text-4xl font-medium tabular-nums tracking-tight">
          <CountUp value={currentCalls} decimals={currentCalls % 1 === 0 ? 0 : 2} />
          <span className="ml-2 font-sans text-sm font-normal text-muted">calls</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          avg duration {currentDurationMs}ms
        </p>
        <div className="mt-4">
          <SequenceChips signature={currentSignature} />
        </div>
      </motion.section>

      <motion.section
        layout={!reduce}
        className="min-w-0"
        aria-label="Proposed estimated journey"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-medium">Proposed (estimated)</h2>
          <StatusBadge status="estimated" />
        </div>
        <p className="mt-3 font-display text-4xl font-medium tabular-nums tracking-tight">
          <CountUp value={proposedCalls} decimals={proposedCalls % 1 === 0 ? 0 : 2} />
          <span className="ml-2 font-sans text-sm font-normal text-muted">calls</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          est. duration {proposedDurationMs}ms
        </p>
        <div className="mt-4">
          <SequenceChips signature={proposedSignature} dashed />
        </div>
      </motion.section>
    </div>
  );
}
