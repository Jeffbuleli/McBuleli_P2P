import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  error,
  className = "",
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
}) {
  const cid = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={cid} className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-zinc-400">
          {label}
        </label>
      )}
      <input
        id={cid}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 ${className}`}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
