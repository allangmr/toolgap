export function ConfidenceBand({
  value,
  label = "Confidence",
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {label}
        </p>
        <p className="font-mono text-xs tabular-nums">{value.toFixed(2)}</p>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-[2px] bg-surface-muted"
        role="meter"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
