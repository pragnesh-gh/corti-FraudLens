"use client";

/**
 * Generalized 7-step tour renderers.
 *
 * Each step takes a TourCase and renders the same visual structure as the
 * original diagnosis-padding tour, adapted to the case's fraud type:
 *   intro → note → billed → truth → mismatch → impact → verdict.
 *
 * Pure React/CSS/SVG — no animation libs, no new dependencies.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  FileText,
  TrendingUp,
  DollarSign,
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
} from "lucide-react";
import type { TourCase } from "./tour-types";
import { CodeCard, SeverityMeter, DeltaChip, ConfidenceGauge } from "./tour-widgets";
import { TryItYourself } from "./try-it-yourself";
import { getCaseResult } from "@/lib/data";
import type { CaseResult, CodeAnalysis } from "@/lib/types";

// ---------------------------------------------------------------------------
// TourEngine — the deterministic step runner + controls + header.
// Renders the active step via a lookup on the case's step ids.
// ---------------------------------------------------------------------------

const STEP_RENDERERS: Record<string, (tc: TourCase, onReplay: () => void) => React.ReactNode> = {
  intro: (tc) => <IntroStep tc={tc} />,
  note: (tc) => <NoteStep tc={tc} />,
  billed: (tc) => <BilledStep tc={tc} />,
  // Method steps (replacing the old truth-reveal + flag steps): the tour now
  // shows what our coding expert PREDICTED, then how the retrace agent REASONS
  // about each over-billed code — sourced from the real precomputed pipeline.
  predicted: (tc) => <PredictedStep tc={tc} />,
  // The history-dependent case gets a dedicated retrace step with the
  // "Pull patient history" mind-change (Common → Wrong). Other cases use the
  // standard retrace agent reasoning over the precomputed pipeline output.
  retrace: (tc) => (tc.patientHistory ? <HistoryRetraceStep tc={tc} /> : <RetraceStep tc={tc} />),
  impact: (tc) => <ImpactStep tc={tc} />,
  verdict: (tc, onReplay) => <VerdictStep tc={tc} onReplay={onReplay} />,
};

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

export function TourEngine({ tc }: { tc: TourCase }) {
  const steps = tc.steps;
  const total = steps.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Deterministic auto-advance: when playing and the current step has a
  // duration, schedule a single advance. Manual controls reset this.
  useEffect(() => {
    clearTimers();
    if (!playing) return;
    const d = steps[step]?.duration ?? 0;
    if (d > 0) {
      const t = setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), d);
      timers.current.push(t);
    }
    return clearTimers;
  }, [step, playing, clearTimers, steps, total]);

  // Stop auto-advance at the final verdict step (duration 0).
  useEffect(() => {
    if (step === total - 1) setPlaying(false);
  }, [step, total]);

  const next = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, total - 1));
  }, [total]);
  const prev = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.max(s - 1, 0));
  }, []);
  const jump = useCallback((target: number) => {
    setPlaying(false);
    setStep(target);
  }, []);
  const replay = useCallback(() => {
    clearTimers();
    setStep(0);
    setPlaying(true);
  }, [clearTimers]);
  const togglePlay = useCallback(() => {
    if (step === total - 1) {
      replay();
      return;
    }
    setPlaying((p) => !p);
  }, [step, replay, total]);

  const current = steps[step];

  return (
    <div className="space-y-4">
      <TourHeader tc={tc} step={step} />
      <TourControls
        steps={steps}
        step={step}
        total={total}
        playing={playing}
        onPrev={prev}
        onNext={next}
        onJump={jump}
        onReplay={replay}
        onTogglePlay={togglePlay}
      />

      {/* Active step content — keyed so the tour-step-in animation re-runs. */}
      <div key={step} className="tour-step-in">
        {STEP_RENDERERS[current.id]?.(tc, replay) ?? null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TourHeader({ tc, step }: { tc: TourCase; step: number }) {
  const current = tc.steps[step];
  const BrainIcon = tc.billingModel === "risk_adjustment" ? BrainCircuit : Receipt;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-[var(--foreground)]">Guided Tour</span>
          <span className="font-mono text-xs">· {tc.caseId}</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-sm text-[var(--muted)]">{current.subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <FraudChip type={tc.fraudType} />
        <span
          className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]"
        >
          <BrainIcon className="h-3 w-3" /> {tc.billingModelLabel}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function TourControls({
  steps,
  step,
  total,
  playing,
  onPrev,
  onNext,
  onJump,
  onReplay,
  onTogglePlay,
}: {
  steps: TourCase["steps"];
  step: number;
  total: number;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (target: number) => void;
  onReplay: () => void;
  onTogglePlay: () => void;
}) {
  const isLast = step === total - 1;
  return (
    <Card className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Step indicator — click a dot to jump. */}
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onJump(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              title={`${i + 1}. ${s.title}`}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step
                  ? "w-7 bg-[var(--accent)]"
                  : i < step
                    ? "w-2 cursor-pointer bg-[var(--accent)]/50 hover:bg-[var(--accent)]/70"
                    : "w-2 cursor-pointer bg-[var(--border-strong)] hover:bg-[var(--muted-2)]",
              )}
            />
          ))}
        </div>
        <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
          Step {step + 1} / {total}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={step === 0}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium transition",
              step === 0
                ? "cursor-not-allowed opacity-40"
                : "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            {isLast ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Replay
              </>
            ) : playing ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Play
              </>
            )}
          </button>
          <button
            onClick={onNext}
            disabled={step === total - 1}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium transition",
              step === total - 1
                ? "cursor-not-allowed opacity-40"
                : "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
            )}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Intro
