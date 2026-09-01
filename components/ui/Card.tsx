import type { ReactNode } from "react";

const variants = {
  default: "border border-border bg-surface",
  plain: "border-0 bg-transparent p-0 shadow-none",
  discovery: "border border-accent/35 bg-accent-subtle/40",
} as const;

export function Card({
  children,
  className = "",
  as: Tag = "div",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  variant?: keyof typeof variants;
}) {
  return (
    <Tag className={`rounded-[4px] p-4 ${variants[variant]} ${className}`}>
      {children}
    </Tag>
  );
}
