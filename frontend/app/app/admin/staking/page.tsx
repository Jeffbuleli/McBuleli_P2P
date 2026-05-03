"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, downloadAuthenticatedBlob } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type Me = { isAdmin?: boolean };
type AdminPool = {
  id: string;
  slug: string;
  asset: string;
  nameFr: string | null;
  nameEn: string | null;
  apyAnnual: string;
  lockDays: number;
  minAmount: string;
  maxStakePerUser: string | null;
  rewardFeePercent: string;
  cooldownSeconds: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  stakesCount: number;
};

const emptyForm = {
  slug: "",
  asset: "USDT" as "USDT" | "BTC",
  nameFr: "",
  nameEn: "",
  apyAnnual: "8",
  lockDays: "30",
  minAmount: "10",
  maxStakePerUser: "",
  rewardFeePercent: "0",
  cooldownSeconds: "0",
  sortOrder: "0",
  isActive: true,
};

export default function AdminStakingPoolsPage() {
  const { t } = useI18n();
  const [gate, setGate] = useState<"load" | "ok" | "deny">("load");
  const [pools, setPools] = useState<AdminPool[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState<null | "stakes" | "ledger">(null);

  const loadPools = useCallback(() => {
    setErr(null);
    return api<AdminPool[]>("/api/admin/staking/pools")
      .then(setPools)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    api<Me>("/api/users/me")
      .then((m) => {
        if (m.isAdmin) {
          setGate("ok");
          loadPools();
        } else setGate("deny");
      })
      .catch(() => setGate("deny"));
  }, [loadPools]);

  function fillForm(p: AdminPool) {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      asset: p.asset as "USDT" | "BTC",
      nameFr: p.nameFr ?? "",
      nameEn: p.nameEn ?? "",
      apyAnnual: p.apyAnnual,
      lockDays: String(p.lockDays),
      minAmount: p.minAmount,
      maxStakePerUser: p.maxStakePerUser ?? "",
      rewardFeePercent: p.rewardFeePercent,
      cooldownSeconds: String(p.cooldownSeconds),
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
    });
    setMsg(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setMsg(null);
    const body = {
      slug: form.slug.trim(),
      asset: form.asset,
      nameFr: form.nameFr.trim() || null,
      nameEn: form.nameEn.trim() || null,
      apyAnnual: form.apyAnnual.trim(),
      lockDays: Number(form.lockDays),
      minAmount: form.minAmount.trim(),
      maxStakePerUser: form.maxStakePerUser.trim() === "" ? null : form.maxStakePerUser.trim(),
      rewardFeePercent: form.rewardFeePercent.trim(),
      cooldownSeconds: Number(form.cooldownSeconds),
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await api("/api/admin/staking/pools/" + editingId, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMsg(t("admin.staking.saved"));
      } else {
        await api("/api/admin/staking/pools", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setMsg(t("admin.staking.created"));
        resetForm();
      }
      await loadPools();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function onExport(kind: "stakes" | "ledger") {
    setErr(null);
    setExporting(kind);
    try {
      if (kind === "stakes") {
        await downloadAuthenticatedBlob("/api/admin/staking/export/stakes.csv", "mcbuleli-stakes.csv");
      } else {
        await downloadAuthenticatedBlob("/api/admin/staking/export/ledger.csv", "mcbuleli-staking-ledger.csv");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setExporting(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t("admin.staking.confirmDelete"))) return;
    setErr(null);
    try {
      await api("/api/admin/staking/pools/" + id, { method: "DELETE" });
      setMsg(t("admin.staking.deleted"));
      if (editingId === id) resetForm();
      await loadPools();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  if (gate === "load") {
    return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;
  }
  if (gate === "deny") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {t("admin.staking.forbidden")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">{t("admin.staking.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onExport("stakes")}
            disabled={exporting !== null}
            className="rounded-lg border border-earth-700 px-3 py-1.5 text-xs font-medium text-earth-200 hover:bg-earth-900 disabled:opacity-50"
          >
            {exporting === "stakes" ? t("common.loading") : t("admin.staking.downloadStakes")}
          </button>
          <button
            type="button"
            onClick={() => onExport("ledger")}
            disabled={exporting !== null}
            className="rounded-lg border border-earth-700 px-3 py-1.5 text-xs font-medium text-earth-200 hover:bg-earth-900 disabled:opacity-50"
          >
            {exporting === "ledger" ? t("common.loading") : t("admin.staking.downloadLedger")}
          </button>
          <Link href="/app/admin/roles" className="text-sm text-earth-400 hover:underline">
            {t("dashboard.adminRoles")}
          </Link>
          <Link href="/app/dashboard" className="text-sm text-brand-400 hover:underline">
            {t("admin.staking.back")}
          </Link>
        </div>
      </div>
      <p className="text-xs text-earth-500">{t("admin.staking.csvHint")}</p>

      {msg && (
        <div className="rounded-xl border border-brand-900/40 bg-brand-950/25 px-4 py-2 text-sm text-brand-100">{msg}</div>
      )}
      {err && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      )}

      <section className="overflow-x-auto rounded-2xl border border-earth-800/80">
        <table className="w-full min-w-[720px] text-left text-sm text-earth-200">
          <thead className="border-b border-earth-800 bg-earth-950/60 text-xs uppercase text-earth-500">
            <tr>
              <th className="px-3 py-2">{t("admin.staking.colSlug")}</th>
              <th className="px-3 py-2">{t("admin.staking.colApy")}</th>
              <th className="px-3 py-2">{t("admin.staking.colLock")}</th>
              <th className="px-3 py-2">{t("admin.staking.colFee")}</th>
              <th className="px-3 py-2">{t("admin.staking.colCooldown")}</th>
              <th className="px-3 py-2">{t("admin.staking.colActive")}</th>
              <th className="px-3 py-2">{t("admin.staking.colStakes")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <tr key={p.id} className="border-b border-earth-900/80 hover:bg-earth-950/40">
                <td className="px-3 py-2 font-mono text-white">{p.slug}</td>
                <td className="px-3 py-2">{p.apyAnnual}%</td>
                <td className="px-3 py-2">{p.lockDays}d</td>
                <td className="px-3 py-2">{p.rewardFeePercent}%</td>
                <td className="px-3 py-2">{p.cooldownSeconds}s</td>
                <td className="px-3 py-2">{p.isActive ? "✓" : "—"}</td>
                <td className="px-3 py-2">{p.stakesCount}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => fillForm(p)}
                    className="text-brand-400 hover:underline"
                  >
                    {t("admin.staking.edit")}
                  </button>
                  {p.stakesCount === 0 && (
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="ml-3 text-red-400 hover:underline"
                    >
                      {t("admin.staking.delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-2xl border border-earth-800/80 p-4">
        <h2 className="text-sm font-medium text-white">
          {editingId ? t("admin.staking.formEdit") : t("admin.staking.formCreate")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldSlug")}
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              disabled={!!editingId}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldAsset")}
            <select
              value={form.asset}
              onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value as "USDT" | "BTC" }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 text-sm text-white"
            >
              <option value="USDT">USDT</option>
              <option value="BTC">BTC</option>
            </select>
          </label>
          <label className="block text-xs text-earth-400 sm:col-span-2">
            {t("admin.staking.fieldNameFr")}
            <input
              value={form.nameFr}
              onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400 sm:col-span-2">
            {t("admin.staking.fieldNameEn")}
            <input
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldApy")}
            <input
              value={form.apyAnnual}
              onChange={(e) => setForm((f) => ({ ...f, apyAnnual: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldLockDays")}
            <input
              value={form.lockDays}
              onChange={(e) => setForm((f) => ({ ...f, lockDays: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldMin")}
            <input
              value={form.minAmount}
              onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldMax")}
            <input
              value={form.maxStakePerUser}
              onChange={(e) => setForm((f) => ({ ...f, maxStakePerUser: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldRewardFee")}
            <input
              value={form.rewardFeePercent}
              onChange={(e) => setForm((f) => ({ ...f, rewardFeePercent: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldCooldown")}
            <input
              value={form.cooldownSeconds}
              onChange={(e) => setForm((f) => ({ ...f, cooldownSeconds: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-earth-400">
            {t("admin.staking.fieldSort")}
            <input
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-earth-800 bg-earth-950 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-earth-200">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            {t("admin.staking.fieldActive")}
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? t("common.loading") : editingId ? t("admin.staking.save") : t("admin.staking.create")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-earth-700 px-5 py-2 text-sm text-earth-200 hover:bg-earth-900"
            >
              {t("admin.staking.cancelEdit")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
