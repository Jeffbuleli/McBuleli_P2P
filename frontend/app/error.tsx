"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0b] px-6 text-center text-zinc-200">
      <h1 className="text-xl font-semibold text-white">Une erreur s’est produite</h1>
      <p className="max-w-md text-sm text-zinc-400">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-500"
      >
        Réessayer
      </button>
    </div>
  );
}
