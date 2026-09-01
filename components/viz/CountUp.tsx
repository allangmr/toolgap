"use client";

import { useReducedMotion } from "motion/react";

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
    <span className={`tabular-nums ${className}`}>
      {value.toFixed(decimals)}
    </span>
  );
}
