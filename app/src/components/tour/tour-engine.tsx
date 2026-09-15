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
} from "lucide-react";
import type { TourCase } from "./tour-types";
import { CodeCard, SeverityMeter, DeltaChip, ConfidenceGauge } from "./tour-widgets";
import { TryItYourself } from "./try-it-yourself";

// ---------------------------------------------------------------------------
// TourEngine — the deterministic step runner + controls + header.
// Renders the active step via a lookup on the case's step ids.
// ---------------------------------------------------------------------------

const STEP_RENDERERS: Record<string, (tc: TourCase, onReplay: () => void) => React.ReactNode> = {
  intro: (tc) => <IntroStep tc={tc} />,
  note: (tc) => <NoteStep tc={tc} />,
  billed: (tc) => <BilledStep tc={tc} />,
  truth: (tc) => <TruthStep tc={tc} />,
  flag: (tc) => <FlagStep tc={tc} />,
  impact: (tc) => <ImpactStep tc={tc} />,
  verdict: (tc, onReplay) => <VerdictStep tc={tc} onReplay={onReplay} />,
};

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
// Step 4 — Truth column slides over to align
// ---------------------------------------------------------------------------

function TruthStep({ tc }: { tc: TourCase }) {
  const [aligned, setAligned] = useState(0);
  useEffect(() => {
    setAligned(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    tc.correctCodes.forEach((_, i) => {
      timers.push(setTimeout(() => setAligned(i + 1), 500 + i * 700));
    });
    return () => timers.forEach(clearTimeout);
  }, [tc.correctCodes]);

  // Pair billed codes with correct codes by index. The fraud code has no
  // counterpart on the truth side — that's the point.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Billed (transcript) */}
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
            <CodeCard key={c.code} code={c} column="billed" index={i} matched={i < aligned} />
          ))}
        </div>
      </Card>

      {/* Truth */}
      <Card className="overflow-hidden">
        <CardHeader
          title="What the note supports"
          subtitle={`${tc.correctCodes.length} code${tc.correctCodes.length === 1 ? "" : "s"} the note actually justifies — sliding over to align.`}
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-low)]">
              <Check className="h-3 w-3" /> grounded
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {tc.correctCodes.map((c, i) => (
            <div key={c.code} className={cn(i < aligned && "tour-slide-over")}>
              <CodeCard code={c} column="truth" index={i} matched />
            </div>
          ))}
          {/* The empty counterpart for the fraud code */}
          {aligned >= tc.correctCodes.length && (
            <div className="tour-slide-over flex h-[88px] items-center justify-center rounded-lg border-2 border-dashed border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)]/40">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--risk-high)]">
                <X className="h-4 w-4" />
                No counterpart for {tc.fraudCode}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Match summary */}
      {aligned >= tc.correctCodes.length && (
        <div className="animate-fade-rise lg:col-span-2">
          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {tc.correctCodes.map((c) => (
                <div key={c.code} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-low-soft)] text-[var(--risk-low)]">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-[var(--foreground)]">{c.code}</span>
                  <span className="text-[var(--muted)]">matches</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                  <X className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--risk-high)]">{tc.fraudCode}</span>
                <span className="text-[var(--muted)]">no supporting evidence</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — The mismatch: severity widgets + missing-evidence highlight
// ---------------------------------------------------------------------------

function FlagStep({ tc }: { tc: TourCase }) {
  return (
    <div className="space-y-4">
      {/* The flagged comparison row */}
      <Card className="overflow-hidden">
        <CardHeader
          title={tc.mismatchTitle}
          subtitle={tc.mismatchSubtitle}
          right={
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-high)]">
              <AlertTriangle className="h-3 w-3" /> no evidence
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
          <div className="tour-flag-pulse bg-[var(--risk-high-soft)]/40 px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              {tc.mismatchBilledLabel ?? "Billed (transcript)"}
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[var(--risk-high)]">{tc.fraudCode}</div>
            <div className="text-xs text-[var(--muted)]">
              {tc.billedCodes.find((c) => c.fraudulent)?.description ?? ""}
            </div>
          </div>
          <div className="border-l border-[var(--border)] px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              Note supports (truth)
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--risk-high)]">
              <X className="h-4 w-4" /> {tc.mismatchTruthValue}
            </div>
            <div className="text-xs text-[var(--muted)]">{tc.mismatchTruthCaption}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Severity widgets */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Fraud confidence</div>
              <div className="text-[11px] text-[var(--muted)]">How sure the agent is this is fraud</div>
            </div>
          </div>
          <SeverityMeter value={tc.fraudConfidence} tone="high" label="Confidence" />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
              <ScanSearch className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Note grounding</div>
              <div className="text-[11px] text-[var(--muted)]">How well the note supports {tc.fraudCode}</div>
            </div>
          </div>
          <SeverityMeter value={tc.fraudGrounding} tone="high" label="Grounding" invert />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
              <Gavel className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Delta</div>
              <div className="text-[11px] text-[var(--muted)]">Billed vs correct</div>
            </div>
          </div>
          <DeltaChip billed={tc.fraudCode} correct="—" tone="high" />
          <ConfidenceGauge value={tc.fraudConfidence} />
        </Card>
      </div>

      {/* Missing-evidence proof in the note */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Proof: the note says the opposite"
          subtitle="These spans explicitly show no supporting evidence."
        />
        <div className="px-5 py-4">
          <div className="space-y-2 font-mono text-[13px] leading-relaxed">
            {tc.missingEvidenceSpans.map((s, i) => (
              <div
                key={i}
                className="tour-highlight-sweep flex items-start gap-2 rounded-md px-2 py-1.5"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[var(--risk-high)] text-white">
                  <X className="h-2.5 w-2.5" />
                </span>
                <span className="text-[var(--foreground)]">{s}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">{tc.proofBody}</p>
        </div>
      </Card>
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
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Verdict" subtitle="The full picture, on one card." />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <FraudChip type={tc.fraudType} />
            <IntentBadge intent="fraud" />
            <span className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</span>
          </div>

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
