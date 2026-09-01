import { collapseSequence, signatureParts } from "./sequence";

type ToolGlyph = "search" | "box" | "scale" | "cart" | "generic";

function glyphForTool(name: string): ToolGlyph {
  const n = name.toLowerCase();
  if (n.includes("search") || n.includes("find") || n.includes("list")) return "search";
  if (n.includes("compare") || n.includes("diff")) return "scale";
  if (n.includes("cart") || n.includes("checkout") || n.includes("order")) return "cart";
  if (
    n.includes("product") ||
    n.includes("item") ||
    n.includes("get_") ||
    n.includes("read")
  ) {
    return "box";
  }
  return "generic";
}

function ToolIcon({ kind }: { kind: ToolGlyph }) {
  const common = "h-5 w-5";
  switch (kind) {
    case "search":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "scale":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path d="M10 3.5v13M4.5 7.5 10 5l5.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 8.2 4 13.5h3L5.5 8.2ZM14.5 8.2 13 13.5h3l-1.5-5.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "cart":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path d="M3.5 4.5h1.8l1.4 8h8.3l1.5-6H6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.2" cy="15.2" r="1.1" fill="currentColor" />
          <circle cx="13.8" cy="15.2" r="1.1" fill="currentColor" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <path d="M4 7.2 10 4l6 3.2v5.6L10 16 4 12.8V7.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 16V9.5M4 7.2 10 9.5l6-2.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" className={common} fill="none" aria-hidden="true">
          <rect x="4" y="4" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export function SequenceChips({
  signature,
  dashed = false,
  emphasize = false,
  caption,
  className = "",
}: {
  signature: string;
  dashed?: boolean;
  emphasize?: boolean;
  caption?: string;
  className?: string;
}) {
  const chips = collapseSequence(signatureParts(signature));

  return (
    <div className={className}>
      <ol
        className="flex flex-wrap items-center gap-2"
        aria-label={`Journey: ${signature}`}
      >
        {chips.map((chip, i) => {
          const glyph = glyphForTool(chip.name);
          return (
            <li key={`${chip.name}-${i}`} className="inline-flex items-center gap-2">
              {i > 0 ? (
                <span className="text-muted" aria-hidden="true">
                  →
                </span>
              ) : null}
              <span
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  emphasize
                    ? "border-accent/40 bg-accent-subtle text-accent"
                    : dashed
                      ? "border-dashed border-border-strong bg-surface text-muted"
                      : "border-border bg-surface-muted text-foreground"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                    emphasize
                      ? "border-accent/30 bg-surface text-accent"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  <ToolIcon kind={glyph} />
                </span>
                <span className="font-mono text-sm">
                  {chip.name}
                  {chip.count > 1 ? (
                    <span className="ml-1 text-accent">×{chip.count}</span>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {caption ? (
        <p
          className={`mt-3 border-t border-dashed pt-2 text-sm ${
            emphasize ? "border-accent/40 text-accent" : "border-border text-muted"
          }`}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
