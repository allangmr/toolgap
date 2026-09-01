"use client";

import { motion, useReducedMotion } from "motion/react";
import { collapseSequence, signatureParts } from "./sequence";

type ToolGlyph = "search" | "box" | "scale" | "cart" | "generic";

function glyphForTool(name: string): ToolGlyph {
  const n = name.toLowerCase();
  if (n.includes("search") || n.includes("find") || n.includes("list")) return "search";
  if (n.includes("compare") || n.includes("diff") || n.includes("batch")) return "scale";
  if (n.includes("cart") || n.includes("checkout") || n.includes("order")) return "cart";
  if (
    n.includes("product") ||
    n.includes("item") ||
    n.includes("get_") ||
    n.includes("read") ||
    n.includes("availability")
  ) {
    return "box";
  }
  return "generic";
}

function ToolIcon({ kind }: { kind: ToolGlyph }) {
  const common = "h-5 w-5";
  switch (kind) {
    case "search":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="m13.2 13.2 3.3 3.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "scale":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path
            d="M10 3.5v13M4.5 7.5 10 5l5.5 2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 8.2 4 13.5h3L5.5 8.2ZM14.5 8.2 13 13.5h3l-1.5-5.3Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "cart":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path
            d="M3.5 4.5h1.8l1.4 8h8.3l1.5-6H6.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8.2" cy="15.2" r="1.1" fill="currentColor" />
          <circle cx="13.8" cy="15.2" r="1.1" fill="currentColor" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path
            d="M4 7.2 10 4l6 3.2v5.6L10 16 4 12.8V7.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M10 16V9.5M4 7.2 10 9.5l6-2.3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <rect x="4" y="4" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export function SequenceChips({
  signature,
  dashed = false,
  emphasize = false,
  caption,
  animated = false,
  className = "",
}: {
  signature: string;
  dashed?: boolean;
  emphasize?: boolean;
  caption?: string;
  animated?: boolean;
  className?: string;
}) {
  const chips = collapseSequence(signatureParts(signature));
  const reduce = useReducedMotion();
  const enableMotion = animated && !reduce;

  return (
    <div className={className}>
      <ol className="flex flex-wrap items-center gap-2" aria-label={`Journey: ${signature}`}>
        {chips.map((chip, i) => {
          const glyph = glyphForTool(chip.name);
          return (
            <motion.li
              key={`${chip.name}-${i}`}
              className="inline-flex items-center gap-2"
              initial={enableMotion ? { opacity: 0, y: 10, scale: 0.94 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: enableMotion ? i * 0.07 : 0,
                type: "spring",
                stiffness: 380,
                damping: 24,
              }}
            >
              {i > 0 ? (
                <motion.span
                  aria-hidden="true"
                  className={emphasize ? "text-accent" : "text-muted"}
                  animate={
                    enableMotion && emphasize
                      ? { opacity: [0.35, 1, 0.35] }
                      : undefined
                  }
                  transition={
                    enableMotion && emphasize
                      ? { duration: 1.8, repeat: Infinity, delay: i * 0.12 }
                      : undefined
                  }
                >
                  →
                </motion.span>
              ) : null}
              <span
                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-transform duration-200 hover:-translate-y-0.5 ${
                  emphasize
                    ? "border-accent/45 bg-surface shadow-[0_8px_24px_rgb(217_119_47_/_0.12)] text-accent"
                    : dashed
                      ? "border-dashed border-border-strong bg-surface/70 text-muted"
                      : "border-border bg-surface-muted text-foreground"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    emphasize
                      ? "border-accent/35 bg-accent text-accent-ink"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  <ToolIcon kind={glyph} />
                </span>
                <span className="font-mono text-sm">
                  {chip.name}
                  {chip.count > 1 ? (
                    <span className="ml-1 text-accent">×{chip.count}</span>
                  ) : null}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ol>
      {caption ? (
        <motion.p
          initial={enableMotion ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: enableMotion ? 0.2 + chips.length * 0.05 : 0 }}
          className={`mt-3 border-t border-dashed pt-2 text-sm ${
            emphasize ? "border-accent/40 text-accent" : "border-border text-muted"
          }`}
        >
          {caption}
        </motion.p>
      ) : null}
    </div>
  );
}
