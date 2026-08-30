import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-6 py-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xl text-sm text-muted">{description}</p>
      {actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
    </div>
  );
}
