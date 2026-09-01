"use client";

import { motion, useReducedMotion } from "motion/react";

export const STORY_BEATS = [
  { kind: "intent" as const, beat: "intent", tool: "compare products" },
  { kind: "calls" as const, beat: "calls", tool: "get_product ×3" },
  { kind: "friction" as const, beat: "friction", tool: "no compare tool" },
  { kind: "capability" as const, beat: "capability", tool: "compare_products" },
];

export function SignalChainHero() {
  const reduce = useReducedMotion();

  return (
    <ol aria-label="Agent intent, repeated calls, friction, missing capability" className="flex flex-col">
      {STORY_BEATS.map((step, i) => (
        <motion.li
          key={step.kind}
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: reduce ? 0 : 0.14 + i * 0.1,
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex items-baseline gap-4 py-2.5 pl-7"
        >
          {i < STORY_BEATS.length - 1 ? (
            <span
              aria-hidden="true"
              className="trail-glow absolute left-[7px] top-6 h-[calc(100%-6px)] w-px bg-gradient-to-b from-accent/80 via-accent/35 to-transparent"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={`absolute left-0 top-[13px] h-2 w-2 rounded-full ${
              step.kind === "capability"
                ? "bg-accent shadow-[0_0_12px_rgb(217_154_61_/_0.7)]"
                : step.kind === "friction"
                  ? "border border-accent bg-transparent"
                  : "bg-foreground/75"
            }`}
          />
          <span className="w-[7.5rem] shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {step.beat}
          </span>
          <span
            className={
              step.kind === "capability" || step.kind === "friction"
                ? "font-mono text-sm text-accent"
                : "font-mono text-sm text-foreground"
            }
          >
            {step.tool}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
