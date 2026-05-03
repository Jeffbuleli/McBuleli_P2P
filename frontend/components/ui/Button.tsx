import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-900/30 hover:from-brand-500 hover:to-brand-400 active:scale-[0.98]",
  secondary:
    "bg-primary-900 text-white shadow-card hover:bg-primary-800 dark:bg-primary-950 dark:hover:bg-primary-900",
  outline:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/12 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/5",
  ghost:
    "text-brand-600 hover:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/10",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 py-2 text-xs rounded-xl",
  md: "min-h-11 px-4 py-2.5 text-sm rounded-2xl",
  lg: "min-h-12 px-6 py-3 text-sm font-semibold rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
