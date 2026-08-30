import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </Tag>
  );
}
