"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { getProviderAggregate, getProvider } from "@/lib/data";
import { formatUSD, cn } from "@/lib/utils";
import { Card, CardHeader, IntentBadge } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { ArrowLeft, MapPin, AlertTriangle, DollarSign, Activity, FolderOpen } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

export default function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agg = useMemo(() => getProviderAggregate(id), [id]);
  const provider = getProvider(id);

  if (!agg || !provider) {
    return (
      <div className="py-20 text-center text-[var(--muted)]">
        Provider not found. <Link href="/providers" className="text-[var(--accent)] underline">Back</Link>
      </div>
    );
  }

  const isVillain = agg.provider_id === "P-001";
  const intent = agg.total_impact > 0 ? (isVillain ? "fraud" : "error") : "clean";

  const kpis = [
    { label: "Flagged $ impact", value: formatUSD(agg.total_impact, true), icon: DollarSign, color: "var(--risk-high)" },
    { label: "Cases flagged", value: `${agg.flagged_case_count}/${agg.case_count}`, icon: FolderOpen, color: "var(--accent)" },
    { label: "Max confidence", value: `${Math.round(agg.max_confidence * 100)}%`, icon: Activity, color: "var(--risk-med)" },
    { label: "Fraud types", value: Object.values(agg.flags_by_type).filter((n) => n > 0).length, icon: AlertTriangle, color: "var(--risk-high)" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/providers" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Providers
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{provider.name}</h1>
            <IntentBadge intent={intent} />
          </div>
          <p className="text-sm text-[var(--muted)]">
            {provider.specialty} · NPI {provider.npi} · <MapPin className="inline h-3 w-3" /> {provider.state}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${k.color}14`, color: k.color }}>
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

      {/* Flag counts */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Findings by type</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(agg.flags_by_type).map(([type, n]) => {
            const meta = FRAUD_META[type as keyof typeof FRAUD_META];
            return (
              <div
                key={type}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  n > 0 ? "" : "opacity-40",
                )}
                style={{ borderColor: `${meta.color}33`, background: meta.soft }}
              >
                <meta.icon className="h-4 w-4" style={{ color: meta.color }} />
                <span className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>{n}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Chart 1: top CPT codes vs peer median */}
        <Card className="xl:col-span-2">
          <CardHeader title="Top CPT codes vs peer-group median" subtitle="Provider volume (colored) against the peer median (grey) — outliers tower over peers" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.top_codes} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-2)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="code"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "var(--surface-2)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="peer_median" name="Peer median" fill="var(--muted-2)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="provider_count" name="This provider" radius={[0, 4, 4, 0]}>
                  {agg.top_codes.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.provider_count > entry.peer_median * 2.5 ? "var(--risk-high)" : "var(--accent)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: E/M level distribution */}
        <Card>
          <CardHeader title="E/M level distribution" subtitle="Share of 99211–99215 visits — provider vs peers" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.em_distribution} margin={{ left: 0, right: 16, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="level" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 11, fill: "var(--muted-2)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "var(--surface-2)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="peer_share" name="Peer share" fill="var(--muted-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="provider_share" name="Provider share" radius={[4, 4, 0, 0]}>
                  {agg.em_distribution.map((e, i) => (
                    <Cell key={i} fill={e.provider_share > e.peer_share * 2 && (e.level === "99214" || e.level === "99215") ? "var(--risk-high)" : "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 3: 18-month trend */}
        <Card>
          <CardHeader title="18-month flagged $ impact trend" subtitle="Provider (red) vs peer baseline (grey) — sustained escalation" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.monthly_trend} margin={{ left: 0, right: 16, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--muted-2)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(m) => m.slice(5)}
                />
                <YAxis
                  tickFormatter={(v) => formatUSD(v, true)}
                  tick={{ fontSize: 10, fill: "var(--muted-2)" }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(v) => formatUSD(Number(v), true)}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="peer_baseline" name="Peer baseline" stroke="var(--muted-2)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="provider_impact" name="Provider impact" stroke="var(--risk-high)" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* CTA to hero case */}
      {isVillain && (
        <Card className="border-[var(--risk-high)]/20 bg-[var(--risk-high-soft)]/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--risk-high)]">Sustained pattern — 45 flagged cases</h3>
              <p className="text-xs text-[var(--muted)]">This provider's flagged $ impact is sustained across 18 months, not a one-off. Review the flagship case.</p>
            </div>
            <Link
              href="/"
              className="rounded-lg bg-[var(--risk-high)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Open flagship case →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
