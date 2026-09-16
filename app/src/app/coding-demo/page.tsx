"use client";

/**
 * /coding-demo — "Coding Expert at work"
 *
 * A single-page, auto-playing 3-phase experience showing the coding expert
 * reading a clinical note in real time, extracting codes, comparing against
 * the bill, then investigating the discrepancies. case_padding_002 (diagnosis
 * padding).
 *
 *   Phase 1 — Reading the note (extraction)  ~12-18s, auto-plays
 *   Phase 2 — Compare with the bill         triggered by "Compare"
 *   Phase 3 — Investigate the gaps           triggered by "Investigate"
 *
 * Deterministic setTimeout cascade (same every run). Fires the REAL
 * /api/coding-expert agent in the background on mount, non-blocking; if it
 * returns codes, a "confirmed live" badge appears on matching extracted codes.
 * Pure React/CSS/SVG — no screenshots, no multimodal, no new deps.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn, formatUSD } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  X,
  Check,
  ScanSearch,
  Sparkles,
  FileText,
  Loader2,
  ArrowLeft,
  BrainCircuit,
  Gavel,
  FlaskConical,
  Receipt,
  TrendingUp,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data — case_padding_002 (verbatim)
// ---------------------------------------------------------------------------

const CASE_ID = "case_padding_002";

const NOTE = `CC: Annual wellness visit.

History: 68yo male presents for Medicare annual wellness visit. Reports feeling well overall. On lisinopril for blood pressure, well-controlled. Denies chest pain, dyspnea, cough, edema, or urinary symptoms. No recent hospitalizations.

Exam: BP 128/78, HR 70. Lungs clear bilaterally, no wheezes or crackles. Heart regular rate and rhythm. No peripheral edema. Extremities normal.

Assessment/Plan:
1. Essential hypertension, well-controlled - continue lisinopril.
2. Medicare annual wellness visit completed, no new concerns.`;

interface ExtractSpec {
  code: string;
  desc: string;
  /** Verbatim phrase substring of NOTE. */
  phrase: string;
}

/** A segment of the rendered note — either plain text or a highlighted phrase. */
type NoteSegment =
  | { kind: "text"; text: string }
  | { kind: "phrase"; text: string; index: number };
// Char offsets (computed, verified against NOTE above):
//   phrase 1 at 431..493, phrase 2 at 497..537
const EXTRACTS: ExtractSpec[] = [
  {
    code: "I10",
    desc: "Essential (primary) hypertension",
    phrase: "Essential hypertension, well-controlled - continue lisinopril.",
  },
  {
    code: "Z00.00",
    desc: "Encounter for general adult medical exam without abnormal findings",
    phrase: "Medicare annual wellness visit completed",
  },
];

interface BilledCode {
  code: string;
  desc: string;
  legit: boolean;
}
const BILLED: BilledCode[] = [
  { code: "I10", desc: "Essential (primary) hypertension", legit: true },
  { code: "Z00.00", desc: "Encounter for general adult medical exam without abnormal findings", legit: true },
  { code: "N18.3", desc: "Chronic kidney disease, stage 3 (moderate)", legit: false },
];

// Phase 3 — evidence keywords the scan searches for (none present).
const EVIDENCE_KEYWORDS = ["renal", "creatinine", "eGFR", "CKD", "kidney", "nephrology", "GFR"];
// Phase 3 — contradiction phrases present in the note (verbatim substrings).
// offsets: c1 at 173..235, c2 at 369..409
const CONTRADICTIONS = [
  "Denies chest pain, dyspnea, cough, edema, or urinary symptoms.",
  "No peripheral edema. Extremities normal.",
];

const REASONING =
  "N18.3 (CKD stage 3) has zero grounding in the note. No renal labs, no CKD history — the note actively contradicts it. Diagnosis padding for Medicare Advantage risk-adjustment: the diagnosis itself is the money.";
