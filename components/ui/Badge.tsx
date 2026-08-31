import type { ReactNode } from "react";

const tones = {
  neutral: "bg-surface-muted text-foreground border-border",
  accent: "bg-accent-subtle text-accent border-accent/30",
  success: "bg-success-subtle text-success border-success/30",
  warning: "bg-warning-subtle text-warning border-warning/30",
  danger: "bg-danger-subtle text-danger border-danger/30",
  info: "bg-info-subtle text-info border-info/30",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
  dashed = false,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium tracking-wide ${
        dashed ? "border-dashed" : ""
      } ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
