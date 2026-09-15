"use client";

/**
 * TryItYourself — the hands-on playground at the end of a guided tour.
 *
 * Lets a viewer run the REAL Corti coding-expert (when FRAUDLENS_LIVE=1) on the
 * exact clinical note the tour just explained — or on any of the tour
 * templates. Streams the agent cards, then shows the live prediction next to
 * the billed codes so the viewer can see the agent catch (or miss) the fraud.
 *
 * Falls back to a labeled "replay" result when live isn't armed, so it always
 * does something useful. Pure React/CSS — no multimodal, no new deps.
 */

import { useEffect, useState } from "react";
import { cn, formatPct } from "@/lib/utils";
import { Card, CardHeader, FraudChip } from "@/components/ui";
import type { TourCase } from "@/components/tour/tour-types";
import { getTourCase, TOUR_CASES } from "@/lib/tour-cases";
import {
  Play,
  Loader2,
  Check,
  X,
  Sparkles,
  FileText,
  ScanSearch,
  Gavel,
  Receipt,
  FlaskConical,
  BrainCircuit,
  Zap,
} from "lucide-react";

const AGENT_STEPS = [
  { id: "facts", title: "Extract clinical facts", icon: FileText },
  { id: "coding", title: "Predict medical codes", icon: Sparkles },
  { id: "grounding", title: "Ground codes in note", icon: ScanSearch },
  { id: "verify", title: "Verify against journal", icon: FlaskConical },
  { id: "judgement", title: "Judge fraud vs error", icon: Gavel },
  { id: "impact", title: "Assess dollar impact", icon: Receipt },
];

interface RunResult {
  source: "live" | "replay";
  region?: string;
  predictedCodes: { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] };
  rawResponse?: string;
  error?: string;
}

