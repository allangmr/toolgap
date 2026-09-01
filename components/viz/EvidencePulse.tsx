export function EvidencePulse({
  filled,
  threshold = 3,
  label,
}: {
  filled: number;
  threshold?: number;
  label?: string;
}) {
  const count = Math.max(0, filled);
  const slots = Math.max(threshold, count);
  const caption =
    label ??
    `${Math.min(count, threshold)} of ${threshold} supporting sessions toward detection`;

  return (
    <div aria-label={caption}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        Evidence threshold
      </p>
      <ol className="mt-2 flex flex-wrap items-center gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const on = i < count;
          return (
            <li key={i} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`block h-2.5 w-2.5 rounded-full border ${
                  on ? "border-accent bg-accent" : "border-border-strong bg-transparent"
                }`}
              />
              <span className="font-mono text-[11px] text-muted">Session {i + 1}</span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">{caption}</p>
    </div>
  );
}
