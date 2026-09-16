"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import { TOUR_CASES } from "@/lib/tour-cases";
import { LivePipelineRunner } from "@/components/live-demo/live-pipeline-runner";
import { Sparkles, ArrowRight, Zap, ChevronLeft, Lock, FileText, Play, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live Demos hub — the index of demo cases.
 *
 * Each demo is available two ways:
 *   - DETERMINISTIC: a precomputed, instant animated walkthrough of the method
 *     (predict → compare → retrace → agreeability → verdict). Same every run,
 *     works offline. The /tour/[caseId] experience.
 *   - LIVE: run the REAL Corti pipeline on the case's note + billed codes right
 *     now — real agents, real reasoning, ~10-30s. The LivePipelineRunner.
 *
 * Every case is live-capable (they all have real notes + billed codes). The
 * badges distinguish the two ways to experience each demo.
 */
export default function LiveDemosHubPage() {
  const [liveCaseId, setLiveCaseId] = useState<string | null>(null);

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
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Pick a fraud case to demo</h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Each case is a real clinical note with the billing company&apos;s codes. Watch the method as a
            deterministic walkthrough, or run the full Corti pipeline live — real agents predicting codes,
            retracing the unmatched ones, and judging fraud vs error.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
          <Zap className="h-3.5 w-3.5" /> {TOUR_CASES.length} demos
        </span>
      </div>

      {/* Badge legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
            <FileText className="h-2.5 w-2.5" /> Deterministic
          </span>
          Precomputed walkthrough — instant, works offline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
            <Zap className="h-2.5 w-2.5" /> Live
          </span>
          Real Corti agents — ~10-30s, needs credits
        </span>
      </div>

      {/* Demo cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TOUR_CASES.map((tc, i) => {
          const meta = FRAUD_META[tc.fraudType];
          const Icon = meta.icon;
          const isLiveOpen = liveCaseId === tc.caseId;
          return (
            <Card
              key={tc.caseId}
              className={cn(
                "flex h-full flex-col overflow-hidden transition hover:shadow-md",
                isLiveOpen ? "border-[var(--accent)]/50 ring-1 ring-[var(--accent)]/30" : "hover:border-[var(--accent)]/40",
              )}
            >
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
                      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                        Demo {i + 1} · {meta.label}
                      </div>
                      <div className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium" style={{ color: meta.color, background: meta.soft, borderColor: `${meta.color}33` }}>
                      {tc.billingModelLabel.split(" · ")[0]}
                    </span>
                  </div>
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--foreground)]">{tc.teaser}</p>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
                  {/* Deterministic walkthrough */}
                  <Link
                    href={`/tour/${tc.caseId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)]"
                  >
                    <FileText className="h-3.5 w-3.5" /> Deterministic
                  </Link>
                  {/* Live run */}
                  <button
                    onClick={() => setLiveCaseId(isLiveOpen ? null : tc.caseId)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--risk-low-soft)] border border-[var(--risk-low)]/30 px-3 py-2 text-xs font-semibold text-[var(--risk-low)] transition hover:bg-[var(--risk-low-soft)]/70"
                  >
                    {isLiveOpen ? <Lock className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                    {isLiveOpen ? "Hide live" : "Run live"}
                  </button>
                </div>

                {/* Live runner panel */}
                {isLiveOpen && (
                  <div className="mt-3 animate-fade-rise">
                    <LivePipelineRunner caseId={tc.caseId} />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-[var(--muted-2)]">
        <Play className="mr-1 inline h-3 w-3" />
        The deterministic walkthrough is the curated presentation flow; the live run hits the real Corti agents on
        staging-eu. Both show the same method — prediction, set-intersection comparison, per-code retrace, and
        judgement.
      </p>
    </div>
  );
}
