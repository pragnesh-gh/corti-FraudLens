"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCase, getCaseResult, getProvider } from "@/lib/data";
import { formatUSD, formatPct, formatDate, cn } from "@/lib/utils";
import { Card, CardHeader, RiskBadge, FraudChip, IntentBadge, CodeComparisonTable } from "@/components/ui";
import type { CodeComparisonRow } from "@/components/ui";
import { FRAUD_META } from "@/lib/fraud-meta";
import type { AgentCard, EvidenceSpan, Finding, CodeAnalysis } from "@/lib/types";
import { ArrowLeft, ChevronRight, Check, Loader2, Circle, Sparkles, DollarSign, FileText, ScanSearch, Gavel, FlaskConical, Receipt, ShieldCheck, Scale } from "lucide-react";

const AGENT_ICONS: Record<string, typeof FileText> = {
  facts: FileText,
  coding: Sparkles,
  grounding: ScanSearch,
  verify: FlaskConical,
  judgement: Gavel,
  impact: Receipt,
};

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = useMemo(() => getCase(id), [id]);
  const result = useMemo(() => getCaseResult(id), [id]);
  const provider = c ? getProvider(c.provider_id) : undefined;

  // Streaming agent cards — reveal one at a time with realistic pacing.
  const [visibleAgents, setVisibleAgents] = useState(0);
  const [activeSpan, setActiveSpan] = useState<string | null>(null);

  useEffect(() => {
    if (!result) return;
    setVisibleAgents(0);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reveal = () => {
      if (i < result.agent_trace.length) {
        setVisibleAgents(i + 1);
        i++;
        timers.push(setTimeout(reveal, result.agent_trace[i]?.duration_ms ?? 900));
      }
    };
    timers.push(setTimeout(reveal, 400));
    return () => timers.forEach(clearTimeout);
  }, [result]);

  if (!c || !result || !provider) {
    return (
      <div className="py-20 text-center text-[var(--muted)]">
        Case not found. <Link href="/" className="text-[var(--accent)] underline">Back to queue</Link>
      </div>
    );
  }

  // Highlight a span in the note if it matches the active code.
  function renderNote() {
    if (!c || !result) return null;
    // Merge evidence spans; highlight those whose code === activeSpan.
    const spans = c.evidence_spans;
    if (!activeSpan || spans.length === 0) return <p className="whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">{c.clinical_note}</p>;

    const matching = spans.filter((s) => s.code === activeSpan);
    if (matching.length === 0) return <p className="whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">{c.clinical_note}</p>;

    // Render note with highlighted segments.
    const sorted = [...matching].sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const findingFraudType = result.findings.find((f) => f.code === activeSpan)?.fraud_type ?? "upcoding";
    const highlightColor = FRAUD_META[findingFraudType].color;
    sorted.forEach((s, i) => {
      if (s.start > cursor) parts.push(<span key={`t${i}`}>{c.clinical_note.slice(cursor, s.start)}</span>);
      parts.push(
        <mark
          key={`m${i}`}
          className="rounded px-0.5 py-0.5 text-white"
          style={{ background: highlightColor }}
        >
          {c.clinical_note.slice(s.start, s.end)}
        </mark>,
      );
      cursor = s.end;
    });
    if (cursor < c.clinical_note.length) parts.push(<span key="end">{c.clinical_note.slice(cursor)}</span>);
    return <p className="whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">{parts}</p>;
  }

  const submittedProc = c.submitted_codes.procedures;
  const predictedProc = result.predicted_codes.procedures;

  // Build comparison-table rows from the per-code analyses (set-intersection +
  // retrace). Falls back to a positional projection when no analyses exist
  // (e.g. pure replay without precomputed data).
  const comparisonRows: CodeComparisonRow[] = useMemo(() => {
    if (result.code_analyses && result.code_analyses.length > 0) {
      return result.code_analyses.map((a: CodeAnalysis) => ({
        code: a.code,
        description: a.description,
        match:
          a.match === "exact"
            ? "matched"
            : a.match === "extra"
              ? "over-billed"
              : a.match === "missing"
                ? "under-billed"
                : "over-billed", // mismatch → treat as over-billed (billed code under scrutiny)
        agreeability: a.match !== "exact" ? a.agreeability : undefined,
        evidence: a.match !== "exact" ? a.grounding : undefined,
      }));
    }
    // Fallback: positional projection of submitted vs predicted procedures.
    return submittedProc.map((sp, i) => {
      const pp = predictedProc[i];
      const mismatch = pp && sp.code !== pp.code;
      return {
        code: sp.code,
        description: sp.description,
        match: mismatch ? "over-billed" : "matched",
      };
    });
  }, [result, submittedProc, predictedProc]);

  // The case-level detector verdict (from the judgement agent, when present).
  const verdictFinding = result.findings[0];
  const caseVerdict = verdictFinding?.analysis?.verdict;
  const caseCategory = verdictFinding?.fraud_type;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Queue
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">{c.case_id}</span>
        </div>
        <div className="flex items-center gap-2">
          {result.findings.length > 0 && <RiskBadge score={Math.round(result.max_confidence * 100)} />}
          <IntentBadge
            intent={result.findings.some((f) => f.intent === "fraud") ? "fraud" : result.findings.some((f) => f.intent === "error") ? "error" : "clean"}
          />
          {typeof result.detected === "boolean" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                result.detected
                  ? "bg-[var(--risk-low-soft)] text-[var(--risk-low)]"
                  : "bg-[var(--risk-med-soft)] text-[var(--risk-med)]",
              )}
              title={result.detected ? "Detector independently arrived at the planted fraud type" : "Fraud detected, but category differs from the planted type"}
            >
              <ShieldCheck className="h-3 w-3" />
              {result.detected ? "Detector matched" : "Fraud caught"}
            </span>
          )}
          {result.source === "live" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Live
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{provider.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {provider.specialty} · NPI {provider.npi} · {provider.state} · DOS {formatDate(c.encounter.date)}
          </p>
        </div>
        <Link
          href={`/providers/${provider.id}`}
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          View provider pattern →
        </Link>
      </div>

      {/* Agent pipeline (streaming cards) — full-width bento tile */}
      <Card>
        <CardHeader title="Agent pipeline" subtitle="Orchestrated agents — facts, coding, grounding, verification, judgement, impact" />
        <div className="flex flex-wrap gap-2.5 p-4">
          {result.agent_trace.slice(0, visibleAgents).map((card, i) => (
            <AgentCardView key={card.id} card={card} index={i} />
          ))}
          {visibleAgents < result.agent_trace.length && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing…
            </div>
          )}
        </div>
      </Card>

      {/* Bento grid: detector verdict (large), economic impact (small), code
          analysis (wide), clinical note (tall), findings, legal brief (full).
          Collapses to a single column on small screens. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Detector verdict — large prominent tile (spans 2 cols + 2 rows) */}
        {verdictFinding && (
          <Card className="overflow-hidden lg:col-span-4 lg:row-span-2">
            <CardHeader
              title="Detector verdict"
              subtitle="Agentic judgement — coding expert reasons over the comparison"
              right={<Gavel className="h-4 w-4 text-[var(--accent)]" />}
            />
            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
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
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{verdictFinding.rationale}</p>
              {verdictFinding.analysis && verdictFinding.analysis.noteExcerpts.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
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
          </Card>
        )}

        {/* Economic impact — small tile */}
        {result.total_impact > 0 && (
          <Card className="overflow-hidden lg:col-span-4">
            <CardHeader title="Economic impact" subtitle="Deterministic — overpayment × frequency × penalty multiplier" right={<DollarSign className="h-4 w-4 text-[var(--risk-high)]" />} />
            <div className="px-5 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-[var(--risk-high)]">{formatUSD(result.total_impact, true)}</span>
                <span className="text-sm text-[var(--muted)]">projected</span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Extrapolated by detected frequency (45 similar claims) × 2.5× penalty multiplier for likely fraud.
              </p>
            </div>
          </Card>
        )}

        {/* Findings — small tile */}
        <Card className="lg:col-span-4">
          <CardHeader title="Findings" subtitle={`${result.findings.length} flag${result.findings.length === 1 ? "" : "s"} · ${formatUSD(result.total_impact, true)} projected impact`} />
          <div className="space-y-2 p-3">
            {result.findings.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-[var(--muted)]">No anomalies. Codes align with the note.</div>
            )}
            {result.findings.map((f, i) => (
              <FindingRow key={i} finding={f} onActivate={() => setActiveSpan(f.code)} active={activeSpan === f.code} />
            ))}
          </div>
        </Card>

        {/* Code analysis — wide tile */}
        <Card className="lg:col-span-7">
          <CardHeader
            title="Code analysis"
            subtitle="What the provider billed vs what our coding expert predicted"
          />
          <div className="p-4">
            <CodeComparisonTable rows={comparisonRows} />
            <p className="mt-3 text-[11px] leading-snug text-[var(--muted-2)]">
              <span className="font-semibold text-[var(--risk-high)]">Over-billed</span> codes were not predicted by our expert and were retraced by the agentic framework —
              the <span className="font-semibold text-[var(--foreground)]">agreeability</span> score rates how defensible each is (high = minor miss, low = likely fraud).
            </p>
          </div>
        </Card>

        {/* Clinical note — tall tile */}
        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader
            title="Clinical note"
            subtitle="Click a finding to highlight its evidence in the note"
            right={
              activeSpan && (
                <button
                  onClick={() => setActiveSpan(null)}
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  Clear highlight
                </button>
              )
            }
          />
          <div className="max-h-[460px] overflow-y-auto px-5 py-4 text-sm">
            {renderNote()}
          </div>
        </Card>

        {/* Legal / referral brief — full-width tile (textgen via Guided Docs) */}
        {result.legal_brief && (
          <Card className="surface-sober overflow-hidden lg:col-span-12">
            <CardHeader
              title="Case referral brief"
              subtitle="Generated by textgen (Guided Docs) from the detector findings — preliminary, not a determination"
              right={<Scale className="h-4 w-4 text-[var(--accent)]" />}
            />
            <div className="print-sober px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{result.legal_brief}</p>
              <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] italic leading-snug text-[var(--muted-2)]">
                This AI-generated analysis is a preliminary investigation assessment and does not constitute a legal
                conclusion or a determination of fraud. Mere coding discrepancies do not establish a violation.
              </p>
              <button
                onClick={() => window.print()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <FileText className="h-3.5 w-3.5" /> Print / save as PDF
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function AgentCardView({ card, index }: { card: AgentCard; index: number }) {
  const Icon = AGENT_ICONS[card.id] ?? Circle;
  return (
    <div
      className="animate-fade-rise flex w-[210px] items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">{card.title}</span>
          <Check className="h-3 w-3 text-[var(--risk-low)]" />
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)] line-clamp-2">{card.summary}</p>
      </div>
    </div>
  );
}

function FindingRow({ finding, onActivate, active }: { finding: Finding; onActivate: () => void; active: boolean }) {
  const meta = FRAUD_META[finding.fraud_type];
  const Icon = meta.icon;
  return (
    <button
      onClick={onActivate}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition",
        active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]",
      )}
    >
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md" style={{ background: meta.soft, color: meta.color }}>
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="font-mono text-xs text-[var(--muted)]">{finding.code}</span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-[var(--muted)] line-clamp-3">{finding.rationale}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <span className="text-[var(--muted-2)]">Confidence <span className="font-semibold text-[var(--foreground)]">{formatPct(finding.confidence)}</span></span>
          <span className="text-[var(--muted-2)]">Grounding <span className="font-semibold text-[var(--foreground)]">{formatPct(finding.grounding_score)}</span></span>
          <span className="ml-auto font-semibold text-[var(--risk-high)]">{formatUSD(finding.dollar_impact, true)}</span>
        </div>
      </div>
    </button>
  );
}
