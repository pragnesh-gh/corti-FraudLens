"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getWorklist, getProviders } from "@/lib/data";
import { formatUSD, formatDate, cn } from "@/lib/utils";
import { RiskBadge, FraudChip, IntentBadge, Card } from "@/components/ui";
import { ALL_FRAUD_TYPES, FRAUD_META } from "@/lib/fraud-meta";
import type { FraudType, Role } from "@/lib/types";
import { ArrowUpDown, Search, ChevronRight, AlertTriangle, FolderOpen, Activity, ShieldAlert } from "lucide-react";
import { getFraming } from "@/components/app-shell";

type SortKey = "risk" | "impact" | "date";

export default function CaseQueuePage() {
  const worklist = useMemo(() => getWorklist(), []);
  const providers = useMemo(() => getProviders(), []);

  const [role, setRole] = useState<Role>("investigator");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FraudType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  // Hovered fraud type for the hero distribution-bar legend (null = none).
  const [hoveredType, setHoveredType] = useState<FraudType | null>(null);

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

  // Fraud-type distribution segments for the hero bar (skips zero-count types).
  // Each carries its count + width % so the bar and the legend stay in sync.
  const distSegments = useMemo(() => {
    const total = worklist.length || 1;
    return ALL_FRAUD_TYPES.map((t) => {
      const n = worklist.filter((w) => w.fraud_types.includes(t)).length;
      return { type: t, n, pct: (n / total) * 100 };
    }).filter((s) => s.n > 0);
  }, [worklist]);

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

      {/* Bento grid — KPI overview.
          Hero: total flagged $ (large, coral gradient). Medium tiles: open cases,
          flagged providers, avg risk. Collapses to 1→2→4 columns responsively. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-12 lg:gap-4">
        {/* Hero — total flagged impact */}
        <Card
          glow
          className="relative col-span-2 flex flex-col justify-between gap-3 overflow-hidden p-5 md:col-span-5 md:row-span-2"
        >
          {/* Tasteful radiant wash — one contained ambient orb, behind content,
              pointer-events-none. Echoes the Stitch "radiant gradient" cue
              without site-wide glow. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 right-0 h-48 w-48 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,122,80,0.22), transparent 70%)" }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                <ShieldAlert className="h-3.5 w-3.5 text-[var(--risk-high)]" />
                Total flagged impact
              </div>
              <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight text-[var(--foreground)]">
                {formatUSD(totalFlagged, true)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Projected across {openCases} open cases</p>
            </div>
          </div>
          {/* Mini bar of fraud-type distribution — hover a segment to see its tag
              and count (bidirectional with the legend below). The bar stays h-2
              visually but sits in a taller hover zone so small segments are easy
              to target. Both bar + legend use FRAUD_META colors → adapt to theme. */}
          <div className="relative">
            <div className="flex items-center py-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                {distSegments.map((s) => {
                  const meta = FRAUD_META[s.type];
                  const active = hoveredType === s.type;
                  return (
                    <span
                      key={s.type}
                      onMouseEnter={() => setHoveredType(s.type)}
                      onMouseLeave={() => setHoveredType(null)}
                      className={cn(
                        "h-full cursor-pointer transition-[filter,opacity] duration-150",
                        hoveredType && !active && "opacity-50",
                      )}
                      style={{
                        background: meta.color,
                        width: `${s.pct}%`,
                        filter: active ? "brightness(1.15)" : undefined,
                        boxShadow: active ? `0 0 0 1px ${meta.color}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Legend — compact, in-flow (no overflow clip from the card).
                The hovered type (bar OR legend) is highlighted; others dim. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {distSegments.map((s) => {
                const meta = FRAUD_META[s.type];
                const Icon = meta.icon;
                const active = hoveredType === s.type;
                return (
                  <span
                    key={s.type}
                    onMouseEnter={() => setHoveredType(s.type)}
                    onMouseLeave={() => setHoveredType(null)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-150 cursor-default",
                      active
                        ? "bg-[var(--surface)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                    style={active ? { borderColor: `${meta.color}66` } : undefined}
                  >
                    <Icon
                      className="h-2.5 w-2.5 flex-none"
                      strokeWidth={2.5}
                      style={{ color: meta.color }}
                    />
                    <span className="whitespace-nowrap">{meta.label}</span>
                    <span className="tabular-nums text-[var(--muted-2)]">{s.n}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Medium tiles */}
        <Card className="col-span-1 flex items-center gap-3 px-4 py-3 md:col-span-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <FolderOpen className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">Open cases</div>
            <div className="text-2xl font-bold tabular-nums">{openCases}</div>
          </div>
        </Card>

        <Card className="col-span-1 flex items-center gap-3 px-4 py-3 md:col-span-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--risk-med-soft)", color: "var(--risk-med)" }}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">Flagged providers</div>
            <div className="text-2xl font-bold tabular-nums">{flaggedProviders}</div>
          </div>
        </Card>

        <Card className="col-span-2 flex items-center gap-3 px-4 py-3 md:col-span-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--surface-2)", color: "var(--foreground)" }}
          >
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">Avg. risk score</div>
            <div className="text-2xl font-bold tabular-nums">{avgRisk}</div>
          </div>
        </Card>
      </div>

      {/* Worklist — full-width bento tile */}
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
                <th className="px-4 py-2.5 text-center font-medium">Flags</th>
                <th className="px-4 py-2.5 text-center font-medium">Intent</th>
                <th className="px-4 py-2.5 text-center font-medium">Risk</th>
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
                      <div className="flex flex-wrap justify-center gap-1">
                        {w.fraud_types.map((t) => (
                          <FraudChip key={t} type={t} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <IntentBadge intent={w.intent} />
                  </td>
                  <td className="px-4 py-3 text-center">
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
