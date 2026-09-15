"use client";

/**
 * Guided Tour — diagnosis padding (case_padding_002)
 * ---------------------------------------------------
 * A deterministic, animated, two-column comparison that walks a viewer through
 * a single Medicare Advantage fraud case: a wellness visit where N18.3 (CKD
 * stage 3) is billed with no supporting renal evidence in the note.
 *
 * Flow is a fixed setTimeout cascade (same timing every run) with manual
 * Next/Prev/Replay controls, mirroring the streaming-agent pattern on the case
 * detail page. The case content is transcribed from docs/eval-cases.json.
 *
 * Pure React/CSS/SVG — no animation libs, no new dependencies.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
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
  Stethoscope,
  TrendingUp,
  DollarSign,
  ScanSearch,
  Gavel,
  Sparkles,
  FlaskConical,
  Receipt,
  BrainCircuit,
  HeartPulse,
  Microscope,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Case data — transcribed verbatim from docs/eval-cases.json (case_padding_002)
// Hardcoded so the tour is self-contained and deterministic.
// ---------------------------------------------------------------------------

const CASE_ID = "case_padding_002";

const CLINICAL_NOTE =
  "CC: Annual wellness visit.\n\nHistory: 68yo male presents for Medicare annual wellness visit. Reports feeling well overall. On lisinopril for blood pressure, well-controlled. Denies chest pain, dyspnea, cough, edema, or urinary symptoms. No recent hospitalizations.\n\nExam: BP 128/78, HR 70. Lungs clear bilaterally, no wheezes or crackles. Heart regular rate and rhythm. No peripheral edema. Extremities normal.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril.\n2. Medicare annual wellness visit completed, no new concerns.";

interface TourCode {
  code: string;
  description: string;
  fraudulent: boolean;
  flagReason?: string;
}

// What the note actually supports (the truth).
const CORRECT_CODES: TourCode[] = [
  { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
  { code: "Z00.00", description: "Encounter for general adult medical exam without abnormal findings", fraudulent: false },
];

// What the provider billed (the transcript). N18.3 is the padded diagnosis.
const BILLED_CODES: TourCode[] = [
  { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
  { code: "Z00.00", description: "Encounter for general adult medical exam without abnormal findings", fraudulent: false },
  {
    code: "N18.3",
    description: "Chronic kidney disease, stage 3 (moderate)",
    fraudulent: true,
    flagReason: "No renal labs (creatinine/eGFR), no CKD history, no nephrology mention anywhere in note",
  },
];

const FRAUD_CODE = "N18.3";

// Confidence / grounding from the eval registry, matched to the dx_inflation
// pattern in src/lib/data.ts (confidence 0.79, grounding 0.08).
const FRAUD_CONFIDENCE = 0.79;
const FRAUD_GROUNDING = 0.08;

// Projected $ impact: dx_inflation in data.ts = 90 * 45 * 2.5 = 10,125.
// For the HCC/risk-adjustment story we express the single-claim HCC uplift as
// ~$2,000/yr per member and extrapolate across the detected frequency.
const PER_CLAIM_HCC_UPLIFT = 2000;
const SIMILAR_CLAIMS = 45;
const PROJECTED_IMPACT = 10125;

// Note spans that prove the missing evidence. Each is a verbatim substring of
// CLINICAL_NOTE; the tour highlights these to show no renal work was done.
const MISSING_EVIDENCE_SPANS = [
  "Denies chest pain, dyspnea, cough, edema, or urinary symptoms.",
  "Lungs clear bilaterally, no wheezes or crackles.",
  "No peripheral edema. Extremities normal.",
];

// ---------------------------------------------------------------------------
// Step model
// ---------------------------------------------------------------------------

interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  /** ms the tour waits on this step before auto-advancing (0 = no auto-advance). */
  duration: number;
}

const STEPS: TourStep[] = [
  {
    id: "intro",
    title: "The case",
    subtitle: "A Medicare Advantage wellness visit — and a diagnosis that shouldn't be there.",
    duration: 2600,
  },
  {
    id: "note",
    title: "The clinical note",
    subtitle: "What the chart actually documents. Read it carefully.",
    duration: 4200,
  },
  {
    id: "billed",
    title: "What was billed",
    subtitle: "The submitted diagnosis codes — the provider's transcript.",
    duration: 4200,
  },
  {
    id: "truth",
    title: "What the note supports",
    subtitle: "The correct codes slide over to align with their billed counterparts.",
    duration: 4200,
  },
  {
    id: "flag",
    title: "The mismatch",
    subtitle: "N18.3 has no counterpart on the truth side — and no evidence in the note.",
    duration: 5200,
  },
  {
    id: "impact",
    title: "Why it pays",
    subtitle: "N18.3 is an HCC code. Here's how a diagnosis, not a procedure, becomes money.",
    duration: 5600,
  },
  {
    id: "verdict",
    title: "Verdict",
    subtitle: "Diagnosis padding · Likely Fraud · no procedure or higher E/M level needed.",
    duration: 0,
  },
];

