import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-accent-ink hover:brightness-110",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
} as const;

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[4px] px-3 py-2 text-sm font-medium whitespace-nowrap transition-[color,background-color,transform] duration-[var(--duration)] ease-[var(--ease-out)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
