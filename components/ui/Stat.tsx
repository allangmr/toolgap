import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";

export function Stat({
  label,
  value,
  hint,
  sparkline,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  sparkline?: number[];
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 font-display text-3xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 font-mono text-[11px] text-muted">{hint}</p> : null}
      {sparkline ? (
        <div className="mt-3">
          <Sparkline values={sparkline} label={label} />
        </div>
      ) : null}
    </div>
  );
}
