import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  actions,
  visual,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-dashed border-border-strong bg-surface-muted/50 px-6 py-10">
      {visual}
      <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted">{description}</p>
      {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}
