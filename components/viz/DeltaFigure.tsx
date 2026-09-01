export function DeltaFigure({
  before,
  after,
  unit = "calls",
  beforeLabel = "Before (measured)",
  afterLabel = "After (measured)",
}: {
  before: number;
  after: number;
  unit?: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const delta = before === 0 ? 0 : ((after - before) / before) * 100;
  const improved = after < before;
  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {beforeLabel}
        </p>
        <p className="mt-1 font-display text-4xl font-medium tabular-nums tracking-tight">
          {before}
          <span className="ml-2 font-sans text-sm font-normal text-muted">{unit}</span>
        </p>
      </div>
      <p
        className={`font-display text-2xl tabular-nums ${
          improved ? "text-success" : "text-danger"
        }`}
      >
        {delta === 0 ? "0%" : `${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
      </p>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {afterLabel}
        </p>
        <p className="mt-1 font-display text-4xl font-medium tabular-nums tracking-tight">
          {after}
          <span className="ml-2 font-sans text-sm font-normal text-muted">{unit}</span>
        </p>
      </div>
    </div>
  );
}
