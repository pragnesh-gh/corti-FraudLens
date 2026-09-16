"use client";

/**
 * LivePipelineRunner — runs the FULL Corti pipeline (predict → compare →
 * retrace → judgement → legal brief) on a note + billed codes, streaming
 * progress through the stages, then renders the real live results.
 *
 * Used by the "Live Demos" hub. Calls POST /api/run-pipeline. Falls back to a
 * clear error if live isn't armed. Pure React/CSS — no multimodal, no new deps.
 */

import { useEffect, useState } from "react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card, CardHeader, CodeComparisonTable, FraudChip } from "@/components/ui";
import type { CodeComparisonRow } from "@/components/ui";
import { PipelineStepper } from "@/components/ui";
import type { StepperStep } from "@/components/ui";
import type { CaseResult, CodeAnalysis } from "@/lib/types";
import { getTourCase, TOUR_CASES } from "@/lib/tour-cases";
import { FRAUD_META } from "@/lib/fraud-meta";
import {
  Play,
  Loader2,
  Zap,
  FileText,
  BrainCircuit,
  RotateCcw,
  Scale,
  Gavel,
  ScanSearch,
} from "lucide-react";

const PIPELINE_STAGES = [
  { id: "facts", label: "Extract clinical facts", icon: FileText },
  { id: "coding", label: "Predict medical codes", icon: Zap },
  { id: "retrace", label: "Retrace unmatched codes", icon: ScanSearch },
  { id: "judgement", label: "Judge fraud vs error", icon: Gavel },
  { id: "brief", label: "Draft legal brief", icon: Scale },
];

type RunState = "idle" | "running" | "done" | "error";

export function LivePipelineRunner({ caseId }: { caseId: string }) {
  const tc = getTourCase(caseId) ?? TOUR_CASES[0];
  const [state, setState] = useState<RunState>("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const [result, setResult] = useState<CaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveArmed, setLiveArmed] = useState(false);

  // Check whether the live path is armed.
  useEffect(() => {
    fetch("/api/run-pipeline")
      .then((r) => r.json())
      .then((d) => setLiveArmed(Boolean(d.live)))
      .catch(() => setLiveArmed(false));
  }, []);

  // Reset when the case changes.
  useEffect(() => {
    setState("idle");
    setStageIdx(0);
    setResult(null);
    setError(null);
  }, [caseId]);

  async function run() {
    setState("running");
    setResult(null);
    setError(null);
    setStageIdx(0);
    // Stream the stepper with realistic pacing while the pipeline runs.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = (i: number) => {
      if (i < PIPELINE_STAGES.length) {
        setStageIdx(i + 1);
        // pace ~3.5s per stage; the real call is usually slower, so we
        // hold on the last stage until the response lands.
        if (i < PIPELINE_STAGES.length - 1) timers.push(setTimeout(() => advance(i + 1), 3500));
      }
    };
    advance(0);
    try {
      const res = await fetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = (await res.json()) as CaseResult | { error: string };
      timers.forEach(clearTimeout);
      if ("error" in data && data.error) {
        setState("error");
        setError(data.error);
        setStageIdx(PIPELINE_STAGES.length);
      } else {
        setResult(data as CaseResult);
        setState("done");
        setStageIdx(PIPELINE_STAGES.length);
      }
    } catch (e) {
      timers.forEach(clearTimeout);
      setState("error");
      setError((e as Error).message?.slice(0, 200) ?? "Request failed.");
      setStageIdx(PIPELINE_STAGES.length);
    }
  }

  // Build stepper steps from state.
  const steps: StepperStep[] = PIPELINE_STAGES.map((s, i) => {
    let status: "pending" | "running" | "completed" | "error" = "pending";
    if (state === "running" && i < stageIdx) status = "completed";
    else if (state === "running" && i === stageIdx) status = "running";
    else if (state === "done") status = "completed";
    else if (state === "error" && i === stageIdx - 1) status = "error";
    else if (state === "error" && i < stageIdx - 1) status = "completed";
    return { id: s.id, label: s.label, status };
  });

  const meta = FRAUD_META[tc.fraudType];

  return (
    <Card className="overflow-hidden border-[var(--accent)]/25">
      <CardHeader
        title="Run the full pipeline live"
        subtitle={`Real Corti agents on ${tc.caseId} — predict, retrace, judge, and draft a brief. ~10-30s.`}
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
            {liveArmed ? "Live armed" : "Live not armed"}
          </span>
        }
      />

      <div className="space-y-4 p-5">
        {/* The case summary */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="flex items-center gap-2">
            <FraudChip type={tc.fraudType} />
            <span className="font-mono text-xs text-[var(--muted)]">{tc.caseId}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] line-clamp-3">{tc.noteText}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tc.billedCodes.map((b) => (
              <span
                key={b.code}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                  b.fraudulent ? "bg-[var(--risk-high-soft)] text-[var(--risk-high)]" : "bg-[var(--surface)] text-[var(--muted)]",
                )}
              >
                {b.code}
              </span>
            ))}
          </div>
        </div>

        {/* Run button */}
        {state === "idle" && (
          <button
            onClick={run}
            disabled={!liveArmed}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {liveArmed ? "Run the live pipeline" : "Live not armed — enable FRAUDLENS_LIVE=1"}
          </button>
        )}

        {/* Streaming stepper */}
        {(state === "running" || state === "done" || state === "error") && (
          <PipelineStepper steps={steps} />
        )}

        {/* Error */}
        {state === "error" && error && (
          <div className="rounded-lg border border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/40 px-4 py-3 text-sm text-[var(--risk-high)]">
            <p className="font-semibold">Live run failed</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={() => {
                setState("idle");
                setStageIdx(0);
                setError(null);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Try again
            </button>
          </div>
        )}

        {/* Results */}
        {state === "done" && result && <LiveResults result={result} />}
      </div>
    </Card>
  );
}

