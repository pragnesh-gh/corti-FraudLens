import Link from "next/link";
import { Card } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { TOUR_CASES } from "@/lib/tour-cases";
import { Sparkles, ArrowRight, GraduationCap, ChevronLeft } from "lucide-react";

/**
 * Tour hub — the index of available guided tours.
 *
 * Each card links to /tour/[caseId], where the dynamic route runs the TourEngine
 * for that case. The diagnosis-padding tour is listed first (the default).
 */
export default function TourHubPage() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ChevronLeft className="h-3.5 w-3.5" /> Case Queue
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-[var(--foreground)]">Guided Tours</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Pick a fraud type to tour</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Each tour is a deterministic, animated walkthrough of one curated fraud case — the
            clinical note, the billed codes, the truth, and how the wrong code becomes money. Same
            timing, same evidence, every run.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          <GraduationCap className="h-3.5 w-3.5" /> {TOUR_CASES.length} tours
        </span>
      </div>

      {/* Tour cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TOUR_CASES.map((tc, i) => {
          const meta = FRAUD_META[tc.fraudType];
          const Icon = meta.icon;
          return (
            <Link key={tc.caseId} href={`/tour/${tc.caseId}`} className="group block">
              <Card className="flex h-full flex-col overflow-hidden transition hover:border-[var(--accent)]/40 hover:shadow-md">
                {/* Accent strip */}
                <div className="h-1 w-full" style={{ background: meta.color }} />

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                        style={{ background: meta.soft, color: meta.color }}
                      >
                        <Icon className="h-5.5 w-5.5" strokeWidth={2.5} />
                      </span>
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                          Tour {i + 1} · {meta.label}
                        </div>
                        <div className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</div>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                      style={{ color: meta.color, background: meta.soft, borderColor: `${meta.color}33` }}
                    >
                      {tc.billingModelLabel.split(" · ")[0]}
                    </span>
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--foreground)]">
                    {tc.teaser}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-xs text-[var(--muted)]">
                      {tc.steps.length} steps · intro → verdict
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] transition group-hover:gap-1.5">
                      Start tour <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
