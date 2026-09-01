import type { ReactNode } from "react";

export function Timeline({
  children,
  label = "Timeline",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <ol
      aria-label={label}
      className="relative ml-3 space-y-0 border-l border-border-strong"
    >
      {children}
    </ol>
  );
}

export function TimelineItem({
  title,
  meta,
  children,
  tone = "neutral",
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "danger"
        ? "bg-danger"
        : tone === "warning"
          ? "bg-warning"
          : "bg-border-strong";

  return (
    <li className="relative pb-6 pl-6">
      <span
        aria-hidden="true"
        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${dot}`}
      />
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="font-mono text-sm font-medium">{title}</p>
        {meta ? <p className="font-mono text-[11px] text-muted">{meta}</p> : null}
      </div>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </li>
  );
}
