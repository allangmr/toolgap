"use client";

import { motion, useReducedMotion } from "motion/react";

const CHAIN = [
  { label: "search_products", kind: "call" as const },
  { label: "get_product ×3", kind: "call" as const },
  { label: "get_availability", kind: "call" as const },
  { label: "friction", kind: "signal" as const },
  { label: "compare_products", kind: "gap" as const },
];

export function SignalChainHero() {
  const reduce = useReducedMotion();

  return (
    <ol
      aria-label="Agent journey collapsing into a capability gap"
      className="flex flex-col gap-0 font-mono text-sm"
    >
      {CHAIN.map((step, i) => (
        <motion.li
          key={step.label}
          initial={reduce ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: reduce ? 0 : 0.12 + i * 0.08,
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex items-center gap-3 py-1.5 pl-6"
        >
          {i < CHAIN.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[7px] top-5 h-[calc(100%-4px)] w-px bg-border-strong"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={`absolute left-0 top-3 h-2 w-2 rounded-full ${
              step.kind === "gap"
                ? "bg-accent"
                : step.kind === "signal"
                  ? "border border-warning bg-transparent"
                  : "bg-foreground/70"
            }`}
          />
          <span
            className={
              step.kind === "gap"
                ? "text-accent"
                : step.kind === "signal"
                  ? "text-[11px] uppercase tracking-wider text-warning"
                  : "text-foreground"
            }
          >
            {step.label}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
