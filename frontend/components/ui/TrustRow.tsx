import { Lock, ShieldCheck } from "lucide-react";

export function TrustRow({
  escrowLabel,
  secureLabel,
}: {
  escrowLabel: string;
  secureLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-brand-500" aria-hidden />
        {escrowLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="h-4 w-4 text-primary-500 dark:text-primary-400" aria-hidden />
        {secureLabel}
      </span>
    </div>
  );
}
