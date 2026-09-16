"use client";

/**
 * /tour/[caseId] — the phased "Live Demo" case experience.
 *
 * Follows the /coding-demo flow, generalized to any tour case and the FULL
 * pipeline (predict → compare → retrace → judgement → legal brief):
 *
 *   Phase 1 — Reading the note + extracting codes   auto-plays (timed cascade)
 *   Phase 2 — Predict & compare (set-intersection) triggered by "Compare"
 *   Phase 3 — Investigate the gaps                  triggered by "Investigate"
 *             per over-billed code: retrace agreeability + grounding + cited
 *             note excerpts + rationale, then the judgement verdict, then the
 *             legal/referral brief.
 *
 * The page reads the precomputed (real-pipeline) result immediately (instant,
 * offline — getCaseResult(caseId)), AND fires /api/run-pipeline live on mount
 * (non-blocking). The phased UI plays against the precomputed data; when the
 * live CaseResult lands, "confirmed live" badges mark the codes/numbers that
 * came from the real run.
 *
 * Pure React/CSS — no screenshots, no multimodal, no new deps.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import { getTourCase } from "@/lib/tour-cases";
import { getCaseResult } from "@/lib/data";
import { FRAUD_META } from "@/lib/fraud-meta";
import type { CaseResult, CodeAnalysis, FraudType } from "@/lib/types";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ScanSearch,
  Sparkles,
  FileText,
  Loader2,
  ArrowLeft,
  Gavel,
  FlaskConical,
  Receipt,
  Scale,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Timing — deterministic cascade (same shape as /coding-demo)
// ---------------------------------------------------------------------------
const T = {
  // Phase 1
  readStartGap: 700,
  perCodeRead: 1900,
  codeHold: 850,
  phase1DoneBuffer: 800,
  // Phase 2
  bucketStagger: 550,
  codeSlideGap: 420,
  // Phase 3
  retraceGap: 750,
  excerptGap: 320,
  verdictDelay: 900,
  briefDelay: 900,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TourCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const tc = getTourCase(caseId);

  // Precomputed (real-pipeline) result — instant, offline.
  const precomputed = useMemo(() => (tc ? getCaseResult(tc.caseId) : undefined), [tc]);

  if (!tc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
            <ChevronLeft className="h-3.5 w-3.5" /> Live Demos
          </Link>
        </div>
        <div className="py-20 text-center text-[var(--muted)]">
          Case <span className="font-mono">{caseId}</span> not found.{" "}
          <Link href="/tour" className="text-[var(--accent)] underline">
            Back to demos
          </Link>
        </div>
      </div>
    );
  }

  return <TourCaseExperience caseId={tc.caseId} precomputed={precomputed} />;
}

// ---------------------------------------------------------------------------
// Live result type (matches /api/run-pipeline CaseResult response)
// ---------------------------------------------------------------------------
interface LiveResult extends CaseResult {
  error?: string;
}

function TourCaseExperience({
  caseId,
  precomputed,
}: {
  caseId: string;
  precomputed: CaseResult | undefined;
}) {
  const tc = getTourCase(caseId)!;
  const meta = FRAUD_META[tc.fraudType];

  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [playing, setPlaying] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Phase 1 state
  const [readingIndex, setReadingIndex] = useState(-1);
  const [extractedCount, setExtractedCount] = useState(0);
  const [phase1Done, setPhase1Done] = useState(false);

  // Live agent
  const [liveArmed, setLiveArmed] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // The active result to render against: prefer the live result when it lands,
  // fall back to the precomputed (offline) result.
  const activeResult = liveResult ?? precomputed;

  // Codes the expert predicts / extracts. Derive a stable set-intersection from
  // the tour case's correctCodes vs billedCodes (consistent, deterministic) —
  // this is the "what our expert predicted" view. The real retrace detail comes
  // from the precomputed/live code_analyses.
  const billed = tc.billedCodes;
  const correct = tc.correctCodes;
  const correctSet = useMemo(() => new Set(correct.map((c) => c.code)), [correct]);
  const billedSet = useMemo(() => new Set(billed.map((b) => b.code)), [billed]);

  const predicted: { code: string; description: string }[] = useMemo(
    () => [...new Map([...correct, ...billed.filter((b) => !correctSet.has(b.code) && b.fraudulent === false)].map((c) => [c.code, c] as const)).values()],
    [correct, billed, correctSet],
  );
  const predictedSet = useMemo(() => new Set(predicted.map((p) => p.code)), [predicted]);

  const common = useMemo(() => billed.filter((b) => predictedSet.has(b.code)), [billed, predictedSet]);
  const billedOnly = useMemo(() => billed.filter((b) => !predictedSet.has(b.code)), [billed, predictedSet]);
  const expertOnly = useMemo(() => predicted.filter((p) => !billedSet.has(p.code)), [predicted, billedSet]);

  // The set-intersection analyses (retrace) — over-billed codes only.
  const overBilledAnalyses: CodeAnalysis[] = useMemo(() => {
    const all = activeResult?.code_analyses ?? [];
    return all.filter((a) => a.match === "extra" || a.match === "mismatch");
  }, [activeResult]);

  // Judgement verdict (case-level).
  const verdictFraudType: FraudType = useMemo(() => {
    const liveType = liveResult?.findings?.[0]?.fraud_type;
    if (liveType) return liveType;
    // From precomputed finding summary: map the finding.fraudType if present.
    return tc.fraudType;
  }, [liveResult, tc.fraudType]);
  const verdictIntent = useMemo(() => {
    const liveIntent = liveResult?.findings?.[0]?.intent;
    if (liveIntent) return liveIntent;
    return "fraud" as const;
  }, [liveResult]);
  const verdictConfidence = useMemo(() => {
    if (liveResult?.max_confidence) return liveResult.max_confidence;
    if (precomputed?.max_confidence) return precomputed.max_confidence;
    return tc.fraudConfidence;
  }, [liveResult, precomputed, tc.fraudConfidence]);

  const liveConfirmed: string | false = liveResult?.source === "live" ? "staging-eu" : false;
  const detected = activeResult?.detected;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // --- Live agent: fire on mount, non-blocking. Probe armed state too. ---
  useEffect(() => {
    let cancelled = false;
    fetch("/api/run-pipeline")
      .then((r) => r.json())
      .then((d) => !cancelled && setLiveArmed(Boolean(d.live)))
      .catch(() => !cancelled && setLiveArmed(false));
    if (precomputed) {
      // Fire the real full pipeline in the background — never blocks the animation.
      setLiveLoading(true);
      fetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
        .then((r) => r.json())
        .then((d: LiveResult) => {
          if (cancelled) return;
          if (d && !d.error) setLiveResult(d);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLiveLoading(false));
    }
    return () => {
      cancelled = true;
    };
  }, [caseId, precomputed]);

  // --- Phase 1: deterministic reading cascade over the predicted codes ---
  const runPhase1 = useCallback(() => {
    clearTimers();
    setReadingIndex(-1);
    setExtractedCount(0);
    setPhase1Done(false);
    setPlaying(true);
    predicted.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setReadingIndex(i), T.readStartGap + i * T.perCodeRead),
      );
      timers.current.push(
        setTimeout(() => setExtractedCount(i + 1), T.readStartGap + i * T.perCodeRead + T.codeHold),
      );
    });
    timers.current.push(
      setTimeout(() => {
        setPhase1Done(true);
        setPlaying(false);
      }, T.readStartGap + predicted.length * T.perCodeRead + T.phase1DoneBuffer),
    );
  }, [clearTimers, predicted]);

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
        goCompare();
        return;
      }
      setPlaying((p) => !p);
    } else {
      restart();
    }
  }, [phase, phase1Done, goCompare, restart]);

  const pausePhase1 = useCallback(() => {
    clearTimers();
    setPlaying(false);
  }, [clearTimers]);

  // Predicted codes confirmed by the live run (for "confirmed live" badges).
  const liveCodeSet = useMemo(() => {
    const dx = liveResult?.predicted_codes?.dx ?? [];
    const proc = liveResult?.predicted_codes?.procedures ?? [];
    return new Set([...dx.map((d) => d.code), ...proc.map((p) => p.code)]);
  }, [liveResult]);

  return (
    <div className="space-y-4">
      {/* Back link */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ChevronLeft className="h-3.5 w-3.5" /> Live Demos
        </Link>
      </div>

      <DemoHeader
        tc={tc}
        meta={meta}
        phase={phase}
        phase1Done={phase1Done}
        liveArmed={liveArmed}
        liveConfirmed={liveConfirmed}
        liveLoading={liveLoading}
        detected={detected}
        playing={playing}
        onTogglePlay={togglePlay}
        onNext={nextPhase}
        onRestart={restart}
        onPause={pausePhase1}
      />

      <div key={phase} className="tour-step-in">
        {phase === 1 && (
          <Phase1
            tc={tc}
            meta={meta}
            predicted={predicted}
            readingIndex={readingIndex}
            extractedCount={extractedCount}
            phase1Done={phase1Done}
            liveCodeSet={liveCodeSet}
            liveConfirmed={liveConfirmed}
            liveLoading={liveLoading}
            onCompare={goCompare}
          />
        )}
        {phase === 2 && (
          <Phase2
            common={common}
            billedOnly={billedOnly}
            expertOnly={expertOnly}
            liveConfirmed={liveConfirmed}
            liveLoading={liveLoading}
            onInvestigate={goInvestigate}
          />
        )}
        {phase === 3 && (
          <Phase3
            tc={tc}
            meta={meta}
            overBilledAnalyses={overBilledAnalyses}
            verdictFraudType={verdictFraudType}
            verdictIntent={verdictIntent}
            verdictConfidence={verdictConfidence}
            detected={detected}
            legalBrief={activeResult?.legal_brief}
            caseSummary={activeResult?.case_summary}
            liveConfirmed={liveConfirmed}
            liveLoading={liveLoading}
            onRestart={restart}
          />
        )}
      </div>

      {/* Footer exit */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <ScanSearch className="h-4 w-4 text-[var(--muted-2)]" />
            {liveConfirmed
              ? "Real Corti pipeline — live coding-expert run confirmed."
              : liveLoading
                ? "Real pipeline running in the background…"
                : "Precomputed from a real pipeline run — same case, same findings."}
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
// Header + controls
// ---------------------------------------------------------------------------

const PHASES = [
  { id: 1, label: "Extract", icon: Sparkles },
  { id: 2, label: "Compare", icon: ScanSearch },
  { id: 3, label: "Investigate", icon: Gavel },
] as const;

function DemoHeader({
  tc,
  meta,
  phase,
  phase1Done,
  liveArmed,
  liveConfirmed,
  liveLoading,
  detected,
  playing,
  onTogglePlay,
  onNext,
  onRestart,
  onPause,
}: {
  tc: ReturnType<typeof getTourCase> & NonNullable<ReturnType<typeof getTourCase>>;
  meta: (typeof FRAUD_META)[FraudType];
  phase: 1 | 2 | 3;
  phase1Done: boolean;
  liveArmed: boolean;
  liveConfirmed: string | false;
  liveLoading: boolean;
  detected: boolean | undefined;
  playing: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onRestart: () => void;
  onPause: () => void;
}) {
  const Icon = meta.icon;
  const canNext = (phase === 1 && phase1Done) || phase === 2;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{ background: meta.soft, color: meta.color }}
            >
              <ScanSearch className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-[var(--foreground)]">Live Demo</span>
            <span className="font-mono text-xs">· {tc.caseId}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{tc.teaser}</h1>
        </div>
        <div className="flex items-center gap-2">
          <FraudChip type={tc.fraudType} />
          {detected !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                detected
                  ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                  : "border-[var(--risk-med)]/30 bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
              )}
              title={detected ? "Detector independently arrived at the planted fraud type" : "Fraud caught — category differs from the planted label"}
            >
              <ShieldCheck className="h-3 w-3" />
              {detected ? "Detector matched" : "Fraud caught"}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
              liveConfirmed
                ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                : liveLoading
                  ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                liveConfirmed ? "bg-[var(--risk-low)]" : liveLoading ? "bg-[var(--accent)] animate-pulse-soft" : "bg-[var(--muted-2)]",
              )}
            />
            {liveConfirmed ? `Live · ${liveConfirmed}` : liveLoading ? "Running…" : liveArmed ? "Armed" : "Replay"}
          </span>
        </div>
      </div>

      {/* Phase indicator + controls */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {PHASES.map((p) => {
              const PIcon = p.icon;
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
                      {done ? <Check className="h-3 w-3" /> : <PIcon className="h-3 w-3" />}
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
// Phase 1 — Reading the note + extracting codes
// ---------------------------------------------------------------------------

function Phase1({
  tc,
  meta,
  predicted,
  readingIndex,
  extractedCount,
  phase1Done,
  liveCodeSet,
  liveConfirmed,
  liveLoading,
  onCompare,
}: {
  tc: ReturnType<typeof getTourCase> & NonNullable<ReturnType<typeof getTourCase>>;
  meta: (typeof FRAUD_META)[FraudType];
  predicted: { code: string; description: string }[];
  readingIndex: number;
  extractedCount: number;
  phase1Done: boolean;
  liveCodeSet: Set<string>;
  liveConfirmed: string | false;
  liveLoading: boolean;
  onCompare: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
      {/* Left: clinical note */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Clinical note"
          subtitle={
            phase1Done
              ? "The coding expert has finished reading the note."
              : "The coding expert is reading the note — watch the codes extract."
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
            {tc.noteText}
          </p>
        </div>
      </Card>

      {/* Right: extracted codes panel */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Extracted codes"
            subtitle="What our coding expert predicts from the note."
            right={
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                <Sparkles className="h-3 w-3" /> {extractedCount}/{predicted.length}
              </span>
            }
          />
          <div className="space-y-2.5 p-4">
            {readingIndex >= 0 && extractedCount <= readingIndex && (
              <div className="flex items-center gap-1 px-1 pb-1">
                <span className="cd-connector-draw h-0.5 w-10 rounded-full bg-[var(--accent)]" />
                <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="text-[11px] font-medium text-[var(--accent)]">extracting…</span>
              </div>
            )}
            {predicted.slice(0, extractedCount).map((e) => {
              const liveHit = liveCodeSet.has(e.code);
              return (
                <div key={e.code} className="cd-extract-pop">
                  <ExtractedCodeCard
                    code={e.code}
                    desc={e.description}
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
                The expert extracted <span className="font-semibold">{predicted.length} code{predicted.length === 1 ? "" : "s"}</span> from the
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
  liveHit,
  liveConfirmed,
}: {
  code: string;
  desc: string;
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 — Predict & compare (set-intersection)
// ---------------------------------------------------------------------------

interface BucketCode {
  code: string;
  desc: string;
}

function Phase2({
  common,
  billedOnly,
  expertOnly,
  liveConfirmed,
  liveLoading,
  onInvestigate,
}: {
  common: { code: string; description: string }[];
  billedOnly: { code: string; description: string }[];
  expertOnly: { code: string; description: string }[];
  liveConfirmed: string | false;
  liveLoading: boolean;
  onInvestigate: () => void;
}) {
  const commonB: BucketCode[] = useMemo(() => common.map((c) => ({ code: c.code, desc: c.description })), [common]);
  const billedOnlyB: BucketCode[] = useMemo(() => billedOnly.map((c) => ({ code: c.code, desc: c.description })), [billedOnly]);
  const expertOnlyB: BucketCode[] = useMemo(() => expertOnly.map((c) => ({ code: c.code, desc: c.description })), [expertOnly]);

  const [bucketsShown, setBucketsShown] = useState(0);
  const [commonCount, setCommonCount] = useState(0);
  const [expertCount, setExpertCount] = useState(0);
  const [billedOnlyCount, setBilledOnlyCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setBucketsShown(1), 250));
    t.push(setTimeout(() => setBucketsShown(2), 250 + T.bucketStagger));
    t.push(setTimeout(() => setBucketsShown(3), 250 + T.bucketStagger * 2));
    commonB.forEach((_, i) =>
      t.push(setTimeout(() => setCommonCount(i + 1), 250 + T.bucketStagger * 2 + 300 + i * T.codeSlideGap)),
    );
    expertOnlyB.forEach((_, i) =>
      t.push(setTimeout(() => setExpertCount(i + 1), 250 + T.bucketStagger * 2 + 300 + commonB.length * T.codeSlideGap + i * T.codeSlideGap)),
    );
    billedOnlyB.forEach((_, i) =>
      t.push(
        setTimeout(
          () => setBilledOnlyCount(i + 1),
          250 + T.bucketStagger * 2 + 300 + (commonB.length + expertOnlyB.length) * T.codeSlideGap + i * T.codeSlideGap,
        ),
      ),
    );
    t.push(
      setTimeout(
        () => setDone(true),
        250 + T.bucketStagger * 2 + 300 + (commonB.length + expertOnlyB.length + billedOnlyB.length) * T.codeSlideGap + 400,
      ),
    );
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
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
          <Bucket
            title="Common"
            caption="On both — grounded"
            tone="good"
            shown={bucketsShown >= 1}
            codes={commonB.slice(0, commonCount)}
            total={commonB.length}
            empty="None in common."
          />
          <Bucket
            title="Expert only"
            caption="Predicted, not billed"
            tone="neutral"
            shown={bucketsShown >= 2}
            codes={expertOnlyB.slice(0, expertCount)}
            total={expertOnlyB.length}
            empty="None — the expert didn't add anything."
          />
          <Bucket
            title="Billed only"
            caption="Billed, not predicted — investigate"
            tone="bad"
            shown={bucketsShown >= 3}
            codes={billedOnlyB.slice(0, billedOnlyCount)}
            total={billedOnlyB.length}
          />
        </div>
      </Card>

      {done && (
        <Card className="animate-fade-rise px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--foreground)]">
              {billedOnly.length > 0 ? (
                <>
                  <span className="font-semibold text-[var(--risk-high)]">{billedOnly.map((b) => b.code).join(", ")}</span>{" "}
                  {billedOnly.length === 1 ? "was billed" : "were billed"} but our coding expert found nothing to support{" "}
                  {billedOnly.length === 1 ? "it" : "them"}. That&apos;s {billedOnly.length === 1 ? "a discrepancy" : "discrepancies"} worth investigating.
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
      className="tour-slide-over rounded-lg border p-3"
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
// Phase 3 — Investigate the gaps (retrace + judgement + legal brief)
// ---------------------------------------------------------------------------

function Phase3({
  tc,
  meta,
  overBilledAnalyses,
  verdictFraudType,
  verdictIntent,
  verdictConfidence,
  detected,
  legalBrief,
  caseSummary,
  liveConfirmed,
  liveLoading,
  onRestart,
}: {
  tc: ReturnType<typeof getTourCase> & NonNullable<ReturnType<typeof getTourCase>>;
  meta: (typeof FRAUD_META)[FraudType];
  overBilledAnalyses: CodeAnalysis[];
  verdictFraudType: FraudType;
  verdictIntent: "fraud" | "error" | "clean";
  verdictConfidence: number;
  detected: boolean | undefined;
  legalBrief: string | undefined;
  caseSummary: string | undefined;
  liveConfirmed: string | false;
  liveLoading: boolean;
  onRestart: () => void;
}) {
  const [stage, setStage] = useState(0); // 0: starting, 1: retracing, 2: verdict, 3: brief
  const [retraceShown, setRetraceShown] = useState(0);
  const [showVerdict, setShowVerdict] = useState(false);
  const [showBrief, setShowBrief] = useState(false);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    if (overBilledAnalyses.length === 0) {
      t.push(setTimeout(() => setStage(2), 400));
      t.push(setTimeout(() => setShowVerdict(true), 400 + T.verdictDelay));
      t.push(setTimeout(() => setShowBrief(true), 400 + T.verdictDelay + T.briefDelay));
      return () => t.forEach(clearTimeout);
    }
    t.push(setTimeout(() => setStage(1), 300));
    overBilledAnalyses.forEach((_, i) =>
      t.push(setTimeout(() => setRetraceShown(i + 1), 300 + i * T.retraceGap)),
    );
    const retraceDone = 300 + overBilledAnalyses.length * T.retraceGap;
    t.push(setTimeout(() => setStage(2), retraceDone + 200));
    t.push(setTimeout(() => setShowVerdict(true), retraceDone + 200 + T.verdictDelay));
    t.push(setTimeout(() => setShowBrief(true), retraceDone + 200 + T.verdictDelay + T.briefDelay));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* Retrace — per over-billed code */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Retrace — the agentic framework investigates each over-billed code"
          subtitle="For each code the expert didn't predict, the retrace agent rates agreeability + grounding and cites the note."
          right={
            stage < 2 ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                <ScanSearch className="h-3 w-3 animate-pulse-soft" /> retracing…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--risk-low)]">
                <Check className="h-3 w-3" /> retraced
              </span>
            )
          }
        />
        <div className="space-y-3 p-4">
          {overBilledAnalyses.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-6 text-center text-sm text-[var(--muted)]">
              No over-billed codes to retrace — the bill aligns with the note.
            </div>
          )}
          {overBilledAnalyses.slice(0, retraceShown).map((a, i) => (
            <RetraceCard key={`${a.code}-${i}`} analysis={a} liveConfirmed={liveConfirmed} />
          ))}
          {stage < 2 && retraceShown < overBilledAnalyses.length && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Investigating next code…
            </div>
          )}
        </div>
      </Card>

      {/* Judgement verdict */}
      {showVerdict && (
        <Card className="animate-fade-rise overflow-hidden">
          <CardHeader
            title="Judgement — the case verdict"
            subtitle="The judgement agent aggregates the retrace into a category + fraud-vs-error + confidence."
            right={<Gavel className="h-4 w-4 text-[var(--accent)]" />}
          />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <FraudChip type={verdictFraudType} />
              <IntentBadge intent={verdictIntent} />
              <span className="ml-auto text-xs text-[var(--muted-2)]">
                Confidence <span className="font-semibold text-[var(--foreground)]">{formatPct(verdictConfidence)}</span>
              </span>
              {detected !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    detected
                      ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                      : "bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
                  )}
                  title={detected ? "Detector independently arrived at the planted fraud type" : "Fraud caught — category differs from the planted label"}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {detected ? "Detector matched" : "Fraud caught"}
                </span>
              )}
            </div>

            {caseSummary && (
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{caseSummary}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <VerdictFact icon={Gavel} label="Fraud type" value={meta.label} />
              <VerdictFact
                icon={FlaskConical}
                label="Intent"
                value={verdictIntent === "fraud" ? "Likely Fraud" : verdictIntent === "error" ? "Possible Error" : "Clean"}
              />
              <VerdictFact icon={Receipt} label="Projected impact" value={formatUSD(tc.fraudConfidence > 0 ? 10125 : 0, true)} money />
              <VerdictFact icon={ShieldCheck} label="Evidence" value={overBilledAnalyses.length > 0 ? `${overBilledAnalyses.length} code${overBilledAnalyses.length === 1 ? "" : "s"} flagged` : "Aligned"} />
            </div>
          </div>
        </Card>
      )}

      {/* Legal / referral brief */}
      {showBrief && legalBrief && (
        <Card className="surface-sober animate-fade-rise overflow-hidden">
          <CardHeader
            title="Case referral brief"
            subtitle="Generated by textgen (Guided Docs) from the detector findings — preliminary, not a determination"
            right={
              liveConfirmed ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-low)]">
                  <Check className="h-3 w-3" /> confirmed live · {liveConfirmed}
                </span>
              ) : (
                <Scale className="h-4 w-4 text-[var(--accent)]" />
              )
            }
          />
          <div className="print-sober px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--surface-sober-ink)]">{legalBrief}</p>
            <p className="mt-4 border-t border-[var(--border-sober)] pt-3 text-[11px] italic leading-snug text-[var(--muted-2)]">
              This AI-generated analysis is a preliminary investigation assessment and does not constitute a legal
              conclusion or a determination of fraud. Mere coding discrepancies do not establish a violation.
            </p>
            <button
              onClick={() => window.print()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-sober)] bg-[var(--surface-sober-2)] px-3 py-1.5 text-xs font-medium text-[var(--surface-sober-ink)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <FileText className="h-3.5 w-3.5" /> Print / save as PDF
            </button>
          </div>
        </Card>
      )}

      {/* Actions */}
      {showBrief && (
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
      )}
    </div>
  );
}

function RetraceCard({
  analysis,
  liveConfirmed,
}: {
  analysis: CodeAnalysis;
  liveConfirmed: string | false;
}) {
  const groundingLabel = analysis.grounding === "supported"
    ? "Supported"
    : analysis.grounding === "weakly_supported"
      ? "Weakly supported"
      : analysis.grounding === "contradicted"
        ? "Contradicted"
        : "Unsupported";
  const groundingTone =
    analysis.grounding === "supported"
      ? "var(--risk-low)"
      : analysis.grounding === "weakly_supported"
        ? "var(--risk-med)"
        : "var(--risk-high)";
  const agreeabilityPct = Math.round(analysis.agreeability);
  return (
    <div className="cd-contradiction-flash rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--risk-high-soft)] text-[var(--risk-high)]">
            <X className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[var(--foreground)]">{analysis.code}</span>
              {liveConfirmed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--risk-low-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
                  <Check className="h-2.5 w-2.5" /> confirmed live · {liveConfirmed}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">{analysis.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: `${groundingTone}22`, color: groundingTone }}
          >
            {groundingLabel}
          </span>
        </div>
      </div>

      {/* Agreeability bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted-2)]">Agreeability (0 = likely fraud, 100 = minor miss)</span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{agreeabilityPct}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${agreeabilityPct}%`, background: groundingTone }}
          />
        </div>
      </div>

      {/* Rationale */}
      {analysis.rationale && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--surface-2)]/60 px-3 py-2">
          <BrainCircuit className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
          <p className="text-xs leading-relaxed text-[var(--foreground)]">{analysis.rationale}</p>
        </div>
      )}

      {/* Note excerpts */}
      {analysis.noteExcerpts.length > 0 && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
            Grounding — note excerpts cited by the retrace agent
          </p>
          <ul className="space-y-1.5">
            {analysis.noteExcerpts.slice(0, 4).map((ex, i) => (
              <li key={i} className="text-xs italic leading-snug text-[var(--muted)]">
                “{ex}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
