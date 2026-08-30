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
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {sparkline ? (
        <div className="mt-3">
          <Sparkline values={sparkline} label={label} />
        </div>
      ) : null}
    </div>
  );
}
