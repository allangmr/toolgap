import type { ReactNode } from "react";

export function Table({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-surface-muted/50">
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2.5 align-top tabular-nums ${className}`}>{children}</td>
  );
}
