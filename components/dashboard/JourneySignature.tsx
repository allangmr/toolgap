export function JourneySignature({ signature }: { signature: string }) {
  const parts = signature.split(">");
  return (
    <p className="font-mono text-sm leading-relaxed" aria-label={`Journey: ${signature}`}>
      {parts.map((part, i) => (
        <span key={`${part}-${i}`}>
          {i > 0 ? <span className="mx-1 text-muted">→</span> : null}
          <span className="rounded bg-surface-muted px-1.5 py-0.5">{part}</span>
        </span>
      ))}
    </p>
  );
}
