import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  mono = false,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
  mono?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 inline-flex items-center rounded-lg border border-accent/40 bg-accent-subtle px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`text-4xl leading-[1.1] font-medium tracking-tight md:text-5xl ${
            mono ? "font-mono" : "font-display"
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-base leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
    </header>
  );
}
