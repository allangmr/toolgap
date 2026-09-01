"use client";

import { motion, useReducedMotion } from "motion/react";
import { StatusBadge } from "@/components/ui";
import { SequenceChips } from "./SequenceChips";
import { CountUp } from "./CountUp";

function formatDeltaCalls(before: number, after: number): string {
  const delta = after - before;
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 1)}`;
}

function formatDeltaPct(before: number, after: number): string {
  if (before === 0) return "0%";
  const pct = ((after - before) / before) * 100;
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : "−"}${Math.abs(Math.round(pct))}%`;
}

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
  const improved = proposedCalls < currentCalls;
  const callDelta = formatDeltaCalls(currentCalls, proposedCalls);
  const callPct = formatDeltaPct(currentCalls, proposedCalls);
  const durationDelta = formatDeltaCalls(currentDurationMs, proposedDurationMs);

  return (
    <div className="compare-stage relative isolate overflow-hidden rounded-3xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-card)] md:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 12% 0%, rgb(217 119 47 / 0.16), transparent 55%), radial-gradient(ellipse 60% 45% at 88% 100%, rgb(47 107 69 / 0.08), transparent 50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="compare-grid pointer-events-none absolute inset-0 opacity-[0.35]"
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5"
      >
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Journey collapse
          </p>
          <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-balance md:text-4xl">
            {improved ? "Friction contracts into one capability" : "Proposed journey profile"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImpactPill
            label="Calls"
            value={callDelta}
            tone={improved ? "success" : "neutral"}
            delay={0}
            reduce={Boolean(reduce)}
          />
          <ImpactPill
            label="Load"
            value={callPct}
            tone={improved ? "success" : "neutral"}
            delay={0.08}
            reduce={Boolean(reduce)}
          />
          <ImpactPill
            label="Duration"
            value={`${durationDelta}ms`}
            tone={proposedDurationMs <= currentDurationMs ? "success" : "warning"}
            delay={0.16}
            reduce={Boolean(reduce)}
          />
        </div>
      </motion.div>

      <div className="relative mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1.15fr] lg:items-stretch">
        <FlowPanel
          tone="previous"
          title="Previous flow"
          badge="measured"
          calls={currentCalls}
          durationMs={currentDurationMs}
          durationPrefix="avg"
          signature={currentSignature}
          caption="Multiple calls. More friction."
          emphasize={false}
          dashed
          delay={0.05}
          reduce={Boolean(reduce)}
        />

        <CollapseBridge
          reduce={Boolean(reduce)}
          label={improved ? "Collapses to" : "Becomes"}
        />

        <FlowPanel
          tone="next"
          title="New flow"
          badge="estimated"
          calls={proposedCalls}
          durationMs={proposedDurationMs}
          durationPrefix="est."
          signature={proposedSignature}
          caption="One capability. Clear intent."
          emphasize
          dashed={false}
          delay={0.18}
          reduce={Boolean(reduce)}
        />
      </div>
    </div>
  );
}

function ImpactPill({
  label,
  value,
  tone,
  delay,
  reduce,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
  delay: number;
  reduce: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success-subtle text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning-subtle text-warning"
        : "border-border bg-surface-muted text-foreground";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 22 }}
      className={`rounded-2xl border px-3.5 py-2 ${toneClass}`}
    >
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-80">{label}</p>
      <p className="font-display text-xl font-medium tabular-nums tracking-tight">{value}</p>
    </motion.div>
  );
}

function CollapseBridge({ reduce, label }: { reduce: boolean; label: string }) {
  return (
    <div className="compare-bridge relative flex items-center justify-center self-center py-2 lg:px-2 lg:py-0">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-sm flex-row items-center gap-3 lg:w-16 lg:max-w-none lg:flex-col lg:gap-2"
      >
        <span
          aria-hidden="true"
          className="compare-beam h-px flex-1 bg-gradient-to-r from-transparent via-accent/70 to-transparent lg:h-12 lg:w-px lg:flex-none lg:bg-gradient-to-b"
        />
        <div className="flex flex-col items-center gap-1.5">
          <motion.span
            aria-hidden="true"
            animate={
              reduce
                ? undefined
                : {
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      "0 0 0 rgb(217 119 47 / 0)",
                      "0 0 18px rgb(217 119 47 / 0.35)",
                      "0 0 0 rgb(217 119 47 / 0)",
                    ],
                  }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-accent text-accent-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M4.5 10h11M11 5.5 15.5 10 11 14.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.span>
          <span className="max-w-[5.5rem] text-center font-mono text-[10px] leading-tight tracking-[0.14em] text-accent uppercase">
            {label}
          </span>
        </div>
        <span
          aria-hidden="true"
          className="compare-beam h-px flex-1 bg-gradient-to-r from-transparent via-accent/70 to-transparent lg:h-12 lg:w-px lg:flex-none lg:bg-gradient-to-b"
        />
      </motion.div>
    </div>
  );
}

function FlowPanel({
  tone,
  title,
  badge,
  calls,
  durationMs,
  durationPrefix,
  signature,
  caption,
  emphasize,
  dashed,
  delay,
  reduce,
}: {
  tone: "previous" | "next";
  title: string;
  badge: "measured" | "estimated";
  calls: number;
  durationMs: number;
  durationPrefix: string;
  signature: string;
  caption: string;
  emphasize: boolean;
  dashed: boolean;
  delay: number;
  reduce: boolean;
}) {
  const isNext = tone === "next";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={
        isNext
          ? "compare-panel-next relative min-w-0 overflow-hidden rounded-2xl border border-accent/40 bg-accent-subtle/50 p-5 shadow-[0_12px_40px_rgb(217_119_47_/_0.14)]"
          : "relative min-w-0 overflow-hidden rounded-2xl border border-border/90 bg-surface/80 p-5 opacity-95"
      }
      aria-label={isNext ? "New estimated journey" : "Previous measured journey"}
    >
      {isNext ? (
        <span
          aria-hidden="true"
          className="compare-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-2xl font-medium tracking-tight">{title}</h3>
        <StatusBadge status={badge} />
      </div>

      <p className="mt-3 font-display text-4xl font-medium tracking-tight tabular-nums md:text-5xl">
        <CountUp value={calls} decimals={calls % 1 === 0 ? 0 : 2} />
        <span className="ml-2 font-sans text-sm font-normal text-muted">calls</span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted">
        {durationPrefix} duration {durationMs}ms
      </p>

      <div className="mt-5">
        <SequenceChips
          signature={signature}
          emphasize={emphasize}
          dashed={dashed}
          caption={caption}
          animated
        />
      </div>
    </motion.section>
  );
}
