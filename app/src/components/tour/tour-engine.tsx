"use client";

/**
 * Live Demos experience — click-driven, coding-demo-style.
 *
 * Replaces the old auto-advancing 7-step TourEngine. The user is in full
 * control: they land on a "Try it yourself" start screen, click to RUN the
 * coding-expert agent, then click through three tabs — Run → Compare →
 * Investigate — to walk the full pipeline (predict → compare → retrace →
 * judgement → legal brief). Nothing runs in the background; nothing
 * auto-advances between tabs.
 *
 * The history-dependent case (case_history_012) surfaces the "Pull patient
 * history" mind-change inside the Investigate tab (Common → Billed-only),
 * revealed on click.
 *
 * The step renderer components below (RetraceStep, HistoryRetraceStep,
 * VerdictStep, …) are the reusable rendering pieces; the top-level
 * LiveDemoExperience orchestrates them via the tab state machine.
 *
 * Pure React/CSS/SVG — no animation libs, no new dependencies.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  FileText,
  TrendingUp,
  ScanSearch,
  Gavel,
  Sparkles,
  FlaskConical,
  Receipt,
  BrainCircuit,
  Microscope,
  ScanLine,
  Scale,
  ShieldCheck,
  History,
  ArrowLeft,
  Zap,
  Loader2,
} from "lucide-react";
import type { TourCase } from "./tour-types";
import { CodeCard, SeverityMeter, DeltaChip, ConfidenceGauge } from "./tour-widgets";
import { getCaseResult } from "@/lib/data";
import { buildLegalBrief, findingFromResult } from "@/lib/legal-brief";
import { LegalBriefView } from "@/components/legal-brief-view";
import type { CaseResult, CodeAnalysis } from "@/lib/types";

// ---------------------------------------------------------------------------
// LiveDemoExperience — the 3-tab, click-driven orchestrator.
// Run → Compare → Investigate. No background runs, no auto-advance.
// ---------------------------------------------------------------------------

/** Load the detector's real pipeline output for this tour case (precomputed
 *  preferred, falls back to replay). Returns null if unavailable. */
function useDetectorResult(caseId: string): CaseResult | null {
  return useMemo(() => getCaseResult(caseId) ?? null, [caseId]);
}

/** Bucket the per-code analyses into the set-intersection comparison. */
function bucketAnalyses(analyses: CodeAnalysis[]) {
  const matched = analyses.filter((a) => a.match === "exact");
  const overBilled = analyses.filter((a) => a.match === "extra" || a.match === "mismatch");
  const underBilled = analyses.filter((a) => a.match === "missing");
  return { matched, overBilled, underBilled };
}

type Tab = "run" | "compare" | "investigate";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "run", label: "Run", icon: Sparkles },
  { id: "compare", label: "Compare", icon: ScanSearch },
  { id: "investigate", label: "Investigate", icon: Gavel },
];

