import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-card backdrop-blur-sm dark:border-white/[0.1] dark:bg-surface-secondary/80 dark:shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
