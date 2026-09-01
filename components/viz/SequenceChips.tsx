import { collapseSequence, signatureParts } from "./sequence";

export function SequenceChips({
  signature,
  dashed = false,
  className = "",
}: {
  signature: string;
  dashed?: boolean;
  className?: string;
}) {
  const chips = collapseSequence(signatureParts(signature));
  return (
    <p
      className={`flex flex-wrap items-center gap-y-1 font-mono text-sm leading-relaxed ${className}`}
      aria-label={`Journey: ${signature}`}
    >
      {chips.map((chip, i) => (
        <span key={`${chip.name}-${i}`} className="inline-flex items-center">
          {i > 0 ? (
            <span className="mx-1.5 text-muted" aria-hidden="true">
              →
            </span>
          ) : null}
          <span
            className={`rounded-sm border px-1.5 py-0.5 ${
              dashed
                ? "border-dashed border-warning/50 text-warning"
                : "border-border bg-surface-muted"
            }`}
          >
            {chip.name}
            {chip.count > 1 ? (
              <span className="ml-1 text-accent">×{chip.count}</span>
            ) : null}
          </span>
        </span>
      ))}
    </p>
  );
}
