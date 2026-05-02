"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
      }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          email,
          password,
          ...(needs2fa || code ? { twoFactorCode: code } : {}),
        }),
      });
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      router.push("/app/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (msg.includes("2FA")) setNeeds2fa(true);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">Welcome back to McBuleli P2P</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs text-zinc-500">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        {(needs2fa || code) && (
          <div>
            <label className="text-xs text-zinc-500">2FA code</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              placeholder="Google Authenticator"
            />
          </div>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Continue"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/auth/register" className="text-brand-400 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
