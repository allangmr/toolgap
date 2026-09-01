"use client";

import { motion, useReducedMotion } from "motion/react";

export function CountUp({
  value,
  decimals = 0,
  className = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={reduce ? "static" : value}
      className={`tabular-nums ${className}`}
      initial={reduce ? false : { opacity: 0.35, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {value.toFixed(decimals)}
    </motion.span>
  );
}
