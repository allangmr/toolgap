import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
  mono = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  mono?: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1
          className={`text-3xl font-medium tracking-tight md:text-4xl ${
            mono ? "font-mono" : "font-display"
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </header>
  );
}
