"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    country: "CD",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify(form),
      });
      router.push("/auth/login?registered=1");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-white">Create account</h1>
      <p className="mt-1 text-sm text-zinc-500">DRC & Africa — verify email to trade</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {[
          ["fullName", "Full name"],
          ["username", "Username"],
          ["email", "Email"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-xs text-zinc-500">{label}</label>
            <input
              required
              type={k === "email" ? "email" : "text"}
              value={(form as Record<string, string>)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-zinc-500">Password (min 10 chars)</label>
          <input
            type="password"
            required
            minLength={10}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Country (ISO-2)</label>
          <input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-brand-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
