"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type Me = { isAdmin?: boolean };
type StaffRole = "ADMIN" | "TREASURY" | "AGENT";
type StaffUserRow = { id: string; email: string; username: string; roles: StaffRole[] };
type SearchHit = {
  id: string;
  email: string;
  username: string;
  kycStatus: string;
  isFrozen: boolean;
  isBlacklisted: boolean;
  country: string;
  createdAt: string;
};

const ROLES: StaffRole[] = ["ADMIN", "TREASURY", "AGENT"];

export default function AdminStaffRolesPage() {
  const { t } = useI18n();
  const [gate, setGate] = useState<"load" | "ok" | "deny">("load");
  const [rows, setRows] = useState<StaffUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState<StaffRole>("AGENT");
  const [submitting, setSubmitting] = useState(false);

  const loadRows = useCallback(() => {
    setErr(null);
    return api<{ users: StaffUserRow[] }>("/api/admin/staff-roles")
      .then((r) => setRows(r.users))
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    api<Me>("/api/users/me")
      .then((m) => {
        if (m.isAdmin) {
          setGate("ok");
          loadRows();
        } else setGate("deny");
      })
      .catch(() => setGate("deny"));
  }, [loadRows]);

  function translateErr(raw: string): string {
    const key = `admin.roles.errors.${raw}`;
    const out = t(key);
    return out !== key ? out : raw;
  }

  function roleLabel(role: StaffRole): string {
    const key = `admin.roles.role${role}` as const;
    const out = t(key);
    return out !== key ? out : role;
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setErr(null);
    setHits([]);
    try {
      const list = await api<SearchHit[]>(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
      setHits(list);
    } catch (e) {
      setErr(e instanceof Error ? translateErr(e.message) : "Error");
    } finally {
      setSearching(false);
    }
  }

  async function onAssign() {
    if (!selectedId) return;
    setSubmitting(true);
    setErr(null);
    setMsg(null);
    try {
      await api("/api/admin/staff-roles", {
        method: "POST",
        body: JSON.stringify({ userId: selectedId, role: rolePick }),
      });
      setMsg(t("admin.roles.assignedOk"));
      await loadRows();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setErr(translateErr(raw));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevoke(userId: string, role: StaffRole) {
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/admin/staff-roles/${userId}/${role}`, { method: "DELETE" });
      setMsg(t("admin.roles.revokedOk"));
      await loadRows();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setErr(translateErr(raw));
    }
  }

  const selectedUser =
    selectedId && hits.find((h) => h.id === selectedId)
      ? hits.find((h) => h.id === selectedId)!
      : rows.find((r) => r.id === selectedId);

  if (gate === "load") {
    return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;
  }
  if (gate === "deny") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {t("admin.roles.forbidden")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("admin.roles.title")}</h1>
          <p className="mt-1 max-w-2xl text-xs text-earth-500">{t("admin.roles.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app/admin/staking" className="text-sm text-earth-400 hover:underline">
            {t("dashboard.adminStaking")}
          </Link>
          <Link href="/app/dashboard" className="text-sm text-brand-400 hover:underline">
            {t("admin.roles.back")}
          </Link>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-brand-900/40 bg-brand-950/25 px-4 py-2 text-sm text-brand-100">{msg}</div>
      )}
      {err && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-earth-300">{t("admin.roles.tableTitle")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-earth-800/80">
          <table className="w-full min-w-[560px] text-left text-sm text-earth-200">
            <thead className="border-b border-earth-800 bg-earth-950/60 text-xs uppercase text-earth-500">
              <tr>
                <th className="px-3 py-2">{t("admin.roles.colEmail")}</th>
                <th className="px-3 py-2">{t("admin.roles.colUsername")}</th>
                <th className="px-3 py-2">{t("admin.roles.colRoles")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-earth-500">
                    {t("admin.roles.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-earth-900/80 hover:bg-earth-950/40">
                    <td className="px-3 py-2 text-white">{u.email}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-md bg-earth-900/80 px-2 py-0.5 text-xs text-earth-200"
                          >
                            {roleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {u.roles.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => onRevoke(u.id, r)}
                            className="rounded-lg border border-red-900/50 px-2 py-1 text-xs text-red-200 hover:bg-red-950/40"
                          >
                            {t("admin.roles.revoke")} ({roleLabel(r)})
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-earth-800/80 bg-earth-950/20 p-4">
        <h2 className="text-sm font-medium text-earth-300">{t("admin.roles.assignTitle")}</h2>
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.roles.searchPlaceholder")}
            className="min-w-[200px] flex-1 rounded-xl border border-earth-800 bg-earth-950/60 px-3 py-2 text-sm text-white placeholder:text-earth-600"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {searching ? t("common.loading") : t("admin.roles.search")}
          </button>
        </form>

        {hits.length > 0 && (
          <ul className="space-y-1 text-sm">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(h.id);
                    setMsg(null);
                    setErr(null);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    selectedId === h.id
                      ? "border-brand-600 bg-brand-950/40 text-white"
                      : "border-earth-800 text-earth-200 hover:border-earth-600"
                  }`}
                >
                  <span className="font-medium">{h.email}</span>
                  <span className="ml-2 font-mono text-xs text-earth-500">{h.username}</span>
                  {h.isBlacklisted && (
                    <span className="ml-2 text-xs text-red-400">· blacklist</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedUser && (
          <div className="flex flex-wrap items-end gap-3 border-t border-earth-800/80 pt-4">
            <p className="text-xs text-earth-500">
              {t("admin.roles.selected")}:{" "}
              <span className="text-earth-200">{selectedUser.email}</span>
            </p>
            <label className="flex flex-col gap-1 text-xs text-earth-500">
              {t("admin.roles.roleLabel")}
              <select
                value={rolePick}
                onChange={(e) => setRolePick(e.target.value as StaffRole)}
                className="rounded-lg border border-earth-800 bg-earth-950 px-2 py-1.5 text-sm text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onAssign()}
              className="rounded-xl bg-earth-800 px-4 py-2 text-sm font-medium text-earth-100 hover:bg-earth-700 disabled:opacity-50"
            >
              {submitting ? t("common.loading") : t("admin.roles.assign")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