const REASONING_LONG =
  "N18.3 (CKD stage 3) requires renal labs (creatinine/eGFR) or a CKD history. The note has none — it actively denies urinary symptoms and edema. Zero grounding. This is diagnosis padding: in Medicare Advantage risk-adjustment, N18.3 is an HCC code that raises the patient's risk score and the plan's capitated payment — the diagnosis itself is the money.";

const PROJECTED_IMPACT = 90 * 45 * 2.5; // $10,125

// ---------------------------------------------------------------------------
// Live agent result type (matches /api/coding-expert response shape)
// ---------------------------------------------------------------------------
interface LiveResult {
  source: "live" | "replay";
  region?: string;
  predictedCodes: { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] };
  error?: string;
}

// ---------------------------------------------------------------------------
// Timing helpers — deterministic cascade
// ---------------------------------------------------------------------------
const T = {
  // Phase 1
  readStartGap: 900,
  perPhraseRead: 2400, // gap between phrase highlights
  phraseHold: 1100, // how long a phrase stays lit before the next
  phase1DoneBuffer: 900,
  // Phase 2
  bucketStagger: 600,
  codeSlideGap: 450,
  // Phase 3
  scanDuration: 2200,
  keywordGap: 360,
  contradictionGap: 700,
  reasoningDelay: 900,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CodingDemoPage() {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [playing, setPlaying] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Phase 1 state
  const [readingIndex, setReadingIndex] = useState(-1); // which phrase is lit
  const [extractedCount, setExtractedCount] = useState(0); // codes extracted so far
  const [phase1Done, setPhase1Done] = useState(false);

  // Live agent
  const [liveArmed, setLiveArmed] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // --- Live agent: fire on mount, non-blocking. Also probe armed state. ---
  useEffect(() => {
    let cancelled = false;
    fetch("/api/coding-expert")
      .then((r) => r.json())
      .then((d) => !cancelled && setLiveArmed(Boolean(d.live)))
      .catch(() => !cancelled && setLiveArmed(false));
    // Fire the real agent in the background — never blocks the animation.
    fetch("/api/coding-expert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: NOTE }),
    })
      .then((r) => r.json())
      .then((d: LiveResult) => !cancelled && setLiveResult(d))
      .catch(() => !cancelled && setLiveResult(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Phase 1: deterministic reading cascade ---
  const runPhase1 = useCallback(() => {
    clearTimers();
    setReadingIndex(-1);
    setExtractedCount(0);
    setPhase1Done(false);
    setPlaying(true);
    EXTRACTS.forEach((_, i) => {
      // light up the phrase
      timers.current.push(
        setTimeout(() => setReadingIndex(i), T.readStartGap + i * T.perPhraseRead),
      );
      // extract the code shortly after the phrase lights
      timers.current.push(
        setTimeout(
          () => setExtractedCount(i + 1),
          T.readStartGap + i * T.perPhraseRead + T.phraseHold,
        ),
      );
    });
    // mark phase 1 complete
    timers.current.push(
      setTimeout(() => {
        setPhase1Done(true);
        setPlaying(false);
      }, T.readStartGap + EXTRACTS.length * T.perPhraseRead + T.phase1DoneBuffer),
    );
  }, [clearTimers]);

  useEffect(() => {
    runPhase1();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Controls ---
  const goCompare = useCallback(() => {
    clearTimers();
    setPhase(2);
    setPlaying(false);
  }, [clearTimers]);

  const goInvestigate = useCallback(() => {
    clearTimers();
    setPhase(3);
    setPlaying(false);
  }, [clearTimers]);

  const restart = useCallback(() => {
    clearTimers();
    setPhase(1);
    setReadingIndex(-1);
    setExtractedCount(0);
    setPhase1Done(false);
    runPhase1();
  }, [clearTimers, runPhase1]);

  const nextPhase = useCallback(() => {
    clearTimers();
    setPlaying(false);
    if (phase === 1 && phase1Done) setPhase(2);
    else if (phase === 2) setPhase(3);
  }, [clearTimers, phase, phase1Done]);

  const togglePlay = useCallback(() => {
    if (phase === 1) {
      if (phase1Done) {
        // phase 1 finished -> play advances to compare
        goCompare();
        return;
      }
      setPlaying((p) => !p);
    } else {
      // phases 2/3 are button-gated; play/replay restarts
      restart();
    }
  }, [phase, phase1Done, goCompare, restart]);

  // Pause/resume only meaningfully affects phase 1 (the auto-playing part).
  const pausePhase1 = useCallback(() => {
    clearTimers();
    setPlaying(false);
  }, [clearTimers]);

  // Set of codes the live agent confirmed (for the "confirmed live" badge).
  const liveDxCodes = new Set(
    (liveResult?.predictedCodes.dx ?? []).map((d) => d.code),
  );
  const liveConfirmed: string | false =
    liveResult?.source === "live" ? liveResult.region ?? false : false;

  return (
    <div className="space-y-4">
      <DemoHeader
        phase={phase}
        phase1Done={phase1Done}
        liveArmed={liveArmed}
        liveConfirmed={liveConfirmed}
        playing={playing}
        onTogglePlay={togglePlay}
        onNext={nextPhase}
        onRestart={restart}
        onPause={pausePhase1}
      />

      <div key={phase} className="tour-step-in">
        {phase === 1 && (
          <Phase1
            readingIndex={readingIndex}
            extractedCount={extractedCount}
            phase1Done={phase1Done}
            liveDxCodes={liveDxCodes}
            liveConfirmed={liveConfirmed}
            onCompare={goCompare}
          />
        )}
        {phase === 2 && <Phase2 onInvestigate={goInvestigate} />}
        {phase === 3 && <Phase3 onRestart={restart} />}
      </div>

      {/* Footer exit */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <ScanSearch className="h-4 w-4 text-[var(--muted-2)]" />
            Deterministic replay — same extraction, same gaps, every run.
          </div>
          <Link
            href="/tour"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to tour
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header + controls
// ---------------------------------------------------------------------------

const PHASES = [
  { id: 1, label: "Extract", icon: Sparkles },
  { id: 2, label: "Compare", icon: ScanSearch },
  { id: 3, label: "Investigate", icon: Gavel },
] as const;

function DemoHeader({
  phase,
  phase1Done,
  liveArmed,
  liveConfirmed,
  playing,
  onTogglePlay,
  onNext,
  onRestart,
  onPause,
}: {
  phase: 1 | 2 | 3;
  phase1Done: boolean;
  liveArmed: boolean;
  liveConfirmed: string | false;
  playing: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onRestart: () => void;
  onPause: () => void;
}) {
  const canNext = (phase === 1 && phase1Done) || phase === 2;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <ScanSearch className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-[var(--foreground)]">Coding Expert at work</span>
            <span className="font-mono text-xs">· {CASE_ID}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            Watch the coding expert read the note, extract codes, then compare against the bill.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <FraudChip type="dx_inflation" />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
              liveConfirmed
                ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                liveConfirmed ? "bg-[var(--risk-low)]" : "bg-[var(--muted-2)]",
              )}
            />
            {liveConfirmed ? `Live · ${liveConfirmed}` : liveArmed ? "Armed" : "Replay"}
          </span>
        </div>
      </div>

      {/* Phase indicator + controls */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {PHASES.map((p) => {
              const Icon = p.icon;
              const active = phase === p.id;
              const done = phase > p.id;
              return (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : done
                          ? "text-[var(--risk-low)]"
                          : "text-[var(--muted-2)]",
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
                    {p.id}. {p.label}
                  </span>
                  {p.id < 3 && <ChevronRight className="h-3.5 w-3.5 text-[var(--border-strong)]" />}
                </div>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {phase === 1 && playing && (
              <button
                onClick={onPause}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
            )}
            {phase === 1 && !playing && !phase1Done && (
              <button
                onClick={onTogglePlay}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" /> Play
              </button>
            )}
            <button
              onClick={onNext}
              disabled={!canNext}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium transition",
                canNext
                  ? "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  : "cursor-not-allowed opacity-40",
              )}
            >
              Next phase <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRestart}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — Reading the note (extraction)
// ---------------------------------------------------------------------------

function Phase1({
  readingIndex,
  extractedCount,
  phase1Done,
  liveDxCodes,
  liveConfirmed,
  onCompare,
}: {
  readingIndex: number;
  extractedCount: number;
  phase1Done: boolean;
  liveDxCodes: Set<string>;
  liveConfirmed: string | false;
  onCompare: () => void;
}) {
  // Build the note with the active phrase highlighted (char-offset slicing,
  // mirroring the case detail page's renderNote pattern).
  const noteParts = useMemo<NoteSegment[]>(() => {
    if (readingIndex < 0) {
      return [{ kind: "text", text: NOTE }];
    }
    const active = EXTRACTS[readingIndex];
    const start = NOTE.indexOf(active.phrase);
    const end = start + active.phrase.length;
    return [
      { kind: "text", text: NOTE.slice(0, start) },
      { kind: "phrase", text: active.phrase, index: readingIndex },
      { kind: "text", text: NOTE.slice(end) },
    ];
  }, [readingIndex]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
      {/* Left: clinical note with reading highlight */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Clinical note"
          subtitle={
            phase1Done
              ? "The coding expert has finished reading the note."
              : "The coding expert is reading the note — watch the phrases light up."
          }
          right={
            !phase1Done ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                <Loader2 className="h-3 w-3 animate-spin" /> reading…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-low)]">
                <Check className="h-3 w-3" /> read
              </span>
            )
          }
        />
        <div className="max-h-[460px] overflow-y-auto px-5 py-4 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">
            {noteParts.map((p, i) => {
              if (p.kind === "phrase") {
                return (
                  <span key={i} className="cd-phrase-read">
                    {p.text}
                  </span>
                );
              }
              return <span key={i}>{p.text}</span>;
            })}
          </p>
        </div>
      </Card>

      {/* Right: extracted codes panel + connector */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Extracted codes"
            subtitle="Each highlighted phrase becomes a code."
            right={
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                <Sparkles className="h-3 w-3" /> {extractedCount}/{EXTRACTS.length}
              </span>
            }
          />
          <div className="space-y-2.5 p-4">
            {/* Connector from phrase -> panel (visual cue), shown for the latest */}
            {readingIndex >= 0 && extractedCount <= readingIndex && (
              <div className="flex items-center gap-1 px-1 pb-1">
                <span className="cd-connector-draw h-0.5 w-10 rounded-full bg-[var(--accent)]" />
                <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="text-[11px] font-medium text-[var(--accent)]">extracting…</span>
              </div>
            )}
            {EXTRACTS.slice(0, extractedCount).map((e, i) => {
              const liveHit = liveDxCodes.has(e.code);
              return (
                <div key={e.code} className="cd-extract-pop">
                  <ExtractedCodeCard
                    code={e.code}
                    desc={e.desc}
                    phrase={e.phrase}
                    liveHit={liveHit}
                    liveConfirmed={liveConfirmed}
                  />
                </div>
              );
            })}
            {extractedCount === 0 && (
              <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 text-xs text-[var(--muted-2)]">
                Waiting for the expert to read…
              </div>
            )}
          </div>
        </Card>

        {phase1Done && (
          <Card className="animate-fade-rise px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--foreground)]">
                The expert extracted <span className="font-semibold">{EXTRACTS.length} diagnoses</span> from the
                note. Now compare them against what the provider actually billed.
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
    </div>
  );
}

function ExtractedCodeCard({
  code,
  desc,
  phrase,
  liveHit,
  liveConfirmed,
}: {
  code: string;
  desc: string;
  phrase: string;
  liveHit: boolean;
  liveConfirmed: string | false;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm">
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{code}</span>
          {liveHit && liveConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--risk-low-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
              <Check className="h-2.5 w-2.5" /> confirmed live · {liveConfirmed}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted)] line-clamp-2">{desc}</div>
        <div className="mt-1 truncate text-[11px] text-[var(--muted-2)]">
          <FileText className="mr-1 inline h-2.5 w-2.5" />
          “{phrase}”
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 — Compare with the bill
// ---------------------------------------------------------------------------

interface BucketCode {
  code: string;
  desc: string;
}
// Determined from EXTRACTS vs BILLED.
const COMMON: BucketCode[] = [
  { code: "I10", desc: "Essential (primary) hypertension" },
  { code: "Z00.00", desc: "Encounter for general adult medical exam without abnormal findings" },
];
const EXPERT_ONLY: BucketCode[] = [];
const BILLED_ONLY: BucketCode[] = [
  { code: "N18.3", desc: "Chronic kidney disease, stage 3 (moderate)" },
];

function Phase2({ onInvestigate }: { onInvestigate: () => void }) {
  // Animate buckets in, then codes sliding in.
  const [bucketsShown, setBucketsShown] = useState(0);
  const [commonCount, setCommonCount] = useState(0);
  const [expertCount, setExpertCount] = useState(0);
  const [billedOnlyCount, setBilledOnlyCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Reveal buckets one at a time.
    timers.push(setTimeout(() => setBucketsShown(1), 250));
    timers.push(setTimeout(() => setBucketsShown(2), 250 + T.bucketStagger));
    timers.push(setTimeout(() => setBucketsShown(3), 250 + T.bucketStagger * 2));
    // Slide codes into each bucket.
    COMMON.forEach((_, i) =>
      timers.push(setTimeout(() => setCommonCount(i + 1), 250 + T.bucketStagger * 2 + 300 + i * T.codeSlideGap)),
    );
    EXPERT_ONLY.forEach((_, i) =>
      timers.push(setTimeout(() => setExpertCount(i + 1), 250 + T.bucketStagger * 2 + 300 + COMMON.length * T.codeSlideGap + i * T.codeSlideGap)),
    );
    BILLED_ONLY.forEach((_, i) =>
      timers.push(
        setTimeout(
          () => setBilledOnlyCount(i + 1),
          250 + T.bucketStagger * 2 + 300 + (COMMON.length + EXPERT_ONLY.length) * T.codeSlideGap + i * T.codeSlideGap,
        ),
      ),
    );
    timers.push(
      setTimeout(
        () => setDone(true),
        250 + T.bucketStagger * 2 + 300 + (COMMON.length + EXPERT_ONLY.length + BILLED_ONLY.length) * T.codeSlideGap + 400,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Compare with the bill"
          subtitle="Extracted codes vs what the provider submitted."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <ScanSearch className="h-3 w-3" /> diff
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          <Bucket
            title="Common"
            caption="On both — grounded"
            tone="good"
            shown={bucketsShown >= 1}
            codes={COMMON.slice(0, commonCount)}
            total={COMMON.length}
          />
          <Bucket
            title="Expert only"
            caption="Extracted, not billed"
            tone="neutral"
            shown={bucketsShown >= 2}
            codes={EXPERT_ONLY.slice(0, expertCount)}
            total={EXPERT_ONLY.length}
            empty="None — the expert didn't add anything."
          />
          <Bucket
            title="Billed only"
            caption="Billed, not extracted — suspicious"
            tone="bad"
            shown={bucketsShown >= 3}
            codes={BILLED_ONLY.slice(0, billedOnlyCount)}
            total={BILLED_ONLY.length}
          />
        </div>
      </Card>

      {done && (
        <Card className="animate-fade-rise px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--foreground)]">
              <span className="font-semibold text-[var(--risk-high)]">N18.3</span> was billed but the coding
              expert found nothing in the note to support it. That's a discrepancy worth investigating.
            </p>
            <button
              onClick={onInvestigate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <Gavel className="h-3.5 w-3.5" /> Investigate the gaps
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Bucket({
  title,
  caption,
  tone,
  shown,
  codes,
  total,
  empty,
}: {
  title: string;
  caption: string;
  tone: "good" | "neutral" | "bad";
  shown: boolean;
  codes: BucketCode[];
  total: number;
  empty?: string;
}) {
  const toneStyles =
    tone === "good"
      ? { border: "var(--risk-low)", soft: "var(--risk-low-soft)", color: "var(--risk-low)", icon: Check }
      : tone === "bad"
        ? { border: "var(--risk-high)", soft: "var(--risk-high-soft)", color: "var(--risk-high)", icon: X }
        : { border: "var(--accent)", soft: "var(--accent-soft)", color: "var(--accent)", icon: Sparkles };
  const Icon = toneStyles.icon;
  if (!shown) {
    return (
      <div className="flex min-h-[150px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 text-xs text-[var(--muted-2)]">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> preparing…
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn("tour-slide-over rounded-lg border p-3", shown && "tour-slide-over")}
      style={{ borderColor: `${toneStyles.border}40`, background: toneStyles.soft }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md"
          style={{ background: "var(--surface)", color: toneStyles.color }}
        >
          <Icon className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div>
          <div className="text-xs font-semibold" style={{ color: toneStyles.color }}>
            {title}
          </div>
          <div className="text-[10px] text-[var(--muted)]">{caption}</div>
        </div>
        <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--muted)]">
          {codes.length}/{total}
        </span>
      </div>
      <div className="space-y-1.5">
        {codes.length === 0 && empty ? (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
            {empty}
          </div>
        ) : (
          codes.map((c) => (
            <div
              key={c.code}
              className="tour-slide-over flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5"
            >
              <span className="font-mono text-xs font-bold" style={{ color: toneStyles.color }}>
                {c.code}
              </span>
              <span className="text-[11px] leading-tight text-[var(--muted)]">{c.desc}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3 — Investigate the gaps
// ---------------------------------------------------------------------------

function Phase3({ onRestart }: { onRestart: () => void }) {
  const [stage, setStage] = useState(0);
  // 0: scanning  1: keywords checked  2: contradictions shown  3: reasoning  4: verdict
  const [scanDone, setScanDone] = useState(false);
  const [keywordsChecked, setKeywordsChecked] = useState(0);
  const [contradictionsShown, setContradictionsShown] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Start the scan sweep.
    timers.push(setTimeout(() => setStage(1), 300));
    timers.push(setTimeout(() => setScanDone(true), 300 + T.scanDuration));
    // Check evidence keywords one at a time (all "not found").
    EVIDENCE_KEYWORDS.forEach((_, i) =>
      timers.push(setTimeout(() => setKeywordsChecked(i + 1), 300 + T.scanDuration + 250 + i * T.keywordGap)),
    );
    // Show contradiction phrases.
    const kwDone = 300 + T.scanDuration + 250 + EVIDENCE_KEYWORDS.length * T.keywordGap;
    CONTRADICTIONS.forEach((_, i) =>
      timers.push(setTimeout(() => setContradictionsShown(i + 1), kwDone + T.contradictionGap + i * (T.contradictionGap + 300))),
    );
    const contraDone = kwDone + T.contradictionGap + (CONTRADICTIONS.length - 1) * (T.contradictionGap + 300) + 300;
    timers.push(setTimeout(() => setShowReasoning(true), contraDone + T.reasoningDelay));
    timers.push(setTimeout(() => setShowVerdict(true), contraDone + T.reasoningDelay + 1100));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-4">
      {/* The investigation: note scan + evidence findings */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Investigating N18.3 (CKD stage 3)"
          subtitle="Scanning the note for any supporting evidence."
          right={
            stage === 1 && !scanDone ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                <Search className="h-3 w-3 animate-pulse-soft" /> scanning…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-high)]">
                <X className="h-3 w-3" /> no evidence
              </span>
            )
          }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* Note with scan sweep + contradiction highlights */}
          <div className="px-5 py-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              Clinical note — scanning for renal evidence
            </div>
            <div
              className={cn(
                "relative max-h-[360px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-3",
              )}
            >
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--foreground)]">
                {renderScanNote(stage === 1 && !scanDone, contradictionsShown)}
              </p>
            </div>
          </div>

          {/* Evidence findings panel */}
          <div className="border-l border-[var(--border)] px-5 py-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              Evidence search
            </div>
            <div className="space-y-1.5">
              {EVIDENCE_KEYWORDS.map((kw, i) => {
                const checked = i < keywordsChecked;
                return (
                  <div
                    key={kw}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition",
                      checked
                        ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/50"
                        : "border-[var(--border)] bg-[var(--surface)] opacity-40",
                    )}
                  >
                    {checked ? (
                      <X className="h-3.5 w-3.5 flex-none text-[var(--risk-high)]" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-[var(--muted-2)]" />
                    )}
                    <span className="font-mono font-medium">{kw}</span>
                    <span className="ml-auto text-[11px] text-[var(--muted)]">
                      {checked ? "not found" : "searching…"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Contradiction callouts */}
            {contradictionsShown > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--risk-high)]">
                  Active contradictions
                </div>
                {CONTRADICTIONS.slice(0, contradictionsShown).map((c) => (
                  <div
                    key={c}
                    className="cd-contradiction-flash flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--foreground)]"
                  >
                    <X className="mt-0.5 h-3 w-3 flex-none text-[var(--risk-high)]" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Reasoning */}
      {showReasoning && (
        <Card className="animate-fade-rise overflow-hidden">
          <CardHeader
            title="Reasoning"
            subtitle="Why N18.3 is unsupported."
            right={
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-high-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-high)]">
                <FlaskConical className="h-3 w-3" /> analysis
              </span>
            }
          />
          <div className="px-5 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--risk-high)]/25 bg-[var(--risk-high-soft)]/60 px-4 py-3">
              <TrendingUp className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-high)]" />
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{REASONING_LONG}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Verdict */}
      {showVerdict && (
        <Card className="animate-fade-rise overflow-hidden">
          <CardHeader title="Verdict" subtitle="The full picture, on one card." />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <FraudChip type="dx_inflation" />
              <IntentBadge intent="fraud" />
              <span className="font-mono text-xs text-[var(--muted)]">{CASE_ID}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <VerdictFact icon={Gavel} label="Fraud type" value="Diagnosis padding" />
              <VerdictFact icon={FlaskConical} label="Intent" value="Likely Fraud" />
              <VerdictFact icon={TrendingUp} label="HCC code" value="N18.3" />
              <VerdictFact icon={Receipt} label="Projected impact" value={formatUSD(PROJECTED_IMPACT, true)} money />
            </div>

            <div className="mt-4 rounded-lg border border-[var(--fraud-dx-inflation)]/30 bg-[var(--risk-med-soft)] px-4 py-3">
              <div className="flex items-start gap-2">
                <BrainCircuit className="mt-0.5 h-4 w-4 flex-none" style={{ color: "var(--fraud-dx-inflation)" }} />
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{REASONING}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
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
                <ArrowLeft className="h-3.5 w-3.5" /> Back to tour
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Render the note with the scan sweep overlay and contradiction highlights. */
function renderScanNote(scanning: boolean, contradictionsShown: number) {
  // Build segments: insert contradiction <mark> spans at their offsets.
  // Sort contradictions by start offset.
  const marks = CONTRADICTIONS.map((phrase) => {
    const start = NOTE.indexOf(phrase);
    return { phrase, start, end: start + phrase.length };
  })
    .filter((m) => m.start >= 0)
    .sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) parts.push(<span key={`t${i}`}>{NOTE.slice(cursor, m.start)}</span>);
    const shown = i < contradictionsShown;
    parts.push(
      <mark
        key={`m${i}`}
        className={cn(
          "rounded px-0.5 py-0.5",
          shown ? "cd-contradiction-flash text-[var(--foreground)]" : "text-[var(--foreground)]",
        )}
        style={shown ? undefined : { background: "transparent" }}
      >
        {NOTE.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < NOTE.length) parts.push(<span key="end">{NOTE.slice(cursor)}</span>);

  return (
    <span className="relative">
      {scanning && <span className="cd-scan-sweep absolute inset-0" aria-hidden />}
      <span className="relative">{parts}</span>
    </span>
  );
}

function VerdictFact({
  icon: Icon,
  label,
  value,
  money,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  money?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-bold",
          money ? "text-[var(--risk-high)] tabular-nums" : "text-[var(--foreground)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
