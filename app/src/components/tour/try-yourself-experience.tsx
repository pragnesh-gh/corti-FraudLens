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
  BrainCircuit,
  ShieldCheck,
  AlertTriangle,
  FlaskConical,
  BadgeCheck,
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

/** A sample bill matching SAMPLE_NOTE, for the "Load a sample" affordance. */
const SAMPLE_BILLED = `J20.9 — Acute bronchitis
I10 — Essential hypertension
99213 — Office visit, established patient, low complexity`;

/**
 * Parse the billed-codes text box into the {code, description}[] the pipeline
 * expects. One code per line. The description is everything after the first
 * separator (" — ", " - ", " : ", or a tab); if there's no separator the whole
 * line is treated as the code with an empty description. Blank lines and
 * lines starting with "#" are ignored.
 */
function parseBilledText(text: string): { code: string; description: string }[] {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const m = l.match(/^\s*([^\s—:\-]+)\s*(?:—|--|-|:|\t)\s*(.*)$/u);
      if (m) return { code: m[1].trim(), description: m[2].trim() };
      const c = l.trim();
      return { code: c, description: "" };
    });
}

/** The inverse — render {code, description}[] back into the text-box format. */
function serializeBilled(codes: { code: string; description: string }[]): string {
  return codes.map((c) => (c.description ? `${c.code} — ${c.description}` : c.code)).join("\n");
}