const TOTAL_STEPS = STEPS.length;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TourPage() {
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
    const d = STEPS[step]?.duration ?? 0;
    if (d > 0) {
      const t = setTimeout(() => {
        setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
      }, d);
      timers.current.push(t);
    }
    return clearTimers;
  }, [step, playing, clearTimers]);

  // Stop auto-advance at the final verdict step (duration 0).
  useEffect(() => {
    if (step === TOTAL_STEPS - 1) setPlaying(false);
  }, [step]);

  const next = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);
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
    if (step === TOTAL_STEPS - 1) {
      replay();
      return;
    }
    setPlaying((p) => !p);
  }, [step, replay]);

  const current = STEPS[step];
  const stepIndex = step;

  return (
    <div className="space-y-4">
      <TourHeader step={stepIndex} total={TOTAL_STEPS} />
      <TourControls
        step={stepIndex}
        total={TOTAL_STEPS}
        playing={playing}
        onPrev={prev}
        onNext={next}
        onJump={jump}
        onReplay={replay}
        onTogglePlay={togglePlay}
      />

      {/* Active step content — keyed so the tour-step-in animation re-runs. */}
      <div key={stepIndex} className="tour-step-in">
        {current.id === "intro" && <IntroStep />}
        {current.id === "note" && <NoteStep />}
        {current.id === "billed" && <BilledStep />}
        {current.id === "truth" && <TruthStep />}
        {current.id === "flag" && <FlagStep />}
        {current.id === "impact" && <ImpactStep />}
        {current.id === "verdict" && <VerdictStep onReplay={replay} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function TourHeader({ step, total }: { step: number; total: number }) {
  const current = STEPS[step];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-[var(--foreground)]">Guided Tour</span>
          <span className="font-mono text-xs">· {CASE_ID}</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-sm text-[var(--muted)]">{current.subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <FraudChip type="dx_inflation" />
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
          <BrainCircuit className="h-3 w-3" /> Medicare Advantage · risk-adjusted payment
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function TourControls({
  step,
  total,
  playing,
  onPrev,
  onNext,
  onJump,
  onReplay,
  onTogglePlay,
}: {
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
          {STEPS.map((s, i) => (
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

function IntroStep() {
  const facts = [
    { icon: Stethoscope, label: "Visit type", value: "Medicare annual wellness" },
    { icon: HeartPulse, label: "Patient", value: "68yo male, feels well, BP controlled" },
    { icon: FileText, label: "Payer model", value: "Medicare Advantage — capitated, risk-adjusted" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader title="What we're looking at" subtitle="One claim, one note, one padded diagnosis." />
        <div className="space-y-2.5 p-5">
          {facts.map((f, i) => {
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
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            In <span className="font-semibold">fee-for-service</span>, fraud usually means a
            higher-priced <em>procedure</em>. But Medicare Advantage pays plans a{" "}
            <span className="font-semibold text-[var(--accent)]">capitated, risk-adjusted</span> rate
            per member.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            The patient's <span className="font-medium text-[var(--foreground)]">risk score</span> is
            driven by submitted <span className="font-medium text-[var(--foreground)]">diagnoses</span>.
            A sicker diagnosis raises the payment — <span className="font-medium">no extra procedure or
            higher E/M level required</span>. The diagnosis <em>is</em> the money.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--fraud-dx-inflation)]/30 bg-[var(--risk-med-soft)] px-3 py-2 text-xs text-[var(--risk-med)]">
            <AlertTriangle className="h-4 w-4 flex-none" />
            <span className="font-medium">
              We'll find a diagnosis billed with zero supporting evidence in the note.
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

function NoteStep() {
  // Sentences highlight in sequentially.
  const [revealed, setRevealed] = useState(0);
  const sentences = useMemo(() => {
    // Split into display segments keeping the "important" lines as spans we can
    // highlight. We treat each newline-separated line as a unit for the reveal.
    return CLINICAL_NOTE.split("\n").filter((l) => l.trim().length > 0);
  }, []);

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
            <span>
              Look for any mention of kidneys, renal labs, creatinine, eGFR, or CKD. There is none.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — What was billed (transcript column)
// ---------------------------------------------------------------------------

function BilledStep() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    BILLED_CODES.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), 350 + i * 600));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader
          title="What was billed"
          subtitle="The submitted diagnoses — the provider's transcript."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <FileText className="h-3 w-3" /> submitted
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {BILLED_CODES.map((c, i) => (
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

function TruthStep() {
  const [aligned, setAligned] = useState(0);
  useEffect(() => {
    setAligned(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    CORRECT_CODES.forEach((_, i) => {
      timers.push(setTimeout(() => setAligned(i + 1), 500 + i * 700));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Pair billed codes with correct codes by index. N18.3 (index 2) has no
  // counterpart → that's the point.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Billed (transcript) */}
      <Card className="overflow-hidden">
        <CardHeader
          title="What was billed"
          subtitle="3 submitted diagnoses"
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <FileText className="h-3 w-3" /> submitted
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {BILLED_CODES.map((c, i) => (
            <CodeCard key={c.code} code={c} column="billed" index={i} matched={i < aligned} />
          ))}
        </div>
      </Card>

      {/* Truth */}
      <Card className="overflow-hidden">
        <CardHeader
          title="What the note supports"
          subtitle="2 codes the note actually justifies — sliding over to align."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-low)]">
              <Check className="h-3 w-3" /> grounded
            </span>
          }
        />
        <div className="space-y-2 p-4">
          {CORRECT_CODES.map((c, i) => (
            <div key={c.code} className={cn(i < aligned && "tour-slide-over")}>
              <CodeCard code={c} column="truth" index={i} matched />
            </div>
          ))}
          {/* The empty counterpart for N18.3 */}
          {aligned >= CORRECT_CODES.length && (
            <div className="tour-slide-over flex h-[88px] items-center justify-center rounded-lg border-2 border-dashed border-[var(--risk-high)]/40 bg-[var(--risk-high-soft)]/40">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--risk-high)]">
                <X className="h-4 w-4" />
                No counterpart for N18.3
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Match summary */}
      {aligned >= CORRECT_CODES.length && (
        <div className="animate-fade-rise lg:col-span-2">
          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-low-soft)] text-[var(--risk-low)]">
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--foreground)]">I10</span>
                <span className="text-[var(--muted)]">matches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-low-soft)] text-[var(--risk-low)]">
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--foreground)]">Z00.00</span>
                <span className="text-[var(--muted)]">matches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
                  <X className="h-4 w-4" />
                </span>
                <span className="font-medium text-[var(--risk-high)]">N18.3</span>
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
// Step 5 — The mismatch: severity widget + missing-evidence highlight
// ---------------------------------------------------------------------------

function FlagStep() {
  return (
    <div className="space-y-4">
      {/* The flagged comparison row */}
      <Card className="overflow-hidden">
        <CardHeader
          title="The mismatch: N18.3"
          subtitle="Billed as CKD stage 3 — with nothing in the note to back it."
          right={
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-high)]">
              <AlertTriangle className="h-3 w-3" /> no evidence
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
          <div className="tour-flag-pulse bg-[var(--risk-high-soft)]/40 px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              Billed (transcript)
            </div>
            <div className="mt-1 font-mono text-base font-bold text-[var(--risk-high)]">N18.3</div>
            <div className="text-xs text-[var(--muted)]">Chronic kidney disease, stage 3 (moderate)</div>
          </div>
          <div className="border-l border-[var(--border)] px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              Note supports (truth)
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--risk-high)]">
              <X className="h-4 w-4" /> Nothing
            </div>
            <div className="text-xs text-[var(--muted)]">No renal labs, no CKD history, no nephrology</div>
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
          <SeverityMeter value={FRAUD_CONFIDENCE} tone="high" label="Confidence" />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
              <ScanSearch className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Note grounding</div>
              <div className="text-[11px] text-[var(--muted)]">How well the note supports N18.3</div>
            </div>
          </div>
          <SeverityMeter value={FRAUD_GROUNDING} tone="high" label="Grounding" invert />
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
          <DeltaChip billed="N18.3" correct="—" tone="high" />
          <ConfidenceGauge value={FRAUD_CONFIDENCE} />
        </Card>
      </div>

      {/* Missing-evidence proof in the note */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Proof: the note says the opposite"
          subtitle="These spans explicitly show no renal involvement."
        />
        <div className="px-5 py-4">
          <div className="space-y-2 font-mono text-[13px] leading-relaxed">
            {MISSING_EVIDENCE_SPANS.map((s, i) => (
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
          <p className="mt-3 text-xs text-[var(--muted)]">
            No creatinine. No eGFR. No urinalysis. No "chronic kidney disease" anywhere. A stage-3 CKD
            diagnosis needs renal labs — and there are none.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Billing-impact widget: HCC → risk score → $
// ---------------------------------------------------------------------------

function ImpactStep() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    [0, 1, 2, 3].forEach((s) => timers.push(setTimeout(() => setStage(s + 1), 600 + s * 700)));
    return () => timers.forEach(clearTimeout);
  }, []);

  const nodes = [
    {
      icon: FileText,
      label: "N18.3 submitted",
      sub: "an HCC-eligible diagnosis",
      color: "var(--fraud-dx-inflation)",
      soft: "var(--risk-med-soft)",
    },
    {
      icon: TrendingUp,
      label: "Risk score rises",
      sub: "HCC weight added to the member",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Capitated payment ↑",
      sub: `+${formatUSD(PER_CLAIM_HCC_UPLIFT)}/yr to the plan`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Why a diagnosis pays"
          subtitle="N18.3 is an HCC code — the diagnosis itself inflates the plan's payment."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
              <BrainCircuit className="h-3 w-3" /> mechanism
            </span>
          }
        />
        <div className="p-6">
          {/* Animated flow: node → connector → node → connector → node */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {nodes.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
                      <n.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--foreground)]">{n.label}</div>
                      <div className="text-xs text-[var(--muted)]">{n.sub}</div>
                    </div>
                  </div>
                </div>
                {i < nodes.length - 1 && (
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
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                Per-claim HCC uplift
              </div>
              <div className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                {formatUSD(PER_CLAIM_HCC_UPLIFT)}/yr
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                Similar claims detected
              </div>
              <div className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                {SIMILAR_CLAIMS}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)] px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--risk-high)]">
                Projected impact
              </div>
              <div className="text-lg font-bold tabular-nums text-[var(--risk-high)]">
                {formatUSD(PROJECTED_IMPACT, true)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="px-5 py-4">
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          <span className="font-semibold">The key insight:</span> no procedure was upcoded and no E/M
          level was inflated. The provider billed the same wellness visit — but added{" "}
          <span className="font-mono font-semibold text-[var(--risk-high)]">N18.3</span> to the
          diagnosis list. In a risk-adjusted model, that single line raises the plan's capitated payment
          for the year. <span className="font-medium">The diagnosis is the money.</span>
        </p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 7 — Verdict
// ---------------------------------------------------------------------------

function VerdictStep({ onReplay }: { onReplay: () => void }) {
  const meta = FRAUD_META["dx_inflation"];
  const Icon = meta.icon;
  const summary = [
    { icon: FileText, label: "Fraud type", value: meta.label },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(PROJECTED_IMPACT, true) },
    { icon: ScanSearch, label: "Evidence", value: "Zero grounding in note" },
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Verdict" subtitle="The full picture, on one card." />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold"
              style={{ color: meta.color, background: meta.soft, borderColor: `${meta.color}33` }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} /> {meta.label}
            </span>
            <IntentBadge intent="fraud" />
            <span className="font-mono text-xs text-[var(--muted)]">{CASE_ID}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((s, i) => {
              const SIcon = s.icon;
              const isMoney = s.label === "Projected impact";
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
                      isMoney ? "text-[var(--risk-high)] tabular-nums" : "text-[var(--foreground)]",
                    )}
                  >
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-[var(--fraud-dx-inflation)]/30 bg-[var(--risk-med-soft)] px-4 py-3">
            <div className="flex items-start gap-2">
              <FlaskConical className="mt-0.5 h-4 w-4 flex-none text-[var(--fraud-dx-inflation)]" />
              <p className="text-sm leading-relaxed text-[var(--foreground)]">
                <span className="font-semibold">No procedure or higher E/M level was needed.</span> The
                diagnosis itself is the money: <span className="font-mono">N18.3</span> is an HCC code
                that raised the patient's risk score and inflated the plan's Medicare Advantage
                capitated payment — with no renal labs, no CKD history, and no nephrology anywhere in
                the note.
              </p>
            </div>
          </div>
        </div>
      </Card>

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

// ---------------------------------------------------------------------------
// Reusable: code card (one diagnosis row in either column)
// ---------------------------------------------------------------------------

function CodeCard({
  code,
  column,
  index,
  matched,
}: {
  code: TourCode;
  column: "billed" | "truth";
  index: number;
  matched?: boolean;
}) {
  const isFraud = code.fraudulent;
  const isBilled = column === "billed";
  const accent = isFraud
    ? "var(--risk-high)"
    : matched
      ? "var(--risk-low)"
      : isBilled
        ? "var(--foreground)"
        : "var(--accent)";
  return (
    <div
      className={cn(
        "animate-fade-rise flex items-start gap-3 rounded-lg border px-3 py-2.5",
        isFraud
          ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/40"
          : "border-[var(--border)] bg-[var(--surface)]",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md"
        style={{ background: isFraud ? "var(--risk-high-soft)" : "var(--surface-2)", color: accent }}
      >
        {isFraud ? (
          <AlertTriangle className="h-4 w-4" />
        ) : matched ? (
          <Check className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold" style={{ color: accent }}>
            {code.code}
          </span>
          {isFraud && (
            <span className="rounded bg-[var(--risk-high)] px-1 py-0.5 text-[10px] font-semibold uppercase text-white">
              flagged
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted)] line-clamp-2">{code.description}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

/** Horizontal severity bar that fills to a % with a colored, animated width. */
function SeverityMeter({
  value,
  tone,
  label,
  invert,
}: {
  value: number;
  tone: "high" | "med" | "low";
  label: string;
  /** When true, low grounding is BAD (rendered in risk-high). Default false. */
  invert?: boolean;
}) {
  // The first render mounts the bar at width 0; after mount we set the real
  // width so the CSS transition sweeps it in — "alive".
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.round(value * 100)), 120);
    return () => clearTimeout(t);
  }, [value]);

  const pct = Math.round(value * 100);
  // invert: low value = high severity (red). Otherwise tone drives color.
  const colorVar = invert
    ? "var(--risk-high)"
    : tone === "high"
      ? "var(--risk-high)"
      : tone === "med"
        ? "var(--risk-med)"
        : "var(--risk-low)";
  const softVar = invert
    ? "var(--risk-high-soft)"
    : tone === "high"
      ? "var(--risk-high-soft)"
      : tone === "med"
        ? "var(--risk-med-soft)"
        : "var(--risk-low-soft)";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: colorVar }}>
          {formatPct(value)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: softVar }}>
        <div
          className="tour-meter-fill h-full rounded-full"
          style={{ width: `${w}%`, background: colorVar }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--muted)]">
        {invert
          ? `Only ${pct}% of the note grounds this code — near zero.`
          : `${pct}% confidence this is intentional padding.`}
      </div>
    </div>
  );
}

/** Billed vs correct delta chip with arrow + color. */
function DeltaChip({
  billed,
  correct,
  tone,
}: {
  billed: string;
  correct: string;
  tone: "high" | "med" | "low";
}) {
  const colorVar =
    tone === "high" ? "var(--risk-high)" : tone === "med" ? "var(--risk-med)" : "var(--risk-low)";
  const softVar =
    tone === "high" ? "var(--risk-high-soft)" : tone === "med" ? "var(--risk-med-soft)" : "var(--risk-low-soft)";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
      style={{ borderColor: `${colorVar}33`, background: softVar }}
    >
      <span className="font-mono text-sm font-bold" style={{ color: colorVar }}>
        {billed}
      </span>
      <span style={{ color: colorVar }}>→</span>
      <span className="font-mono text-sm font-bold text-[var(--muted)]">{correct}</span>
    </div>
  );
}

/** SVG arc gauge that fills to a value — no libs. */
function ConfidenceGauge({ value }: { value: number }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  // Semi-circular arc, radius 34, viewBox 80x46.
  const r = 34;
  const cx = 40;
  const cy = 42;
  const circ = Math.PI * r; // half circle length
  const dash = circ * p;
  const color = "var(--risk-high)";

  return (
    <div className="mt-3 flex items-center gap-3">
      <svg width="80" height="46" viewBox="0 0 80 46" className="flex-none">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div>
        <div className="text-sm font-bold tabular-nums" style={{ color }}>
          {formatPct(p)}
        </div>
        <div className="text-[11px] text-[var(--muted)]">fraud likelihood</div>
      </div>
    </div>
  );
}
