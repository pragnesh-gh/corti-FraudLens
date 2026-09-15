"use client";

import Link from "next/link";
import { getAllProviderAggregates } from "@/lib/data";
import { formatUSD, cn } from "@/lib/utils";
import { Card, IntentBadge } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { ChevronRight, MapPin } from "lucide-react";

export default function ProvidersPage() {
  const aggs = getAllProviderAggregates().sort((a, b) => b.total_impact - a.total_impact);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Provider Pattern Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Cross-case anomalies vs peer-group normal distribution — is this a pattern, not a one-off?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {aggs.map((a) => {
          const isVillain = a.provider_id === "P-001";
          return (
            <Link key={a.provider_id} href={`/providers/${a.provider_id}`}>
              <Card
                className={cn(
                  "cursor-pointer p-4 transition hover:shadow-md",
                  isVillain && "ring-1 ring-[var(--risk-high)]/30",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{a.provider.name}</h3>
                      {isVillain && <IntentBadge intent="fraud" />}
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {a.provider.specialty} · <MapPin className="inline h-3 w-3" /> {a.provider.state} · {a.case_count} cases
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--muted-2)]" />
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-[var(--risk-high)]">{formatUSD(a.total_impact, true)}</span>
                  <span className="text-xs text-[var(--muted)]">flagged impact</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
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
                    <span className="text-xs text-[var(--muted-2)]">No flags · clean control</span>
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