export function TryYourselfExperience() {
  const [tab, setTab] = useState<Tab>("run");
  const [note, setNote] = useState("");
  // Optional billed codes, entered as free text (one per line) and parsed into
  // {code, description}[] on run. Empty string ⇒ prediction-only run.
  const [billedText, setBilledText] = useState("");
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

  // Parse the billed-codes text box on each run; drop lines with no code.
  const billedCodes = useMemo(
    () => parseBilledText(billedText).filter((c) => c.code),
    [billedText],
  );
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
            billedText={billedText}
            setBilledText={setBilledText}
            billedCount={billedCodes.length}
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
// Run tab — note + optional billed codes (two text boxes) + Run + prediction.
// ---------------------------------------------------------------------------

function RunTab({
  note,
  setNote,
  billedText,
  setBilledText,
  billedCount,
  running,
  onRun,
  runResult,
  onCompare,
}: {
  note: string;
  setNote: (v: string) => void;
  billedText: string;
  setBilledText: (v: string) => void;
  billedCount: number;
  running: boolean;
  onRun: () => void;
  runResult: RunResult | null;
  onCompare: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Two structured inputs side by side: clinical note + billed codes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Clinical note"
            subtitle="Paste your own encounter documentation."
            right={
              <button
                onClick={() => setNote(SAMPLE_NOTE)}
                disabled={running}
                className="text-[11px] font-medium text-[var(--accent)] transition hover:underline disabled:opacity-50"
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

        <Card className="overflow-hidden">
          <CardHeader
            title="Billed codes (optional)"
            subtitle="One code per line. Add a description after a dash to run the full compare + legal brief."
            right={
              <button
                onClick={() => setBilledText(SAMPLE_BILLED)}
                disabled={running}
                className="text-[11px] font-medium text-[var(--accent)] transition hover:underline disabled:opacity-50"
              >
                Load a sample
              </button>
            }
          />
          <div className="p-4">
            <textarea
              value={billedText}
              onChange={(e) => setBilledText(e.target.value)}
              disabled={running}
              rows={9}
              placeholder={"One code per line, e.g.\nJ20.9 — Acute bronchitis\n99213 — Office visit, established pt"}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface)] disabled:opacity-60"
            />
            <p className="mt-2 text-[11px] text-[var(--muted-2)]">
              {billedCount > 0
                ? `${billedCount} billed code${billedCount === 1 ? "" : "s"} ready · full pipeline will run.`
                : "Leave empty to get a prediction only (no compare / legal brief)."}
            </p>
          </div>
        </Card>
      </div>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={running || !note.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "Running…" : billedCount > 0 ? "Run the full pipeline" : "Run the coding-expert"}
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
  const isClean = !detectorCategory || detectorVerdict === "clean";
  const confidence = result.max_confidence || finding?.confidence || 0;

  // A computed verdict-facts grid — the Try-for-yourself equivalent of a tour
  // case's hand-authored `verdictFacts`. Built entirely from the live result so
  // it works for any pasted note (no TourCase available here).
  const verdictFacts = [
    { label: "Fraud type", value: detectorCategory ?? "None", icon: Gavel },
    { label: "Verdict", value: isClean ? "Clean" : detectorVerdict === "fraud" ? "Likely fraud" : "Error", icon: isClean ? BadgeCheck : AlertTriangle },
    { label: "Confidence", value: formatPct(confidence), icon: ScanSearch },
    { label: "Dollar impact", value: formatUSD(result.total_impact || 0, true), icon: Receipt, money: true },
  ];

  // The case-level narrative — prefer the judgement agent's own summary, then
  // the per-finding rationale, then a clean fallback. This is the reasoning that
  // was missing before (the card only showed `finding.rationale`, which is empty
  // for a custom note until a finding is built).
  const verdictConclusion =
    result.case_summary && !result.case_summary.startsWith("Codes align")
      ? result.case_summary
      : finding?.rationale
        ? finding.rationale
        : isClean
          ? "The coding-expert found no codes unsupported by the note. The bill and the note agree."
          : `${overBilled.length} billed code(s) not predicted by the note — see the retrace above for per-code evidence.`;

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
          <CardHeader title="Verdict" subtitle="The judgement agent's case-level finding — and the full picture on one card." right={<Gavel className="h-4 w-4 text-[var(--accent)]" />} />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Prefer the detector's actual category; fall back to "none". */}
              {detectorCategory ? <FraudChip type={detectorCategory} /> : (
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-low)]">
                  <BadgeCheck className="h-3 w-3" /> No fraud type
                </span>
              )}
              <IntentBadge intent={detectorVerdict === "fraud" ? "fraud" : detectorVerdict === "error" ? "error" : "clean"} />
              <span className="font-mono text-xs text-[var(--muted)]">{result.case_id}</span>
              {typeof result.detected === "boolean" && (
                <span
                  className={cn(
                    "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    result.detected
                      ? "bg-[var(--risk-med-soft)] text-[var(--risk-med)]"
                      : "bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
                  )}
                  title={result.detected ? "The agent flagged an anomaly in this note" : "The bill aligns with the note — no anomaly"}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {result.detected ? "Anomaly flagged" : "Bill aligns"}
                </span>
              )}
            </div>

            {/* Computed 4-fact grid — the Try-for-yourself equivalent of a tour case's verdictFacts. */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {verdictFacts.map((s, i) => {
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
                    <div className={cn("mt-1 text-sm font-bold", s.money ? "text-[var(--risk-high)] tabular-nums" : "text-[var(--foreground)]")}>
                      {s.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* The case-level reasoning — the narrative that was missing before. */}
            <div
              className={cn(
                "mt-4 rounded-lg border px-4 py-3",
                isClean
                  ? "border-[var(--risk-low)]/30 bg-[var(--risk-low-soft)]/40"
                  : "border-[var(--risk-med)]/30 bg-[var(--risk-med-soft)]/40",
              )}
            >
              <div className="flex items-start gap-2">
                {isClean ? (
                  <BadgeCheck className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-low)]" />
                ) : (
                  <FlaskConical className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-med)]" />
                )}
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{verdictConclusion}</p>
              </div>
            </div>

            {/* Per-code rationale from the retrace, if the judgement built findings. */}
            {result.findings.length > 0 && (
              <div className="mt-3 space-y-2">
                {result.findings.map((f, i) => f.rationale && (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-[var(--surface-2)]/60 px-3 py-2">
                    <BrainCircuit className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
                    <p className="text-xs leading-relaxed text-[var(--foreground)]">
                      <span className="font-mono font-semibold">{f.code}</span> — {f.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
