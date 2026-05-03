"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type Me = { isAdmin?: boolean; staffRoles?: string[] };

type DisputeRow = {
  id: string;
  tradeId: string;
  reason: string;
  createdAt: string;
  openedBy: { email: string; username: string };
  trade: {
    id: string;
    referenceId: string;
    status: string;
    cryptoAmount: string;
    fiatAmount: string;
    buyer: { email: string; username: string };
    seller: { email: string; username: string };
  };
};

type FlagRow = { id: string; reason: string; severity: number; createdAt: string; userId: string };
type TxRow = {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  user: { email: string; username: string };
};

function canAgentDashboard(me: Me | null): boolean {
  if (!me) return false;
  if (me.isAdmin) return true;
  return Boolean(me.staffRoles?.includes("AGENT"));
}

export default function AgentOpsPage() {
  const { t } = useI18n();
  const [gate, setGate] = useState<"load" | "ok" | "deny">("load");
  const [me, setMe] = useState<Me | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    return Promise.all([
      api<DisputeRow[]>("/api/admin/disputes"),
      api<FlagRow[]>("/api/admin/flags"),
      api<TxRow[]>("/api/admin/transactions"),
    ])
      .then(([d, f, x]) => {
        setDisputes(d);
        setFlags(f);
        setTxs(x);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    api<Me>("/api/users/me")
      .then((m) => {
        setMe(m);
        if (canAgentDashboard(m)) {
          setGate("ok");
          load();
        } else setGate("deny");
      })
      .catch(() => setGate("deny"));
  }, [load]);

  async function resolveDispute(tradeId: string, resolution: "RESOLVED_BUYER" | "RESOLVED_SELLER") {
    setBusyId(tradeId + resolution);
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/admin/disputes/${tradeId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      });
      setMsg(t("agent.ops.disputeResolved"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  if (gate === "load") {
    return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;
  }
  if (gate === "deny") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {t("agent.ops.forbidden")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{t("agent.ops.title")}</h1>
          <p className="mt-1 max-w-2xl text-xs text-earth-500">{t("agent.ops.subtitle")}</p>
        </div>
        <Link href="/app/dashboard" className="text-sm text-brand-400 hover:underline">
          {t("agent.ops.back")}
        </Link>
      </div>

      {msg && (
        <div className="rounded-xl border border-brand-900/40 bg-brand-950/25 px-4 py-2 text-sm text-brand-100">{msg}</div>
      )}
      {err && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-earth-300">{t("agent.ops.disputesTitle")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-earth-800/80">
          <table className="w-full min-w-[720px] text-left text-sm text-earth-200">
            <thead className="border-b border-earth-800 bg-earth-950/60 text-xs uppercase text-earth-500">
              <tr>
                <th className="px-3 py-2">{t("agent.ops.colRef")}</th>
                <th className="px-3 py-2">{t("agent.ops.colParties")}</th>
                <th className="px-3 py-2">{t("agent.ops.colReason")}</th>
                <th className="px-3 py-2">{t("agent.ops.colOpenedBy")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-earth-500">
                    {t("agent.ops.noDisputes")}
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="border-b border-earth-900/80 hover:bg-earth-950/40">
                    <td className="px-3 py-2 font-mono text-xs text-white">{d.trade.referenceId}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="text-earth-400">{t("agent.ops.buyer")}:</span> {d.trade.buyer.username}
                      <br />
                      <span className="text-earth-400">{t("agent.ops.seller")}:</span> {d.trade.seller.username}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-xs text-earth-300">{d.reason}</td>
                    <td className="px-3 py-2 text-xs">{d.openedBy.username}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void resolveDispute(d.trade.id, "RESOLVED_BUYER")}
                          className="rounded-lg border border-brand-800/60 px-2 py-1 text-xs text-brand-200 hover:bg-brand-950/50 disabled:opacity-50"
                        >
                          {busyId === d.trade.id + "RESOLVED_BUYER" ? "…" : t("agent.ops.resolveBuyer")}
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void resolveDispute(d.trade.id, "RESOLVED_SELLER")}
                          className="rounded-lg border border-earth-700 px-2 py-1 text-xs text-earth-200 hover:bg-earth-950/50 disabled:opacity-50"
                        >
                          {busyId === d.trade.id + "RESOLVED_SELLER" ? "…" : t("agent.ops.resolveSeller")}
                        </button>
                        <Link
                          href={`/app/p2p/trade/${d.trade.id}`}
                          className="rounded-lg border border-earth-700 px-2 py-1 text-xs text-earth-300 hover:bg-earth-950/40"
                        >
                          {t("agent.ops.openTrade")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-earth-300">{t("agent.ops.flagsTitle")}</h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-earth-800/80 p-3 text-xs text-earth-300">
            {flags.length === 0 ? (
              <li className="text-earth-500">{t("agent.ops.emptyFlags")}</li>
            ) : (
              flags.slice(0, 40).map((f) => (
                <li key={f.id} className="border-b border-earth-900/50 pb-2 last:border-0">
                  <span className="text-earth-500">
                    {t("agent.ops.severity", { n: String(f.severity) })}
                  </span>{" "}
                  · {f.reason}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-earth-300">{t("agent.ops.txTitle")}</h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-earth-800/80 p-3 text-xs text-earth-300">
            {txs.slice(0, 25).map((x) => (
              <li key={x.id} className="flex justify-between gap-2 border-b border-earth-900/40 pb-1 last:border-0">
                <span>
                  {x.type} · {x.user.username}
                </span>
                <span className="font-mono text-earth-400">
                  {x.amount} {x.currency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {me?.isAdmin && (
        <p className="text-xs text-earth-600">
          {t("agent.ops.adminHint")}
        </p>
      )}
    </div>
  );
}