// ---------------------------------------------------------------------------

function IntroStep({ tc }: { tc: TourCase }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader title="What we're looking at" subtitle="One claim, one note, one bad code." />
        <div className="space-y-2.5 p-5">
          {tc.introFacts.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="animate-fade-rise flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[var(--surface)] text-[var(--accent)] shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                    {f.label}
                  </div>
                  <div className="text-sm font-medium text-[var(--foreground)]">{f.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="The mechanism" subtitle="Why this fraud is hard to spot." />
        <div className="p-5">
          {tc.introMechanism.map((m, i) => (
            <p
              key={i}
              className={cn(
                "text-sm leading-relaxed",
                i === 0 ? "text-[var(--foreground)]" : "mt-3 text-[var(--muted)]",
              )}
            >
              {m.body}
            </p>
          ))}
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: `${tc.accentColor}30`,
              background: tc.accentSoft,
              color: tc.accentColor,
            }}
          >
            <AlertTriangle className="h-4 w-4 flex-none" />
            <span className="font-medium">
              We'll find a {tc.fraudType === "dx_inflation" ? "diagnosis" : "code"} billed with zero supporting evidence in the note.
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Clinical note reveal
// ---------------------------------------------------------------------------

function NoteStep({ tc }: { tc: TourCase }) {
  // Lines highlight in sequentially.
  const [revealed, setRevealed] = useState(0);
  const sentences = useMemo(() => {
    return tc.noteText.split("\n").filter((l) => l.trim().length > 0);
  }, [tc.noteText]);

  useEffect(() => {
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    sentences.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), 280 + i * 320));
    });
    return () => timers.forEach(clearTimeout);
  }, [sentences]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Clinical note"
        subtitle="Watch the relevant sentences come in. Notice what's missing."
        right={
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
            <FileText className="h-3 w-3" /> verbatim
          </span>
        }
      />
      <div className="max-h-[440px] overflow-y-auto px-5 py-4">
        <div className="space-y-1.5 font-mono text-[13px] leading-relaxed text-[var(--foreground)]">
          {sentences.map((line, i) => {
            const isShown = i < revealed;
            return (
              <p
                key={i}
                className={cn(
                  "transition-opacity duration-300",
                  isShown ? "opacity-100" : "opacity-0",
                )}
              >
                {line}
              </p>
            );
          })}
        </div>
        {revealed >= sentences.length && (
          <div className="animate-fade-rise mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)]/50 px-3 py-2 text-xs text-[var(--risk-high)]">
            <Microscope className="h-4 w-4 flex-none" />
            <span>{tc.proofHeadline}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — What was billed (transcript column)
// ---------------------------------------------------------------------------

function BilledStep({ tc }: { tc: TourCase }) {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    tc.billedCodes.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), 350 + i * 600));
    });
    return () => timers.forEach(clearTimeout);
  }, [tc.billedCodes]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader
          title="What was billed"
          subtitle="The submitted codes — the provider's transcript."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <FileText className="h-3 w-3" /> submitted
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {tc.billedCodes.map((c, i) => (
            <div key={c.code}>
              {i < revealed ? (
                <CodeCard code={c} column="billed" index={i} />
              ) : (
                <div className="h-[88px] rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40" />
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden border-dashed">
        <CardHeader
          title="What the note supports"
          subtitle="Reveals next — the correct codes."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-2)]">
              <ScanSearch className="h-3 w-3" /> pending
            </span>
          }
        />
        <div className="flex h-[260px] items-center justify-center px-4 text-center text-sm text-[var(--muted-2)]">
          <div>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] text-[var(--muted-2)]">
              <ScanSearch className="h-5 w-5" />
            </div>
            The truth column appears in the next step…
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Predicted: what our coding expert predicted (set-intersection compare)
// ---------------------------------------------------------------------------

function PredictedStep({ tc }: { tc: TourCase }) {
  const result = useDetectorResult(tc.caseId);
  const [revealed, setRevealed] = useState(0);

  // The predicted codes come from the real precomputed pipeline (codes.predict
  // + the coding-expert agent). We bucket the per-code analyses to show the
  // set intersection: matched / over-billed / under-billed.
  //
  // History-dependent case (patientHistory set): the note is authored to be
  // plausible, so a NOTE-ONLY expert AGREES with the bill — the doomed codes
  // start in Common. We derive the buckets from tc.billedCodes + the note-only
  // predicted set (tc.noteOnlyPredictedCodes) instead of the pipeline snapshot,
  // because the mind-change (Common → Wrong) happens in the retrace step.
  const isHistoryCase = !!tc.patientHistory && !!tc.noteOnlyPredictedCodes;
  const notePredicted = useMemo(
    () => new Set(tc.noteOnlyPredictedCodes ?? []),
    [tc.noteOnlyPredictedCodes],
  );

  const analyses = result?.code_analyses ?? [];
  const pipelineBuckets = useMemo(() => bucketAnalyses(analyses), [analyses]);

  // For the history case, build buckets from billed vs note-only-predicted.
  const historyBuckets = useMemo(() => {
    if (!isHistoryCase) return null;
    const matched = tc.billedCodes.filter((c) => notePredicted.has(c.code));
    const overBilled = tc.billedCodes.filter((c) => !notePredicted.has(c.code));
    return { matched: matched.map((c) => ({ code: c.code, description: c.description })), overBilled: overBilled.map((c) => ({ code: c.code, description: c.description })), underBilled: [] as { code: string; description: string }[] };
  }, [isHistoryCase, tc.billedCodes, notePredicted]);

  const matched = isHistoryCase ? historyBuckets!.matched : pipelineBuckets.matched;
  const overBilled = isHistoryCase ? historyBuckets!.overBilled : pipelineBuckets.overBilled;
  const underBilled = isHistoryCase ? historyBuckets!.underBilled : pipelineBuckets.underBilled;

  useEffect(() => {
    setRevealed(0);
    const total = matched.length + overBilled.length + underBilled.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total + 1; i++) {
      timers.push(setTimeout(() => setRevealed(i + 1), 450 + i * 520));
    }
    return () => timers.forEach(clearTimeout);
  }, [matched.length, overBilled.length, underBilled.length]);

  const predictedCount = matched.length + underBilled.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* What was billed */}
      <Card className="overflow-hidden">
        <CardHeader
          title="What was billed"
          subtitle={`${tc.billedCodes.length} submitted code${tc.billedCodes.length === 1 ? "" : "s"}`}
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <FileText className="h-3 w-3" /> submitted
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {tc.billedCodes.map((c, i) => (
            <CodeCard key={c.code} code={c} column="billed" index={i} />
          ))}
        </div>
      </Card>

      {/* What our coding expert predicted */}
      <Card className="overflow-hidden border-dashed">
        <CardHeader
          title="What our coding expert predicted"
          subtitle={`${predictedCount} code${predictedCount === 1 ? "" : "s"} from the note — via Corti medical coding.`}
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
              <ScanLine className="h-3 w-3" /> predicted
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {matched.map((a, i) => (
            <div key={a.code} className={cn(i < revealed && "tour-slide-over")}>
              <CodeCard
                code={{ code: a.code, description: a.description, fraudulent: false }}
                column="truth"
                index={i}
                matched
              />
            </div>
          ))}
          {underBilled.length > 0 && (
            <div className="mt-1 text-[11px] font-medium text-[var(--muted-2)]">
              Predicted but not billed (under-billed):
            </div>
          )}
          {underBilled.map((a, i) => (
            <div key={a.code} className={cn(i < revealed && "tour-slide-over")}>
              <CodeCard
                code={{ code: a.code, description: a.description, fraudulent: false }}
                column="truth"
                index={i}
                matched
              />
            </div>
          ))}
          {revealed > matched.length + underBilled.length && overBilled.length > 0 && (
            <div className="tour-slide-over flex h-[88px] items-center justify-center rounded-lg border-2 border-dashed border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)]/40">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--risk-high)]">
                <AlertTriangle className="h-4 w-4" />
                {overBilled.length} billed code{overBilled.length === 1 ? "" : "s"} we did not predict
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Set-intersection summary */}
      {revealed > matched.length + underBilled.length + overBilled.length && (
        <div className="animate-fade-rise lg:col-span-2">
          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-low-soft)] text-[var(--risk-low)]">
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--foreground)]">{matched.length}</span>
                <span className="text-[var(--muted)]">matched (common)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--risk-high)]">{overBilled.length}</span>
                <span className="text-[var(--muted)]">over-billed → investigate</span>
              </div>
              {underBilled.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ScanLine className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-[var(--foreground)]">{underBilled.length}</span>
                  <span className="text-[var(--muted)]">under-billed</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Retrace: the agentic framework reasons about each over-billed code
// ---------------------------------------------------------------------------

const GROUNDING_LABEL: Record<CodeAnalysis["grounding"], { label: string; tone: "high" | "med" | "low" }> = {
  supported: { label: "Supported", tone: "low" },
  weakly_supported: { label: "Weakly supported", tone: "med" },
  unsupported: { label: "Unsupported", tone: "high" },
  contradicted: { label: "Contradicted", tone: "high" },
};

function RetraceStep({ tc }: { tc: TourCase }) {
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
                <FraudChip type={(finding?.fraud_type ?? tc.fraudType)} />
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
// Step 5b — History retrace: the "Pull patient history" mind-change.
// Only rendered for the history-dependent case (tc.patientHistory set).
// The note-only compare put the doomed codes in Common (expert agreed). Here
// the agent pulls the chart → the doomed codes transfer Common → Billed-only
// (Wrong), animated, BEFORE the impossibility reasoning — because there is
// nothing to reason about until a code becomes unmatched. See
// docs/research-demo-categories.md §Category D + the "mind-change" flow.
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
// Step 6 — Billing-impact widget: the mechanism → $ flow
// ---------------------------------------------------------------------------

function ImpactStep({ tc }: { tc: TourCase }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stages = tc.impactNodes.length + 1;
    for (let s = 0; s < stages; s++) {
      timers.push(setTimeout(() => setStage(s + 1), 600 + s * 700));
    }
    return () => timers.forEach(clearTimeout);
  }, [tc.impactNodes]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={tc.impactTitle}
          subtitle={tc.impactSubtitle}
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
              <BrainCircuit className="h-3 w-3" /> mechanism
            </span>
          }
        />
        <div className="p-6">
          {/* Animated flow: node → connector → node → connector → node */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {tc.impactNodes.map((n, i) => {
              const Icon = n.icon;
              return (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                >
                  <div
                    className={cn("flex-1", stage > i && "tour-node-pop")}
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <div
                      className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
                      style={{ borderColor: `${n.color}40`, background: n.soft }}
                    >
                      <span
                        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[var(--surface)] shadow-sm"
                        style={{ color: n.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--foreground)]">{n.label}</div>
                        <div className="text-xs text-[var(--muted)]">{n.sub}</div>
                      </div>
                    </div>
                  </div>
                  {i < tc.impactNodes.length - 1 && (
                    <div className="flex items-center justify-center sm:px-1">
                      <div
                        className={cn(
                          "h-0.5 w-full rounded-full bg-[var(--accent)] sm:h-1 sm:w-10",
                          "tour-connector",
                        )}
                        style={{
                          transform: stage > i + 1 ? "scaleX(1)" : "scaleX(0)",
                          opacity: stage > i ? 1 : 0.3,
                        }}
                      />
                      <ChevronRight className="h-4 w-4 flex-none text-[var(--accent)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tc.impactStats.map((s) => (
              <div
                key={s.label}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  s.danger
                    ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-2)]",
                )}
              >
                <div
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    s.danger ? "text-[var(--risk-high)]" : "text-[var(--muted-2)]",
                  )}
                >
                  {s.label}
                </div>
                <div
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    s.danger ? "text-[var(--risk-high)]" : "text-[var(--foreground)]",
                  )}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="px-5 py-4">
        <p className="text-sm leading-relaxed text-[var(--foreground)]">{tc.impactInsight}</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 7 — Verdict
// ---------------------------------------------------------------------------

function VerdictStep({ tc, onReplay }: { tc: TourCase; onReplay: () => void }) {
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

          {/* Case referral brief — first-class textgen output (sober/printable). */}
          {result?.legal_brief && (
            <div className="surface-sober mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                <Scale className="h-3.5 w-3.5 text-[var(--accent)]" /> Case referral brief
                <span className="font-normal normal-case tracking-normal text-[var(--muted-2)]">
                  · generated by textgen (Guided Docs) · preliminary, not a determination
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] print-sober">
                {result.legal_brief}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Try it yourself — run the real coding-expert on this case's note. */}
      <TryItYourself initialCaseId={tc.caseId} />

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Receipt className="h-4 w-4 text-[var(--muted-2)]" />
            Deterministic replay — same timing, same evidence, every run.
          </div>
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Take the tour again
          </button>
        </div>
      </Card>
    </div>
  );
}
