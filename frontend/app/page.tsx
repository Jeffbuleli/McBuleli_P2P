import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-500">Africa-first</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">McBuleli P2P</h1>
        <p className="mt-4 text-zinc-400">
          Custodial wallet, Mobile Money on-ramp, and peer-to-peer crypto marketplace — starting with DRC.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth/register"
            className="rounded-xl bg-brand-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-brand-900/40 hover:bg-brand-500"
          >
            Create account
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border border-zinc-700 px-6 py-3 text-center text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-8 text-xs text-zinc-600">
          Not financial advice. Crypto assets are volatile. Use licensed channels for fiat.
        </p>
      </div>
    </div>
  );
}
