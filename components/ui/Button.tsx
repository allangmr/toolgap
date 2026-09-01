import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-accent text-accent-ink shadow-[0_1px_2px_rgb(93_76_48_/_0.18),0_10px_24px_rgb(217_119_47_/_0.28)] hover:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface-raised text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-accent-ink hover:brightness-110",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
} as const;

const sizes = {
  md: "min-h-11 px-5 py-2.5 text-[15px]",
  lg: "min-h-12 px-6 py-3 text-base",
  sm: "min-h-9 px-3.5 py-2 text-sm",
} as const;

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[color,background-color,transform,box-shadow] duration-[var(--duration)] ease-[var(--ease-out)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
