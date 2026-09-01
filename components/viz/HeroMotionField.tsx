"use client";

import { useReducedMotion } from "motion/react";

export function HeroMotionField() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      <svg
        className="absolute -right-[18%] top-[-8%] h-[88%] w-[88%] opacity-50"
        viewBox="0 0 400 400"
        fill="none"
      >
        <g className="orbit-slow">
          <ellipse cx="200" cy="200" rx="168" ry="86" stroke="rgb(217 154 61 / 0.32)" strokeWidth="0.7" />
        </g>
        <g className="orbit-slower">
          <ellipse cx="200" cy="200" rx="118" ry="164" stroke="rgb(236 238 242 / 0.14)" strokeWidth="0.55" />
        </g>
        <g className="orbit-spark">
          <circle cx="368" cy="200" r="2.4" fill="rgb(217 154 61 / 0.9)" />
          <circle cx="368" cy="200" r="7" fill="rgb(217 154 61 / 0.16)" />
        </g>
      </svg>
    </div>
  );
}