export function TryItYourself({ initialCaseId }: { initialCaseId: string }) {
  const [selectedId, setSelectedId] = useState(initialCaseId);
  const tc = getTourCase(selectedId) ?? TOUR_CASES[0];
  const [note, setNote] = useState(tc.noteText);
  const [running, setRunning] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [liveArmed, setLiveArmed] = useState(false);

  // Check whether the live path is armed (server-side keys + FRAUDLENS_LIVE=1).
  useEffect(() => {
    fetch("/api/coding-expert")
      .then((r) => r.json())
      .then((d) => setLiveArmed(Boolean(d.live)))
      .catch(() => setLiveArmed(false));
  }, []);

  // When the template changes, load its note.
  useEffect(() => {
    setNote(tc.noteText);
    setResult(null);
    setVisibleSteps(0);
  }, [tc.noteText]);

  async function run() {
    setRunning(true);
    setResult(null);
    setVisibleSteps(0);
    // Stream the agent cards with the same pacing as the case detail page.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reveal = (i: number) => {
      if (i < AGENT_STEPS.length) {
        setVisibleSteps(i + 1);
        timers.push(setTimeout(() => reveal(i + 1), 700));
      }
    };
    reveal(0);
    // Fire the real agent call in parallel.
    try {
      const res = await fetch("/api/coding-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await res.json()) as RunResult;
      // Ensure all steps have shown before the result lands.
      timers.forEach(clearTimeout);
      setVisibleSteps(AGENT_STEPS.length);
      setResult(data);
    } catch {
      timers.forEach(clearTimeout);
      setVisibleSteps(AGENT_STEPS.length);
      const fallback: RunResult = { source: "replay", predictedCodes: { dx: [], procedures: [] }, error: "Request failed." };
      setResult(fallback);
    } finally {
      setRunning(false);
    }
  }

  // Billed codes from the selected tour case (the "truth" we compare against).
  const billedCodes = tc.billedCodes;
  const predictedDx = result?.predictedCodes.dx ?? [];
  const predictedProc = result?.predictedCodes.procedures ?? [];

  return (
    <Card className="overflow-hidden border-[var(--accent)]/25">
      <CardHeader
        title="Try it yourself"
        subtitle="Run the coding-expert agent on this exact note — live, in the background."
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
            {liveArmed ? "Live agent" : "Replay mode"}
          </span>
        }
      />

      <div className="space-y-4 p-5">
        {/* Template picker */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
            <BrainCircuit className="h-3.5 w-3.5" /> Template — pick a case to run
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOUR_CASES.map((t) => (
              <button
                key={t.caseId}
                onClick={() => setSelectedId(t.caseId)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                  t.caseId === selectedId
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]",
                )}
              >
                <FraudChip type={t.fraudType} />
                <span className="font-mono text-[11px]">{t.caseId}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editable note */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
              <FileText className="h-3.5 w-3.5" /> Clinical note
            </div>
            <button
              onClick={() => setNote(tc.noteText)}
              className="text-[11px] font-medium text-[var(--accent)] hover:underline"
            >
              Reset to template
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={running}
            rows={7}
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--surface)] disabled:opacity-60"
          />
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={running || !note.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Agent running…" : "Run the coding-expert agent"}
        </button>

        {/* Streaming agent cards */}
        {visibleSteps > 0 && (
          <div className="flex flex-wrap gap-2">
            {AGENT_STEPS.slice(0, visibleSteps).map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="animate-fade-rise flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-medium text-[var(--foreground)]">{s.title}</span>
                  {i < visibleSteps - 1 || !running ? (
                    <Check className="h-3 w-3 text-[var(--risk-low)]" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Result: predicted vs billed */}
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

            {result.error && (
              <p className="text-xs text-[var(--risk-med)]">{result.error}</p>
            )}

            {/* Side-by-side: what the agent predicted vs what was billed */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                  Agent predicted (truth)
                </div>
                <CodeList codes={predictedDx.concat(predictedProc)} tone="good" />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
                  Provider billed (transcript)
                </div>
                <CodeList codes={billedCodes} tone="compare" fraudSet={new Set(tc.billedCodes.filter((b) => b.fraudulent).map((b) => b.code))} />
              </div>
            </div>

            {/* The catch verdict — did the agent catch the fraud? */}
            <CatchVerdict tc={tc} predictedCodes={[...predictedDx.map((d) => d.code), ...predictedProc.map((p) => p.code)]} />
          </div>
        )}
      </div>
    </Card>
  );
}

function CodeList({
  codes,
  tone,
  fraudSet,
}: {
  codes: { code: string; description: string }[];
  tone: "good" | "compare";
  fraudSet?: Set<string>;
}) {
  if (codes.length === 0) {
    return <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted-2)]">No codes returned.</div>;
  }
  return (
    <div className="space-y-1.5">
      {codes.map((c, i) => {
        const fraudulent = fraudSet?.has(c.code);
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-2.5 py-1.5",
              fraudulent
                ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/50"
                : tone === "good"
                  ? "border-[var(--risk-low)]/20 bg-[var(--risk-low-soft)]/40"
                  : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            <span className="font-mono text-xs font-semibold text-[var(--foreground)]">{c.code}</span>
            <span className="text-xs text-[var(--muted)]">{c.description}</span>
            {fraudulent && <X className="ml-auto h-3.5 w-3.5 flex-none text-[var(--risk-high)]" />}
          </div>
        );
      })}
    </div>
  );
}

function CatchVerdict({ tc, predictedCodes }: { tc: TourCase; predictedCodes: string[] }) {
  // Did the agent OMIT the fraudulent code (a correct catch) or include it (missed)?
  const fraudCaught = !predictedCodes.includes(tc.fraudCode);
  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
      style={{ borderColor: `${tc.accentColor}30`, background: tc.accentSoft }}
    >
      {fraudCaught ? (
        <Check className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-low)]" />
      ) : (
        <X className="mt-0.5 h-4 w-4 flex-none text-[var(--risk-high)]" />
      )}
      <div className="text-xs leading-relaxed text-[var(--foreground)]">
        {fraudCaught ? (
          <>
            <span className="font-semibold text-[var(--risk-low)]">The agent caught it.</span> The coding-expert did{" "}
            <span className="font-semibold">not</span> return <span className="font-mono">{tc.fraudCode}</span> — there's nothing in
            the note to support it. This matches the tour's verdict.
          </>
        ) : (
          <>
            <span className="font-semibold text-[var(--risk-high)]">The agent returned {tc.fraudCode}.</span> Compare against the note
            yourself — the tour flagged this code as unsupported. Disagreement between agent and investigator is exactly what a
            reviewer looks at.
          </>
        )}
      </div>
    </div>
  );
}
