"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { TOUR_CASES } from "@/lib/tour-cases";
import { Sparkles, Zap, ChevronLeft, ArrowRight, Star, PenLine } from "lucide-react";

/**
 * Live Demos hub — the index of demo cases.
 *
 * Shows ONLY case cards (no deterministic/live mode toggle). Click a case to
 * enter the phased experience (/tour/[caseId]), which follows the coding-demo
 * flow: a single-page auto-playing walkthrough of the full pipeline, with the
 * real live pipeline firing in the background on mount. A small "Live armed"
 * indicator is shown when FRAUDLENS_LIVE=1, but the live/deterministic choice is
 * made INSIDE the case, not on the hub.
 */
export default function LiveDemosHubPage() {
  const [liveArmed, setLiveArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/run-pipeline")
      .then((r) => r.json())
      .then((d) => !cancelled && setLiveArmed(Boolean(d.live)))
      .catch(() => !cancelled && setLiveArmed(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
            <span className="font-semibold text-[var(--foreground)]">Live Demos</span>
            {liveArmed && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk-low)]" /> Live armed
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Pick a fraud case to demo</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Each case is a real clinical note with the billing company&apos;s codes. Click one to watch the
            coding expert read it, extract codes, compare against the bill, and investigate the gaps — with
            the real Corti pipeline running live in the background.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          <Zap className="h-3.5 w-3.5" /> {TOUR_CASES.filter((c) => c.demo).length} demos · {TOUR_CASES.length} total
        </span>
      </div>

      {/* Try-for-yourself card + demo cases */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Try for yourself — accent-highlighted entry to /tour/try */}
        <Link href="/tour/try" className="group">
          <Card className="flex h-full flex-col overflow-hidden border-[var(--accent)]/40 bg-[var(--accent-soft)]/30 transition hover:shadow-md group-hover:border-[var(--accent)]">
            <div className="h-1 w-full bg-[var(--accent)]" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                    <PenLine className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
                      <span>Bring your own note</span>
                    </div>
                    <div className="font-mono text-xs text-[var(--muted)]">/tour/try</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                  Try
                </span>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--foreground)]">
                Paste your own clinical note and run the pipeline on it — extract codes, compare against a bill you
                add, and investigate the gaps with the legal brief. No template required.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--accent)]/20 pt-3">
                <span className="text-xs text-[var(--muted)]">Custom note · optional billed codes</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] transition group-hover:gap-1.5">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Card>
        </Link>
        {TOUR_CASES.map((tc, i) => {
          const meta = FRAUD_META[tc.fraudType];
          const Icon = meta.icon;
          return (
            <Link key={tc.caseId} href={`/tour/${tc.caseId}`} className="group">
              <Card className="flex h-full flex-col overflow-hidden transition hover:shadow-md group-hover:border-[var(--accent)]/40">
                {/* Accent strip */}
                <div className="h-1 w-full" style={{ background: meta.color }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                        style={{ background: meta.soft, color: meta.color }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                          <span>Demo {i + 1} · {meta.label}</span>
                          {tc.demo && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                              <Star className="h-2.5 w-2.5" /> Demo
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</div>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium"
                      style={{ color: meta.color, background: meta.soft, borderColor: `${meta.color}33` }}
                    >
                      {tc.billingModelLabel.split(" · ")[0]}
                    </span>
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--foreground)]">{tc.teaser}</p>

                  {/* Enter affordance */}
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-xs text-[var(--muted)]">
                      {liveArmed ? "Live pipeline armed · runs in background" : "Precomputed walkthrough available"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] transition group-hover:gap-1.5">
                      Open <ArrowRight className="h-3.5 w-3.5" />
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