/** Render the live pipeline results — verdict, code analysis, legal brief. */
function LiveResults({ result }: { result: CaseResult }) {
  const verdictFinding = result.findings[0];
  const caseVerdict = verdictFinding?.analysis?.verdict;
  const caseCategory = verdictFinding?.fraud_type;

  const comparisonRows: CodeComparisonRow[] = (result.code_analyses ?? []).map((a: CodeAnalysis) => ({
    code: a.code,
    description: a.description,
    match:
      a.match === "exact"
        ? "matched"
        : a.match === "extra"
          ? "over-billed"
          : a.match === "missing"
            ? "under-billed"
            : "over-billed",
    agreeability: a.match !== "exact" ? a.agreeability : undefined,
    evidence: a.match !== "exact" ? a.grounding : undefined,
  }));

  return (
    <div className="animate-fade-rise space-y-4">
      {/* Source + honesty badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-low)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk-low)]" /> Live · {result.source}
        </span>
        {typeof result.detected === "boolean" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              result.detected
                ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                : "bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
            )}
          >
            {result.detected ? "Detector matched planted fraud" : "Fraud caught, different category"}
          </span>
        )}
      </div>

      {/* Detector verdict */}
      {verdictFinding && (
        <div className="glass rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Gavel className="h-4 w-4 text-[var(--accent)]" /> Detector verdict
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FraudChip type={caseCategory ?? "upcoding"} />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                caseVerdict === "fraud"
                  ? "bg-[var(--risk-high-soft)] text-[var(--risk-high)]"
                  : caseVerdict === "error"
                    ? "bg-[var(--risk-med-soft)] text-[var(--risk-med)]"
                    : "bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
              )}
            >
              {caseVerdict === "fraud" ? "Likely fraud" : caseVerdict === "error" ? "Possible error" : "Clean"}
            </span>
            <span className="ml-auto text-xs text-[var(--muted-2)]">
              Confidence <span className="font-semibold text-[var(--foreground)]">{formatPct(verdictFinding.confidence)}</span>
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{verdictFinding.rationale}</p>
          {verdictFinding.analysis && verdictFinding.analysis.noteExcerpts.length > 0 && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                Grounding — note excerpts cited by the retrace agent
              </p>
              <ul className="space-y-1.5">
                {verdictFinding.analysis.noteExcerpts.slice(0, 4).map((ex, i) => (
                  <li key={i} className="text-xs italic leading-snug text-[var(--muted)]">
                    “{ex}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Code analysis */}
      {comparisonRows.length > 0 && (
        <div className="glass rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ScanSearch className="h-4 w-4 text-[var(--accent)]" /> Code analysis
          </div>
          <div className="mt-3">
            <CodeComparisonTable rows={comparisonRows} />
          </div>
        </div>
      )}

      {/* Economic impact */}
      {result.total_impact > 0 && (
        <div className="glass rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Zap className="h-4 w-4 text-[var(--risk-high)]" /> Economic impact
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--risk-high)]">{formatUSD(result.total_impact, true)}</p>
        </div>
      )}

      {/* Legal brief */}
      {result.legal_brief && (
        <div className="surface-sober glass rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Scale className="h-4 w-4 text-[var(--accent)]" /> Legal brief
          </div>
          <div className="print-sober mt-2">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{result.legal_brief}</p>
            <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] italic leading-snug text-[var(--muted-2)]">
              Preliminary assessment, not a determination of fraud. AI-generated analysis does not constitute a legal conclusion.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
