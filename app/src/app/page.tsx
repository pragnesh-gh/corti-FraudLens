"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getWorklist, getProviders } from "@/lib/data";
import { formatUSD, formatDate, cn } from "@/lib/utils";
import { RiskBadge, FraudChip, IntentBadge, Card } from "@/components/ui";
import { ALL_FRAUD_TYPES } from "@/lib/fraud-meta";
import type { FraudType, Role } from "@/lib/types";
import { ArrowUpDown, Search, ChevronRight, AlertTriangle, DollarSign, FolderOpen, Activity } from "lucide-react";
import { getFraming } from "@/components/app-shell";

type SortKey = "risk" | "impact" | "date";

export default function CaseQueuePage() {
  const worklist = useMemo(() => getWorklist(), []);
  const providers = useMemo(() => getProviders(), []);

  const [role, setRole] = useState<Role>("investigator");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FraudType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");

  const framing = getFraming(role);

  // KPIs
  const totalFlagged = worklist.filter((w) => w.risk_score > 0).reduce((s, w) => s + w.est_impact, 0);
  const openCases = worklist.filter((w) => w.status === "new").length;
  const flaggedProviders = new Set(worklist.filter((w) => w.risk_score > 0).map((w) => w.provider_id)).size;
  const avgRisk = worklist.filter((w) => w.risk_score > 0).length
    ? Math.round(
        worklist.filter((w) => w.risk_score > 0).reduce((s, w) => s + w.risk_score, 0) /
          worklist.filter((w) => w.risk_score > 0).length,
      )
    : 0;

  const rows = useMemo(() => {
    let r = worklist;
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(
        (w) =>
          w.case_id.toLowerCase().includes(q) ||
          w.provider_name.toLowerCase().includes(q) ||
          w.specialty.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") {
      r = r.filter((w) => w.fraud_types.includes(typeFilter));
    }
    r = [...r].sort((a, b) => {
      if (sortKey === "risk") return b.risk_score - a.risk_score;
      if (sortKey === "impact") return b.est_impact - a.est_impact;
      return b.encounter_date.localeCompare(a.encounter_date);
    });
    return r;
  }, [worklist, query, typeFilter, sortKey]);

  const kpis = [
    { label: "Total flagged $", value: formatUSD(totalFlagged, true), icon: DollarSign, color: "var(--risk-high)" },
    { label: "Open cases", value: openCases, icon: FolderOpen, color: "var(--accent)" },
    { label: "Flagged providers", value: flaggedProviders, icon: AlertTriangle, color: "var(--risk-med)" },
    { label: "Avg. risk score", value: avgRisk, icon: Activity, color: "var(--foreground)" },
  ];

  return (
    <div className="space-y-5">
      {/* Role-aware framing */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{framing.cta}</h1>
          <p className="text-sm text-[var(--muted)]">{framing.tagline}</p>
        </div>
        {/* Inline role switch for demo narration */}
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
          {(["investigator", "provider", "relator"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium capitalize transition",
                role === r ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="flex items-center gap-3 px-4 py-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${k.color}14`, color: k.color }}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">{k.label}</div>
                <div className="text-lg font-bold tabular-nums">{k.value}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Worklist */}
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-2)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID, provider, or specialty…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-8 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface)]"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                typeFilter === "all" ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)]",
              )}
            >
              All
            </button>
            {ALL_FRAUD_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  typeFilter === t ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-2)]",
                )}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortKey((k) => (k === "risk" ? "impact" : k === "impact" ? "date" : "risk"))}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort: {sortKey}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-2)]">
                <th className="px-4 py-2.5 font-medium">Case</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">DOS</th>
                <th className="px-4 py-2.5 font-medium">Flags</th>
                <th className="px-4 py-2.5 font-medium">Intent</th>
                <th className="px-4 py-2.5 text-right font-medium">Risk</th>
                <th className="px-4 py-2.5 text-right font-medium">Est. $ impact</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr
                  key={w.case_id}
                  className="group border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--accent-soft)]/40"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{w.case_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--foreground)]">{w.provider_name}</div>
                    <div className="text-xs text-[var(--muted)]">{w.specialty} · {w.state}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(w.encounter_date)}</td>
                  <td className="px-4 py-3">
                    {w.fraud_types.length === 0 ? (
                      <span className="text-xs text-[var(--muted-2)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {w.fraud_types.map((t) => (
                          <FraudChip key={t} type={t} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <IntentBadge intent={w.intent} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {w.risk_score > 0 ? <RiskBadge score={w.risk_score} /> : <span className="text-xs text-[var(--muted-2)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {w.est_impact > 0 ? formatUSD(w.est_impact, true) : <span className="font-normal text-[var(--muted-2)]">—</span>}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Link
                      href={`/case/${w.case_id}`}
                      className="inline-flex items-center text-[var(--muted-2)] transition group-hover:text-[var(--accent)]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 text-xs text-[var(--muted-2)]">
          {rows.length} of {worklist.length} cases · {providers.length} providers
        </div>
      </Card>
    </div>
  );
}
