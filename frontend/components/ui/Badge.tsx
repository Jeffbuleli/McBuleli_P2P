type Tone = "success" | "warning" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  neutral: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  brand: "bg-brand-500/15 text-brand-700 dark:text-brand-300",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