export function LiveDemoExperience({ tc }: { tc: TourCase }) {
  const [tab, setTab] = useState<Tab>("run");
  // Whether the user has kicked off the coding-expert run in the Run tab. The
  // run itself is owned by RunTab (click-driven); this just gates the "Compare"
  // advance until a run has happened.
  const [hasRun, setHasRun] = useState(false);

  // Investigate tab: click-to-reveal sub-steps (not auto-timed).
  // 0 = retrace/history, 1 = verdict, 2 = legal brief.
  const [invStage, setInvStage] = useState(0);

  const goCompare = useCallback(() => setTab("compare"), []);
  const goInvestigate = useCallback(() => setTab("investigate"), []);
  const restart = useCallback(() => {
    setTab("run");
    setHasRun(false);
    setInvStage(0);
  }, []);

  return (
    <div className="space-y-4">
      {/* Back link */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ChevronLeft className="h-3.5 w-3.5" /> Live Demos
        </Link>
      </div>

      <LiveDemoHeader tc={tc} tab={tab} />

      {/* Tab indicator — click any tab to jump (no auto-advance). */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const done =
                (t.id === "run" && (tab === "compare" || tab === "investigate")) ||
                (t.id === "compare" && tab === "investigate");
              return (
                <div key={t.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : done
                          ? "text-[var(--risk-low)]"
                          : "text-[var(--muted-2)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md",
                        active
                          ? "bg-[var(--accent)] text-white"
                          : done
                            ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                            : "bg-[var(--surface-2)] text-[var(--muted-2)]",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    </span>
                    {i + 1}. {t.label}
                  </button>
                  {i < TABS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-[var(--border-strong)]" />}
                </div>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={restart}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </button>
          </div>
        </div>
      </Card>

      {/* Per-tab layout.
          Run tab = two-column workstation (note pinned left, run work right),
          matching the coding demo. Compare and Investigate are full-width,
          single-column — the clinical note does NOT persist across tabs. */}
      {tab === "run" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <NotePanel tc={tc} />
          <div key="run" className="tour-step-in">
            <RunTab tc={tc} onRan={() => setHasRun(true)} hasRun={hasRun} onCompare={goCompare} />
          </div>
        </div>
      )}
      {tab === "compare" && (
        <div key="compare" className="tour-step-in">
          <CompareTab tc={tc} onInvestigate={goInvestigate} />
        </div>
      )}
      {tab === "investigate" && (
        <div key="investigate" className="tour-step-in">
          <InvestigateTab tc={tc} stage={invStage} setStage={setInvStage} onRestart={restart} />
        </div>
      )}

      {/* Footer exit */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <ScanSearch className="h-4 w-4 text-[var(--muted-2)]" />
            You&apos;re in control — click to run, click to advance. Nothing runs until you do.
          </div>
          <Link
            href="/tour"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to demos
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function LiveDemoHeader({ tc, tab }: { tc: TourCase; tab: Tab }) {
  const Icon = tc.billingModel === "risk_adjustment" ? BrainCircuit : Receipt;
  const subtitle =
    tab === "run"
      ? "Run the coding-expert agent on this case — click to start."
      : tab === "compare"
        ? "What our expert predicted vs what the provider billed."
        : "The agentic framework investigates the gaps — retrace, judgement, legal brief.";
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-[var(--foreground)]">Live Demo</span>
          <span className="font-mono text-xs">· {tc.caseId}</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{tc.teaser}</h1>
        <p className="text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <FraudChip type={tc.fraudType} />
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
          <Icon className="h-3 w-3" /> {tc.billingModelLabel}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotePanel — the pinned LEFT column. The clinical note (read-only reference),
// kept in view across the Run/Compare/Investigate tabs so the work on the
// right always has the note alongside. Mirrors the coding-demo's note card.
// ---------------------------------------------------------------------------

function NotePanel({ tc }: { tc: TourCase }) {
  return (
    <Card className="overflow-hidden xl:sticky xl:top-20 xl:self-start">
      <CardHeader
        title="Clinical note"
        subtitle="The encounter documentation — read it as you work."
        right={
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            <FileText className="h-3 w-3" /> verbatim
          </span>
        }
      />
      <div className="max-h-[460px] overflow-y-auto px-5 py-4 text-sm">
        <p className="whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">{tc.noteText}</p>
      </div>
      {/* What was billed — a compact reference so the note + the bill are both
          in view alongside the work on the right. */}
      <div className="border-t border-[var(--border)] px-5 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
          <Receipt className="h-3.5 w-3.5" /> Billed codes
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tc.billedCodes.map((c) => (
            <span
              key={c.code}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold",
                c.fraudulent
                  ? "border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)] text-[var(--risk-high)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
              )}
              title={c.description}
            >
              {c.code}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Run: a single "Run the coding-expert" button. Click it → the agent
// predicts codes → they appear below → a "Compare with the bill" advance
// appears. No template picker, no editable note, no Try-it-yourself chrome —
// the run uses this case's note (read-only on the left NotePanel). Nothing
// fires on mount except the armed-probe GET; the POST is click-driven.
// ---------------------------------------------------------------------------

interface RunResult {
  source: "live" | "replay";
  region?: string;
  predictedCodes: { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] };
  error?: string;
}

function RunTab({
  tc,
  onRan,
  hasRun,
  onCompare,
}: {
  tc: TourCase;
  onRan: () => void;
  hasRun: boolean;
  onCompare: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [liveArmed, setLiveArmed] = useState(false);

  // Probe armed state once on mount (read-only GET — does NOT run the agent).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/coding-expert")
      .then((r) => r.json())
      .then((d) => !cancelled && setLiveArmed(Boolean(d.live)))
      .catch(() => !cancelled && setLiveArmed(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Reveal the "Compare" advance as soon as a prediction is available.
  useEffect(() => {
    if (result) onRan();
  }, [result, onRan]);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/coding-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: tc.noteText }),
      });
      const data = (await res.json()) as RunResult;
      setResult(data);
    } catch {
      setResult({ source: "replay", predictedCodes: { dx: [], procedures: [] }, error: "Request failed." });
    } finally {
      setRunning(false);
    }
  }

  const predicted = [...(result?.predictedCodes.dx ?? []), ...(result?.predictedCodes.procedures ?? [])];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Run the coding-expert"
          subtitle="Click to run the coding-expert agent on this case's note."
          right={
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                liveArmed
                  ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", liveArmed ? "bg-[var(--risk-low)]" : "bg-[var(--muted-2)]")} />
              {liveArmed ? "Live armed" : "Replay mode"}
            </span>
          }
        />
        <div className="space-y-4 p-5">
          <button
            onClick={run}
            disabled={running}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Agent running…" : "Run the coding-expert"}
          </button>

          {/* Prediction */}
          {result && (
            <div className="animate-fade-rise space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Zap className="h-4 w-4 text-[var(--accent)]" />
                  Agent prediction
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    result.source === "live"
                      ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                      : "bg-[var(--surface)] text-[var(--muted)]",
                  )}
                >
                  {result.source === "live" ? `Live · ${result.region ?? "?"}` : "Replay"}
                </span>
              </div>
              {result.error && <p className="text-xs text-[var(--risk-med)]">{result.error}</p>}
              {predicted.length === 0 && !result.error ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted-2)]">
                  No codes returned.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {predicted.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-[var(--risk-low)]/20 bg-[var(--risk-low-soft)]/40 px-2.5 py-1.5"
                    >
                      <span className="font-mono text-xs font-semibold text-[var(--foreground)]">{c.code}</span>
                      <span className="text-xs text-[var(--muted)]">{c.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Advance to Compare once the user has run it. */}
      {hasRun && (
        <Card className="animate-fade-rise px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--foreground)]">
              The coding-expert has predicted its codes. Now compare them against what the provider
              actually billed.
            </p>
            <button
              onClick={onCompare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <ScanSearch className="h-3.5 w-3.5" /> Compare with the bill
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Compare: the set-intersection (Common / Expert-only / Billed-only).
// ---------------------------------------------------------------------------

function CompareTab({
  tc,
  onInvestigate,
}: {
  tc: TourCase;
  onInvestigate: () => void;
}) {
  const result = useDetectorResult(tc.caseId);

  // Derive the predicted set. History case: note-only prediction agrees with
  // the bill (doomed codes start in Common — the mind-change is in Investigate).
  const isHistoryCase = !!tc.patientHistory && !!tc.noteOnlyPredictedCodes;
  const notePredicted = useMemo(
    () => new Set(tc.noteOnlyPredictedCodes ?? []),
    [tc.noteOnlyPredictedCodes],
  );

  const analyses = result?.code_analyses ?? [];
  const pipelineBuckets = useMemo(() => bucketAnalyses(analyses), [analyses]);

  const historyBuckets = useMemo(() => {
    if (!isHistoryCase) return null;
    const matched = tc.billedCodes.filter((c) => notePredicted.has(c.code));
    const overBilled = tc.billedCodes.filter((c) => !notePredicted.has(c.code));
    return {
      matched: matched.map((c) => ({ code: c.code, description: c.description })),
      overBilled: overBilled.map((c) => ({ code: c.code, description: c.description })),
      underBilled: [] as { code: string; description: string }[],
    };
  }, [isHistoryCase, tc.billedCodes, notePredicted]);

  const matched = isHistoryCase ? historyBuckets!.matched : pipelineBuckets.matched;
  const overBilled = isHistoryCase ? historyBuckets!.overBilled : pipelineBuckets.overBilled;
  const underBilled = isHistoryCase ? historyBuckets!.underBilled : pipelineBuckets.underBilled;

  return (
    <div className="space-y-4">
      <CompareBuckets matched={matched} overBilled={overBilled} underBilled={underBilled} />

      {isHistoryCase && (
        <Card className="px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-[var(--muted)]">
            <History className="mt-0.5 h-4 w-4 flex-none text-[var(--fraud-phantom)]" />
            <p>
              The note is plausible, so the coding-expert{" "}
              <span className="font-semibold text-[var(--foreground)]">agreed</span> with the bill on
              the note-only pass — the suspect codes are in Common. The investigation pulls the patient
              history to overturn them.
            </p>
          </div>
        </Card>
      )}

      <Card className="animate-fade-rise px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--foreground)]">
            {overBilled.length > 0 ? (
              <>
                <span className="font-semibold text-[var(--risk-high)]">
                  {overBilled.map((b) => b.code).join(", ")}
                </span>{" "}
                {overBilled.length === 1 ? "was billed" : "were billed"} but our expert found nothing to
                support {overBilled.length === 1 ? "it" : "them"}. Investigate the gaps.
              </>
            ) : (
              "No over-billed codes — the bill aligns with what the note supports."
            )}
          </p>
          <button
            onClick={onInvestigate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Gavel className="h-3.5 w-3.5" /> Investigate the gaps
          </button>
        </div>
      </Card>
    </div>
  );
}

/** The three set-intersection buckets, shown immediately (click-gated by the tab). */
function CompareBuckets({
  matched,
  overBilled,
  underBilled,
}: {
  matched: { code: string; description: string }[];
  overBilled: { code: string; description: string }[];
  underBilled: { code: string; description: string }[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Compare with the bill"
        subtitle="What our expert predicted vs what the provider submitted."
        right={
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            <ScanSearch className="h-3 w-3" /> diff
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
        {/* Common */}
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--risk-low)", background: "var(--risk-low-soft)" }}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--risk-low)]">
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-xs font-semibold text-[var(--risk-low)]">Common</div>
              <div className="text-[10px] text-[var(--muted)]">On both — grounded</div>
            </div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--muted)]">{matched.length}</span>
          </div>
          <div className="space-y-1.5">
            {matched.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
                None in common.
              </div>
            ) : (
              matched.map((c) => (
                <div key={c.code} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--risk-low)]">{c.code}</span>
                  <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expert-only (under-billed) */}
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--accent)]">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-xs font-semibold text-[var(--accent)]">Expert only</div>
              <div className="text-[10px] text-[var(--muted)]">Predicted, not billed</div>
            </div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--muted)]">{underBilled.length}</span>
          </div>
          <div className="space-y-1.5">
            {underBilled.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
                None — the expert didn&apos;t add anything.
              </div>
            ) : (
              underBilled.map((c) => (
                <div key={c.code} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--accent)]">{c.code}</span>
                  <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Billed-only (over-billed) */}
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--risk-high)", background: "var(--risk-high-soft)" }}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--risk-high)]">
              <X className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-xs font-semibold text-[var(--risk-high)]">Billed only</div>
              <div className="text-[10px] text-[var(--muted)]">Billed, not predicted — investigate</div>
            </div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--muted)]">{overBilled.length}</span>
          </div>
          <div className="space-y-1.5">
            {overBilled.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
                None — nothing over-billed.
              </div>
            ) : (
              overBilled.map((c) => (
                <div key={c.code} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--risk-high)]">{c.code}</span>
                  <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Investigate: retrace (+ history mind-change) → verdict → legal brief.
// Each sub-stage is revealed by a click, never auto-timed.
// ---------------------------------------------------------------------------

function InvestigateTab({
  tc,
  stage,
  setStage,
  onRestart,
}: {
  tc: TourCase;
  stage: number;
  setStage: (s: number) => void;
  onRestart: () => void;
}) {
  // 0 = retrace/history (shown on entry), 1 = verdict, 2 = legal brief.
  return (
    <div className="space-y-4">
      {/* Stage 0: retrace / history mind-change — always shown first. */}
      {tc.patientHistory ? (
        <HistoryRetraceStep tc={tc} />
      ) : (
        <RetraceStep tc={tc} liveConfirmed={false} liveCodeSet={new Set()} />
      )}

      {/* Reveal the verdict — click. */}
      {stage < 1 && (
        <Card className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--foreground)]">
              The retrace is done. Aggregate it into a case verdict.
            </p>
            <button
              onClick={() => setStage(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <Gavel className="h-3.5 w-3.5" /> Show the verdict
            </button>
          </div>
        </Card>
      )}

      {/* Stage 1: verdict. */}
      {stage >= 1 && (
        <div className="animate-fade-rise space-y-4">
          <VerdictStep tc={tc} />
          {/* Reveal the legal brief — click. */}
          {stage < 2 && (
            <Card className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--foreground)]">
                  Generate the legal brief from the findings (textgen — Guided Docs).
                </p>
                <button
                  onClick={() => setStage(2)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <Scale className="h-3.5 w-3.5" /> Generate legal brief
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Stage 2: legal brief. */}
      {stage >= 2 && (
        <div className="animate-fade-rise space-y-4">
          <LegalBriefBlock tc={tc} />
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Run again
            </button>
            <Link
              href="/tour"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to demos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** The legal brief block — reuses the exact buildLegalBrief/findingFromResult
 *  wiring preserved from the old VerdictStep. */
function LegalBriefBlock({ tc }: { tc: TourCase }) {
  const result = useDetectorResult(tc.caseId);
  const finding = result?.findings[0];
  const detectorVerdict = finding?.analysis?.verdict ?? finding?.intent;
  const legalBriefText = useMemo(() => {
    const briefFinding = findingFromResult(result, {
      fraudType: tc.fraudType,
      verdict: detectorVerdict === "fraud" ? "fraud" : detectorVerdict === "error" ? "error" : "fraud",
      confidence: tc.fraudConfidence,
    });
    const billedCodes = tc.billedCodes.map((b) => ({ code: b.code, description: b.description }));
    return buildLegalBrief({
      caseId: tc.caseId,
      encounterDate: undefined,
      clinicalNote: tc.noteText,
      billedCodes,
      finding: briefFinding,
      analyses: result?.code_analyses,
      totalImpact: result?.total_impact,
      detected: result?.detected,
      liveNarrative: result?.source === "live" ? result?.legal_brief : undefined,
    });
  }, [tc, result, detectorVerdict]);

  return (
    <Card className="surface-sober overflow-hidden">
      <CardHeader
        title="Legal brief"
        subtitle="Generated by textgen (Guided Docs) from the detector findings — preliminary, not a determination"
        right={<Scale className="h-4 w-4 text-[var(--accent)]" />}
      />
      <div className="print-sober px-5 py-4">
        <LegalBriefView brief={legalBriefText} />
        <p className="mt-4 border-t border-[var(--border-sober)] pt-3 text-[11px] italic leading-snug text-[var(--muted)]">
          This AI-generated analysis is a preliminary investigation assessment and does not constitute a
          legal conclusion or a determination of fraud. Mere coding discrepancies do not establish a
          violation.
        </p>
        <button
          onClick={() => window.print()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-sober)] bg-[var(--surface-sober-2)] px-3 py-1.5 text-xs font-medium text-[var(--surface-sober-ink)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
        >
          <FileText className="h-3.5 w-3.5" /> Print / save as PDF
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step renderer — Retrace: the agentic framework reasons about each over-billed
// code. Reused by the Investigate tab. (Originally the tour's Step 5.)
// ---------------------------------------------------------------------------

const GROUNDING_LABEL: Record<CodeAnalysis["grounding"], { label: string; tone: "high" | "med" | "low" }> = {
  supported: { label: "Supported", tone: "low" },
  weakly_supported: { label: "Weakly supported", tone: "med" },
  unsupported: { label: "Unsupported", tone: "high" },
  contradicted: { label: "Contradicted", tone: "high" },
};

function RetraceStep({
  tc,
  liveConfirmed,
  liveCodeSet,
}: {
  tc: TourCase;
  liveConfirmed: string | false;
  liveCodeSet: Set<string>;
}) {
  const result = useDetectorResult(tc.caseId);
  const analyses = result?.code_analyses ?? [];
  const { overBilled } = useMemo(() => bucketAnalyses(analyses), [analyses]);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    overBilled.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), 600 + i * 900));
    });
    return () => timers.forEach(clearTimeout);
  }, [overBilled]);

  const finding = result?.findings[0];
  const verdict = finding?.analysis?.verdict ?? finding?.intent;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="The retrace agent reasons about each over-billed code"
          subtitle="The agentic framework asks: is this code defensible from the note?"
          right={
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
              <BrainCircuit className="h-3 w-3" /> agentic
            </span>
          }
        />
        <div className="space-y-4 p-5">
          {overBilled.length === 0 && (
            <div className="py-6 text-center text-sm text-[var(--muted)]">
              No over-billed codes to retrace — the billed codes all match the note.
            </div>
          )}
          {overBilled.map((a, i) => {
            const g = GROUNDING_LABEL[a.grounding];
            const isShown = i < revealed;
            return (
              <div
                key={a.code}
                className={cn(
                  "rounded-lg border p-4 transition-all",
                  isShown ? "tour-slide-over opacity-100" : "opacity-0",
                  a.grounding === "contradicted" || a.grounding === "unsupported"
                    ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/30"
                    : "border-[var(--border)] bg-[var(--surface)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-[var(--foreground)]">{a.code}</span>
                    {liveConfirmed && !liveCodeSet.has(a.code) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--risk-low-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
                        <Check className="h-2.5 w-2.5" /> confirmed live · {liveConfirmed}
                      </span>
                    )}
                    <span className="text-xs text-[var(--muted)]">{a.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        g.tone === "high"
                          ? "bg-[var(--risk-high-soft)] text-[var(--risk-high)]"
                          : g.tone === "med"
                            ? "bg-[var(--risk-med-soft)] text-[var(--risk-med)]"
                            : "bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
                      )}
                    >
                      <ScanSearch className="h-3 w-3" /> {g.label}
                    </span>
                  </div>
                </div>

                {isShown && a.rationale && (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">{a.rationale}</p>
                )}

                {isShown && a.noteExcerpts.length > 0 && (
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                      Note excerpts cited by the agent
                    </p>
                    <div className="space-y-1.5 font-mono text-[13px] leading-relaxed">
                      {a.noteExcerpts.slice(0, 4).map((ex, j) => (
                        <div
                          key={j}
                          className="tour-highlight-sweep flex items-start gap-2 rounded-md px-2 py-1.5"
                          style={{ animationDelay: `${j * 200}ms` }}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-white",
                              a.grounding === "contradicted" || a.grounding === "unsupported"
                                ? "bg-[var(--risk-high)]"
                                : "bg-[var(--risk-med)]",
                            )}
                          >
                            <X className="h-2.5 w-2.5" />
                          </span>
                          <span className="text-[var(--foreground)]">“{ex}”</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isShown && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                          <Gavel className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                          Agreeability
                        </span>
                      </div>
                      <SeverityMeter
                        value={a.agreeability / 100}
                        tone="high"
                        label="Defensibility"
                        invert
                        caption={`${a.agreeability}/100 — ${a.agreeability < 30 ? "not defensible" : a.agreeability < 70 ? "weakly defensible" : "defensible"}`}
                      />
                    </Card>
                    <Card className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                          <ScanSearch className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                          Grounding
                        </span>
                      </div>
                      <SeverityMeter
                        value={a.confidence}
                        tone={g.tone}
                        label="Confidence"
                        caption={`Agent confidence: ${g.label.toLowerCase()}`}
                      />
                    </Card>
                    <Card className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                          <TrendingUp className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                          Verdict
                        </span>
                      </div>
                      <DeltaChip
                        billed={a.code}
                        correct={a.predicted ? "predicted" : "not predicted"}
                        tone={a.grounding === "contradicted" || a.grounding === "unsupported" ? "high" : "med"}
                      />
                      <ConfidenceGauge value={a.confidence} />
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Case-level judgement from the agentic framework */}
      {result && revealed >= overBilled.length && overBilled.length > 0 && (
        <div className="animate-fade-rise">
          <Card className="overflow-hidden">
            <CardHeader
              title="The judgement agent's verdict"
              subtitle="Aggregates the per-code retraces into a case-level classification"
              right={
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-high)]">
                  <Gavel className="h-3 w-3" /> judgement
                </span>
              }
            />
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <FraudChip type={finding?.fraud_type ?? tc.fraudType} />
                <IntentBadge intent={verdict === "fraud" ? "fraud" : verdict === "error" ? "error" : "clean"} />
                <span className="text-xs text-[var(--muted-2)]">
                  Confidence <span className="font-semibold text-[var(--foreground)]">{finding ? Math.round(finding.confidence * 100) : 0}%</span>
                </span>
                {typeof result.detected === "boolean" && (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      result.detected
                        ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                        : "bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {result.detected ? "Detector matched planted fraud" : "Fraud caught"}
                  </span>
                )}
              </div>
              {finding?.rationale && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">{finding.rationale}</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step renderer — History retrace: the "Pull patient history" mind-change.
// Only rendered for the history-dependent case (tc.patientHistory set).
// Reused by the Investigate tab. (Originally the tour's Step 5b.)
// ---------------------------------------------------------------------------

function HistoryRetraceStep({ tc }: { tc: TourCase }) {
  const history = tc.patientHistory;
  const revoked = useMemo(() => new Set(tc.historyRevokedCodes ?? []), [tc.historyRevokedCodes]);
  const notePredicted = useMemo(() => new Set(tc.noteOnlyPredictedCodes ?? []), [tc.noteOnlyPredictedCodes]);

  // The bucket state. Pre-history: doomed codes are in Common (expert agreed
  // with the bill). Post-history: revoked codes move to Billed-only (Wrong).
  const [historyPulled, setHistoryPulled] = useState(false);
  // 0 = nothing transferred yet; increments as each revoked code animates over.
  const [transferred, setTransferred] = useState(0);
  // Show the impossibility reasoning only after the transfer completes.
  const [showReasoning, setShowReasoning] = useState(false);

  const revokedCodes = useMemo(
    () => tc.billedCodes.filter((c) => revoked.has(c.code)),
    [tc.billedCodes, revoked],
  );

  const pullHistory = useCallback(() => {
    if (historyPulled) return;
    setHistoryPulled(true);
    // Animate each revoked code transferring Common → Wrong, one by one.
    revokedCodes.forEach((_, i) => {
      setTimeout(() => setTransferred(i + 1), 500 + i * 650);
    });
    // After the last transfer lands, reveal the impossibility reasoning.
    const totalMs = 500 + revokedCodes.length * 650 + 500;
    setTimeout(() => setShowReasoning(true), totalMs);
  }, [historyPulled, revokedCodes]);

  if (!history) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="The note alone can&rsquo;t resolve this — pull the patient history"
          subtitle="The coding expert agreed with the bill from the note. The agent decides to verify against the chart."
          right={
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
              <History className="h-3 w-3" /> history
            </span>
          }
        />
        <div className="p-5">
          {/* The mind-change: two buckets, Common and Billed-only (Wrong). */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Common bucket */}
            <div
              className={cn(
                "rounded-lg border p-3 transition-colors",
                historyPulled
                  ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)]/40"
                  : "border-[var(--risk-low)]/40 bg-[var(--risk-low-soft)]",
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--risk-low)]">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--risk-low)]">Common — expert agreed</div>
                  <div className="text-[10px] text-[var(--muted)]">On both the bill and the note-only prediction</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {/* Pre-history: all note-predicted billed codes are here. */}
                {/* Post-history: revoked codes animate OUT (fade) as they transfer. */}
                {tc.billedCodes
                  .filter((c) => notePredicted.has(c.code))
                  .map((c) => {
                    const isRevoked = revoked.has(c.code);
                    const hasMoved = isRevoked && historyPulled && transferred > revokedCodes.indexOf(c);
                    return (
                      <div
                        key={c.code}
                        className={cn(
                          "flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-500",
                          hasMoved && "translate-x-2 opacity-0",
                        )}
                      >
                        <span className="font-mono text-xs font-bold text-[var(--risk-low)]">{c.code}</span>
                        <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Billed-only (Wrong) bucket — empty until history is pulled */}
            <div
              className={cn(
                "rounded-lg border p-3 transition-colors",
                historyPulled
                  ? "border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)]"
                  : "border-dashed border-[var(--border)] bg-[var(--surface-2)]/40",
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--risk-high)]">
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--risk-high)]">Billed-only — wrong after history</div>
                  <div className="text-[10px] text-[var(--muted)]">Revoked once the chart was pulled</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {revokedCodes.length === 0 && (
                  <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
                    Pull the history to investigate.
                  </div>
                )}
                {revokedCodes.map((c, i) => {
                  const hasMoved = historyPulled && transferred > i;
                  return hasMoved ? (
                    <div
                      key={c.code}
                      className="tour-slide-over flex items-start gap-2 rounded-md border border-[var(--risk-high)]/30 bg-[var(--surface)] px-2.5 py-1.5"
                    >
                      <span className="font-mono text-xs font-bold text-[var(--risk-high)]">{c.code}</span>
                      <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
                    </div>
                  ) : (
                    <div
                      key={c.code}
                      className="h-[34px] rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/40"
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* The Pull patient history action + reveal panel */}
          {!historyPulled ? (
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--foreground)]">
                The note describes a credible left-foot ulcer. Before judging, the agent pulls the
                patient&rsquo;s history to verify the procedure is even possible.
              </p>
              <button
                onClick={pullHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              >
                <History className="h-3.5 w-3.5" /> Pull patient history
              </button>
            </div>
          ) : (
            <div className="animate-fade-rise mt-4 rounded-lg border border-[var(--fraud-phantom)]/30 bg-[var(--fraud-phantom-soft)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--fraud-phantom)]">
                  <History className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--fraud-phantom)]">
                  Patient history
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">{history.summary}</p>
              <ul className="mt-2 space-y-1">
                {history.facts.map((f, i) => (
                  <li
                    key={i}
                    className="animate-fade-rise flex items-start gap-2 text-xs text-[var(--muted)]"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span className="mt-1 h-1 w-1 flex-none rounded-full bg-[var(--fraud-phantom)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* The impossibility reasoning — only after the bucket transfer completes. */}
      {showReasoning && (
        <div className="animate-fade-rise space-y-4">
          <Card className="overflow-hidden">
            <CardHeader
              title="Why the codes are impossible"
              subtitle="The agent reasons about the revoked codes against the history."
              right={
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-high)]">
                  <BrainCircuit className="h-3 w-3" /> reasoning
                </span>
              }
            />
            <div className="space-y-3 p-5">
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--risk-high)]/25 bg-[var(--risk-high-soft)]/60 px-4 py-3">
                <Microscope className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-high)]" />
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{tc.proofHeadline}</p>
              </div>
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{tc.proofBody}</p>

              {/* Per-revoked-code flag reasons */}
              <div className="space-y-2">
                {revokedCodes.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-start gap-2 rounded-lg border border-[var(--risk-high)]/30 bg-[var(--surface)] px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                      <X className="h-3 w-3" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--risk-high)]">{c.code}</span>
                        <span className="text-xs text-[var(--muted)]">{c.description}</span>
                      </div>
                      {c.flagReason && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{c.flagReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Verdict chip */}
              <div
                className="flex items-center gap-2 rounded-lg border px-4 py-3"
                style={{ borderColor: `${tc.accentColor}30`, background: tc.accentSoft }}
              >
                <Gavel className="h-4 w-4 flex-none" style={{ color: tc.accentColor }} />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Verdict: <span className="font-semibold" style={{ color: tc.accentColor }}>Phantom / services not rendered</span> — the
                  billed left-foot debridement is anatomically impossible on this patient.
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step renderer — Verdict. Rendered by the Investigate tab; the legal brief and
// "take the tour again" footer are rendered as separate click-revealed stages
// by the Investigate tab, so this card is just the verdict itself.
// ---------------------------------------------------------------------------

function VerdictStep({ tc }: { tc: TourCase }) {
  const result = useDetectorResult(tc.caseId);
  const finding = result?.findings[0];
  const detectorCategory = finding?.fraud_type;
  const detectorVerdict = finding?.analysis?.verdict ?? finding?.intent;
  // Show the detector's actual category when it differs from the tour's framing.
  const categoryMismatch = detectorCategory && detectorCategory !== tc.fraudType;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Verdict" subtitle="The detector's finding — and the full picture on one card." />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Prefer the detector's actual category; fall back to the tour framing. */}
            <FraudChip type={detectorCategory ?? tc.fraudType} />
            <IntentBadge
              intent={detectorVerdict === "fraud" ? "fraud" : detectorVerdict === "error" ? "error" : "clean"}
            />
            <span className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</span>
            {typeof result?.detected === "boolean" && (
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  result.detected
                    ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                    : "bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
                )}
                title={result.detected ? "Detector independently arrived at the planted fraud type" : "Fraud detected, but category differs from the planted type"}
              >
                <ShieldCheck className="h-3 w-3" />
                {result.detected ? "Detector matched planted fraud" : "Fraud caught"}
              </span>
            )}
          </div>

          {/* If the detector's category differs from the tour's planted type, say so honestly. */}
          {categoryMismatch && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--risk-med)]/30 bg-[var(--risk-med-soft)]/50 px-3 py-2 text-xs text-[var(--risk-med)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <span>
                The detector classified this as <span className="font-semibold">{detectorCategory}</span> rather than the
                planted <span className="font-mono">{tc.fraudType}</span> — it caught the fraud, with a different category label.
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tc.verdictFacts.map((s, i) => {
              const SIcon = s.icon;
              return (
                <div
                  key={i}
                  className="animate-fade-rise rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                    <SIcon className="h-3.5 w-3.5" /> {s.label}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-sm font-bold",
                      s.money ? "text-[var(--risk-high)] tabular-nums" : "text-[var(--foreground)]",
                    )}
                  >
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 rounded-lg border px-4 py-3"
            style={{ borderColor: `${tc.accentColor}30`, background: tc.accentSoft }}
          >
            <div className="flex items-start gap-2">
              <FlaskConical className="mt-0.5 h-4 w-4 flex-none" style={{ color: tc.accentColor }} />
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{tc.verdictConclusion}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
