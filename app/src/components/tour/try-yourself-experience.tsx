"use client";

/**
 * TryYourselfExperience — `/tour/try`.
 *
 * A hands-on playground where the viewer supplies their OWN clinical note (no
 * template), optionally adds billed codes, and runs the real FraudLens pipeline
 * on it — going forward through the same Run → Compare → Investigate tabs as the
 * live demo, but on custom input.
 *
 *   Run tab       — enter the note (+ optional billed codes), click Run.
 *   Compare tab   — the set-intersection (Common / Over-billed / Under-billed)
 *                   from the full pipeline (only available with billed codes).
 *   Investigate tab — per-code retrace (agreeability/grounding/excerpts), the
 *                     verdict, and the legal brief (built via buildLegalBrief +
 *                     LegalBriefView, same wiring as the tour).
 *
 * Click-driven: nothing runs until the user clicks. The run fires the real
 * pipeline (`/api/run-pipeline` when billed codes are provided — full output;
 * `/api/coding-expert` for a prediction-only run when no billed codes are given).
 * Pure React/CSS — no multimodal, no new deps.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card, CardHeader, FraudChip, IntentBadge } from "@/components/ui";
import { buildLegalBrief, findingFromResult } from "@/lib/legal-brief";
import { LegalBriefView } from "@/components/legal-brief-view";
import type { CaseResult, CodeAnalysis } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  Check,
  X,
  ScanSearch,
  Gavel,
  Scale,
  FileText,
  Sparkles,
  Receipt,
  RotateCcw,
  Plus,
  BrainCircuit,
  ShieldCheck,
} from "lucide-react";

type Tab = "run" | "compare" | "investigate";

const TABS: { id: Tab; label: string; icon: typeof Play }[] = [
  { id: "run", label: "Run", icon: Play },
  { id: "compare", label: "Compare", icon: ScanSearch },
  { id: "investigate", label: "Investigate", icon: Gavel },
];

/** Prediction-only result (no billed codes) from /api/coding-expert. */
interface CodingResult {
  source: "live" | "replay";
  region?: string;
  predictedCodes: { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] };
  error?: string;
}

type RunResult =
  | { kind: "full"; result: CaseResult }
  | { kind: "prediction"; result: CodingResult };

const SAMPLE_NOTE = `CC: Cough x 3 weeks.

History: 54yo female presents with productive cough for 3 weeks, worse at night. Denies fever, hemoptysis, chest pain, or dyspnea. No prior similar episodes. Non-smoker.

Exam: BP 118/76, HR 80, afebrile. Lungs with scattered rhonchi, clears with cough, no wheezes or crackles. No accessory muscle use.

Assessment/Plan:
1. Acute bronchitis — supportive care, return precautions.
2. Continue routine hypertension medications.`;

