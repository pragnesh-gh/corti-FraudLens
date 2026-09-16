"use client";

import Link from "next/link";
import { getAllProviderAggregates } from "@/lib/data";
import { formatUSD, cn } from "@/lib/utils";
import { Card, IntentBadge } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { ChevronRight, MapPin, TrendingUp } from "lucide-react";

export default function ProvidersPage() {
  const aggs = getAllProviderAggregates().sort((a, b) => b.total_impact - a.total_impact);
  const villain = aggs.find((a) => a.provider_id === "P-001");
  const rest = aggs.filter((a) => a.provider_id !== "P-001");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Provider Pattern Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Cross-case anomalies vs peer-group normal distribution — is this a pattern, not a one-off?
        </p>
      </div>

      {/* Bento grid: the flagged villain anchors as a large featured tile, the
          rest fill a varied masonry sized by impact. Collapses to 1→2→3 cols. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6 lg:gap-4">
        {/* Featured villain tile — spans 2 cols / 2 rows on desktop */}
        {villain && (
          <Link href={`/providers/${villain.provider_id}`} className="col-span-1 md:col-span-2 md:row-span-2">
            <Card
              glow
              className={cn(
                "flex h-full cursor-pointer flex-col justify-between gap-4 overflow-hidden p-5 transition hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{villain.provider.name}</h3>
                    <IntentBadge intent="fraud" />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {villain.provider.specialty} · <MapPin className="inline h-3 w-3" /> {villain.provider.state} · {villain.case_count} cases
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--muted-2)]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--risk-high)]">
                  <TrendingUp className="h-3.5 w-3.5" /> Top flagged provider
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-[var(--risk-high)]">
                    {formatUSD(villain.total_impact, true)}
                  </span>
                  <span className="text-xs text-[var(--muted)]">flagged impact</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {Object.entries(villain.flags_by_type)
                  .filter(([, n]) => n > 0)
                  .map(([type, n]) => (
                    <span
                      key={type}
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        color: FRAUD_META[type as keyof typeof FRAUD_META].color,
                        background: FRAUD_META[type as keyof typeof FRAUD_META].soft,
                      }}
                    >
                      {FRAUD_META[type as keyof typeof FRAUD_META].label} · {n}
                    </span>
                  ))}
              </div>
            </Card>
          </Link>
        )}

        {/* Remaining providers — first flagged gets a wider tile, controls get small tiles */}
        {rest.map((a, i) => {
          const isFlagged = a.flagged_case_count > 0;
          // Wider tile for the next-most-flagged provider; clean controls stay compact.
          const span = isFlagged && i === 0 ? "md:col-span-2" : "md:col-span-1";
          return (
            <Link key={a.provider_id} href={`/providers/${a.provider_id}`} className={span}>
              <Card
                className={cn(
                  "flex h-full cursor-pointer flex-col gap-3 p-4 transition hover:shadow-md",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{a.provider.name}</h3>
                    <p className="text-xs text-[var(--muted)]">
                      {a.provider.specialty} · <MapPin className="inline h-3 w-3" /> {a.provider.state} · {a.case_count} cases
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--muted-2)]" />
                </div>

                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      isFlagged ? "text-[var(--risk-high)]" : "text-[var(--muted)]",
                    )}
                  >
                    {formatUSD(a.total_impact, true)}
                  </span>
                  <span className="text-xs text-[var(--muted)]">flagged impact</span>
                </div>

                <div className="mt-auto flex flex-wrap gap-1">
                  {Object.entries(a.flags_by_type)
                    .filter(([, n]) => n > 0)
                    .map(([type, n]) => (
                      <span
                        key={type}
                        className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          color: FRAUD_META[type as keyof typeof FRAUD_META].color,
                          background: FRAUD_META[type as keyof typeof FRAUD_META].soft,
                        }}
                      >
                        {FRAUD_META[type as keyof typeof FRAUD_META].label} · {n}
                      </span>
                    ))}
                  {a.flagged_case_count === 0 && (
                    <span className="text-xs text-[var(--risk-low)]">No flags · clean control</span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