export function TryYourselfExperience() {
  const [tab, setTab] = useState<Tab>("run");
  const [note, setNote] = useState("");
  // Optional billed codes the user can add.
  const [billedCodes, setBilledCodes] = useState<{ code: string; description: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [liveArmed, setLiveArmed] = useState(false);
  // Investigate sub-stages (click-gated).
  const [invStage, setInvStage] = useState(0);

  // Probe live-armed once on mount (no POST). The run itself is click-driven.
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

  const hasBilled = billedCodes.length > 0;

  const run = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setRunning(true);
    setRunResult(null);
    try {
      if (hasBilled) {
        // Full pipeline → compare + investigate output.
        const res = await fetch("/api/run-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: trimmed, billedCodes }),
        });
        const data = (await res.json()) as CaseResult & { error?: string };
        if (data.error) {
          setRunResult({ kind: "prediction", result: { source: "replay", predictedCodes: { dx: [], procedures: [] }, error: data.error } });
        } else {
          setRunResult({ kind: "full", result: data });
        }
      } else {
        // Prediction only.
        const res = await fetch("/api/coding-expert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: trimmed }),
        });
        const data = (await res.json()) as CodingResult;
        setRunResult({ kind: "prediction", result: data });
      }
    } catch {
      setRunResult({
        kind: "prediction",
        result: { source: "replay", predictedCodes: { dx: [], procedures: [] }, error: "Request failed." },
      });
    } finally {
      setRunning(false);
      setHasRun(true);
      setInvStage(0);
    }
  }, [note, billedCodes, hasBilled]);

  const restart = useCallback(() => {
    setTab("run");
    setRunResult(null);
    setHasRun(false);
    setInvStage(0);
  }, []);

  const goCompare = useCallback(() => setTab("compare"), []);
  const goInvestigate = useCallback(() => setTab("investigate"), []);

  const canCompare = hasRun && runResult !== null;
  const canInvestigate = hasRun && runResult?.kind === "full";

  return (
    <div className="space-y-4">
      {/* Back link */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ChevronLeft className="h-3.5 w-3.5" /> Live Demos
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-[var(--foreground)]">Try for yourself</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Run the pipeline on your own clinical note</h1>
          <p className="text-sm text-[var(--muted)]">
            Paste a note, optionally add the billed codes, and run. Add billed codes to get the full compare + legal brief.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            liveArmed
              ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", liveArmed ? "bg-[var(--risk-low)]" : "bg-[var(--muted-2)]")} />
          {liveArmed ? "Live armed" : "Replay / not armed"}
        </span>
      </div>

      {/* Tab indicator — click to jump (no auto-advance). */}
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const done =
                (t.id === "run" && (tab === "compare" || tab === "investigate")) ||
                (t.id === "compare" && tab === "investigate");
              const disabled = (t.id === "compare" && !canCompare) || (t.id === "investigate" && !canInvestigate);
              return (
                <div key={t.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => !disabled && setTab(t.id)}
                    disabled={disabled}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : disabled
                          ? "text-[var(--muted-2)] opacity-50 cursor-not-allowed"
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
          <button
            onClick={restart}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </Card>

      <div key={tab} className="tour-step-in">
        {tab === "run" && (
          <RunTab
            note={note}
            setNote={setNote}
            billedCodes={billedCodes}
            setBilledCodes={setBilledCodes}
            running={running}
            onRun={run}
            runResult={runResult}
            onCompare={goCompare}
          />
        )}
        {tab === "compare" && runResult?.kind === "full" && (
          <CompareTab result={runResult.result} onInvestigate={goInvestigate} />
        )}
        {tab === "investigate" && runResult?.kind === "full" && (
          <InvestigateTab
            result={runResult.result}
            note={note}
            billedCodes={billedCodes}
            stage={invStage}
            setStage={setInvStage}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run tab — note input + optional billed codes + Run button + prediction.
// ---------------------------------------------------------------------------

function RunTab({
  note,
  setNote,
  billedCodes,
  setBilledCodes,
  running,
  onRun,
  runResult,
  onCompare,
}: {
  note: string;
  setNote: (v: string) => void;
  billedCodes: { code: string; description: string }[];
  setBilledCodes: (v: { code: string; description: string }[]) => void;
  running: boolean;
  onRun: () => void;
  runResult: RunResult | null;
  onCompare: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Clinical note */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Clinical note"
          subtitle="Paste your own encounter documentation."
          right={
            <button
              onClick={() => setNote(SAMPLE_NOTE)}
              className="text-[11px] font-medium text-[var(--accent)] hover:underline"
            >
              Load a sample
            </button>
          }
        />
        <div className="p-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={running}
            rows={9}
            placeholder="Paste a clinical note here… (e.g. CC, history, exam, assessment/plan)"
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface)] disabled:opacity-60"
          />
        </div>
      </Card>

      {/* Optional billed codes */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Billed codes (optional)"
          subtitle="Add what the provider submitted to run the full compare + legal brief. Skip to get a prediction only."
        />
        <div className="space-y-2 p-4">
          {billedCodes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={c.code}
                onChange={(e) => {
                  const next = [...billedCodes];
                  next[i] = { ...c, code: e.target.value };
                  setBilledCodes(next);
                }}
                disabled={running}
                placeholder="Code (e.g. J20.9)"
                className="w-32 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 font-mono text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
              <input
                value={c.description}
                onChange={(e) => {
                  const next = [...billedCodes];
                  next[i] = { ...c, description: e.target.value };
                  setBilledCodes(next);
                }}
                disabled={running}
                placeholder="Description"
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => setBilledCodes(billedCodes.filter((_, j) => j !== i))}
                disabled={running}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:text-[var(--risk-high)]"
                aria-label="Remove code"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setBilledCodes([...billedCodes, { code: "", description: "" }])}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add a billed code
          </button>
        </div>
      </Card>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={running || !note.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "Running…" : billedCodes.length > 0 ? "Run the full pipeline" : "Run the coding-expert"}
      </button>

      {/* Result */}
      {runResult && !running && (
        <div className="animate-fade-rise space-y-3">
          <RunResultView result={runResult} />
          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--foreground)]">
                {runResult.kind === "full"
                  ? "The pipeline finished. Compare what the expert predicted against the billed codes."
                  : "Prediction ready. Add billed codes and run again to get the full compare + legal brief."}
              </p>
              {runResult.kind === "full" && (
                <button
                  onClick={onCompare}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <ScanSearch className="h-3.5 w-3.5" /> Compare with the bill
                </button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function RunResultView({ result }: { result: RunResult }) {
  if (result.kind === "prediction") {
    const r = result.result;
    if (r.error) {
      return (
        <Card className="px-4 py-3">
          <p className="text-sm text-[var(--risk-med)]">{r.error}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Live may not be armed (FRAUDLENS_LIVE=0) or credentials are missing. The prediction-only run needs live armed.
          </p>
        </Card>
      );
    }
    const predicted = [...(r.predictedCodes.dx ?? []), ...(r.predictedCodes.procedures ?? [])];
    return (
      <Card className="overflow-hidden">
        <CardHeader
          title="Coding-expert prediction"
          subtitle="What the note supports — the agent's codes."
          right={
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                r.source === "live" ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]" : "bg-[var(--surface)] text-[var(--muted)]",
              )}
            >
              {r.source === "live" ? `Live · ${r.region ?? "?"}` : "Replay"}
            </span>
          }
        />
        <div className="p-4">
          {predicted.length === 0 ? (
            <p className="text-sm text-[var(--muted-2)]">No codes returned.</p>
          ) : (
            <div className="space-y-1.5">
              {predicted.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--foreground)]">{c.code}</span>
                  <span className="text-xs text-[var(--muted)]">{c.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }
  // Full pipeline — show predicted codes + a note that compare/investigate are ready.
  const result0 = result.result;
  const predicted = [...(result0.predicted_codes.dx ?? []), ...(result0.predicted_codes.procedures ?? [])];
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Pipeline result"
        subtitle="Coding-expert prediction from your note."
        right={
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              result0.source === "live" ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]" : "bg-[var(--surface)] text-[var(--muted)]",
            )}
          >
            {result0.source === "live" ? "Live" : "Replay"}
          </span>
        }
      />
      <div className="p-4">
        {predicted.length === 0 ? (
          <p className="text-sm text-[var(--muted-2)]">No codes predicted.</p>
        ) : (
          <div className="space-y-1.5">
            {predicted.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                <span className="font-mono text-xs font-bold text-[var(--foreground)]">{c.code}</span>
                <span className="text-xs text-[var(--muted)]">{c.description}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--muted)]">
          {result0.findings.length > 0
            ? `${result0.findings.length} finding(s) flagged · ${formatUSD(result0.total_impact, true)} projected impact.`
            : "No anomalies — the bill aligns with the note."}
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Compare tab — set-intersection (needs a full pipeline result).
// ---------------------------------------------------------------------------

function CompareTab({
  result,
  onInvestigate,
}: {
  result: CaseResult;
  onInvestigate: () => void;
}) {
  const analyses = result.code_analyses ?? [];
  const matched = analyses.filter((a) => a.match === "exact");
  const overBilled = analyses.filter((a) => a.match === "extra" || a.match === "mismatch");
  const underBilled = analyses.filter((a) => a.match === "missing");

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Compare with the bill"
          subtitle="Billed vs what the coding-expert predicted."
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              <ScanSearch className="h-3 w-3" /> diff
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          <Bucket title="Common" caption="On both — grounded" tone="good" codes={matched} />
          <Bucket title="Over-billed" caption="Billed, not predicted — investigate" tone="bad" codes={overBilled} />
          <Bucket title="Under-billed" caption="Predicted, not billed" tone="neutral" codes={underBilled} />
        </div>
      </Card>
      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--foreground)]">
            {overBilled.length > 0
              ? `${overBilled.length} code(s) billed but not predicted — investigate the gaps.`
              : "No over-billed codes — the bill aligns with the note."}
          </p>
          <button
            onClick={onInvestigate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Gavel className="h-3.5 w-3.5" /> Investigate
          </button>
        </div>
      </Card>
    </div>
  );
}

function Bucket({
  title,
  caption,
  tone,
  codes,
}: {
  title: string;
  caption: string;
  tone: "good" | "bad" | "neutral";
  codes: CodeAnalysis[];
}) {
  const toneStyles =
    tone === "good"
      ? { color: "var(--risk-low)", soft: "var(--risk-low-soft)", icon: Check }
      : tone === "bad"
        ? { color: "var(--risk-high)", soft: "var(--risk-high-soft)", icon: X }
        : { color: "var(--accent)", soft: "var(--accent-soft)", icon: Sparkles };
  const Icon = toneStyles.icon;
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: `${toneStyles.color}40`, background: toneStyles.soft }}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface)]" style={{ color: toneStyles.color }}>
          <Icon className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div>
          <div className="text-xs font-semibold" style={{ color: toneStyles.color }}>{title}</div>
          <div className="text-[10px] text-[var(--muted)]">{caption}</div>
        </div>
        <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--muted)]">{codes.length}</span>
      </div>
      <div className="space-y-1.5">
        {codes.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-2.5 py-2 text-[11px] text-[var(--muted-2)]">
            None.
          </div>
        ) : (
          codes.map((c) => (
            <div key={c.code} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
              <span className="font-mono text-xs font-bold" style={{ color: toneStyles.color }}>{c.code}</span>
              <span className="text-[11px] leading-tight text-[var(--muted)]">{c.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigate tab — retrace + verdict + legal brief (click-gated).
// ---------------------------------------------------------------------------

function InvestigateTab({
  result,
  note,
  billedCodes,
  stage,
  setStage,
  onRestart,
}: {
  result: CaseResult;
  note: string;
  billedCodes: { code: string; description: string }[];
  stage: number;
  setStage: (n: number) => void;
  onRestart: () => void;
}) {
  const analyses = result.code_analyses ?? [];
  const overBilled = analyses.filter((a) => a.match === "extra" || a.match === "mismatch");
  const finding = result.findings[0];
  const detectorCategory = finding?.fraud_type;
  const detectorVerdict = finding?.analysis?.verdict ?? finding?.intent;

  // Legal brief — same wiring as the tour (deterministic, from case + findings).
  const legalBriefText = useMemo(() => {
    const briefFinding = findingFromResult(result, {
      fraudType: detectorCategory ?? "clean",
      verdict: detectorVerdict === "fraud" ? "fraud" : detectorVerdict === "error" ? "error" : "clean",
      confidence: result.max_confidence || finding?.confidence || 0,
    });
    return buildLegalBrief({
      caseId: result.case_id,
      encounterDate: undefined,
      clinicalNote: note,
      billedCodes,
      finding: briefFinding,
      analyses: analyses as Parameters<typeof buildLegalBrief>[0]["analyses"],
      totalImpact: result.total_impact,
      detected: result.detected,
      liveNarrative: result.source === "live" ? result.legal_brief : undefined,
    });
  }, [result, note, billedCodes, analyses, detectorCategory, detectorVerdict]);

  return (
    <div className="space-y-4">
      {/* Stage 0 — retrace */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Retrace — per over-billed code"
          subtitle="The agentic framework rates agreeability + grounding and cites the note."
          right={<BrainCircuit className="h-4 w-4 text-[var(--accent)]" />}
        />
        <div className="space-y-3 p-4">
          {overBilled.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-6 text-center text-sm text-[var(--muted)]">
              No over-billed codes to retrace — the bill aligns with the note.
            </div>
          )}
          {overBilled.map((a) => (
            <RetraceCard key={a.code} analysis={a} />
          ))}
        </div>
      </Card>

      {/* Stage 1 — verdict (click-gated) */}
      {stage >= 1 && (
        <Card className="animate-fade-rise overflow-hidden">
          <CardHeader title="Verdict" subtitle="The judgement agent's case-level finding." right={<Gavel className="h-4 w-4 text-[var(--accent)]" />} />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              {detectorCategory && <FraudChip type={detectorCategory} />}
              <IntentBadge intent={detectorVerdict === "fraud" ? "fraud" : detectorVerdict === "error" ? "error" : "clean"} />
              <span className="text-xs text-[var(--muted-2)]">
                Confidence <span className="font-semibold text-[var(--foreground)]">{formatPct(result.max_confidence || finding?.confidence || 0)}</span>
              </span>
              {typeof result.detected === "boolean" && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--risk-low-soft)] text-[var(--risk-low)]">
                  <ShieldCheck className="h-3 w-3" /> {result.detected ? "Detector matched" : "Fraud caught"}
                </span>
              )}
            </div>
            {finding?.rationale && <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">{finding.rationale}</p>}
          </div>
        </Card>
      )}

      {/* Stage 2 — legal brief (click-gated) */}
      {stage >= 2 && (
        <Card className="surface-sober animate-fade-rise overflow-hidden">
          <CardHeader
            title="Legal brief"
            subtitle="Generated by textgen (Guided Docs) from the detector findings — preliminary, not a determination"
            right={<Scale className="h-4 w-4 text-[var(--accent)]" />}
          />
          <div className="print-sober px-5 py-4">
            <LegalBriefView brief={legalBriefText} />
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

      {/* Click-gated advance + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {stage === 0 && (
          <button
            onClick={() => setStage(1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Gavel className="h-3.5 w-3.5" /> Show the verdict
          </button>
        )}
        {stage === 1 && (
          <button
            onClick={() => setStage(2)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <Scale className="h-3.5 w-3.5" /> Generate legal brief
          </button>
        )}
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Start over
        </button>
        <Link
          href="/tour"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to demos
        </Link>
      </div>
    </div>
  );
}

function RetraceCard({ analysis }: { analysis: CodeAnalysis }) {
  const groundingLabel =
    analysis.grounding === "supported" ? "Supported"
      : analysis.grounding === "weakly_supported" ? "Weakly supported"
        : analysis.grounding === "contradicted" ? "Contradicted"
          : "Unsupported";
  const groundingTone =
    analysis.grounding === "supported" ? "var(--risk-low)"
      : analysis.grounding === "weakly_supported" ? "var(--risk-med)"
        : "var(--risk-high)";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{analysis.code}</span>
          <span className="text-xs text-[var(--muted)]">{analysis.description}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${groundingTone}22`, color: groundingTone }}>
          <ScanSearch className="h-3 w-3" /> {groundingLabel}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted-2)]">Agreeability (0 = likely fraud, 100 = minor miss)</span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{Math.round(analysis.agreeability)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className="h-full rounded-full" style={{ width: `${analysis.agreeability}%`, background: groundingTone }} />
        </div>
      </div>
      {analysis.rationale && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--surface-2)]/60 px-3 py-2">
          <BrainCircuit className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
          <p className="text-xs leading-relaxed text-[var(--foreground)]">{analysis.rationale}</p>
        </div>
      )}
      {analysis.noteExcerpts.length > 0 && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Note excerpts cited</p>
          <ul className="space-y-1.5">
            {analysis.noteExcerpts.slice(0, 4).map((ex, i) => (
              <li key={i} className="text-xs italic leading-snug text-[var(--muted)]">“{ex}”</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
