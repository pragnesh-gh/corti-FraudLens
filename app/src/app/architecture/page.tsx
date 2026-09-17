"use client";

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  FileText,
  Sparkles,
  ScanSearch,
  Gavel,
  Receipt,
  Scale,
  Workflow,
  Database,
  ArrowRight,
  Stethoscope,
  FileSearch,
} from "lucide-react";
import type { ReactNode } from "react";

/* The FraudLens system, as it actually runs on Corti's platform. Three Corti
 * capabilities are showcased distinctly (textgen, medical coding, agentic),
 * wired into an honest detect-and-explain pipeline. This page is documentation-
 * as-UI: a map of the agents and their roles, so a viewer can see "here's the
 * system, here's what each agent does". */

type Capability = "textgen" | "coding" | "agentic" | "deterministic";

const CAP_META: Record<Capability, { label: string; color: string; soft: string }> = {
  textgen: { label: "Text generation", color: "var(--cap-textgen)", soft: "var(--cap-textgen-soft)" },
  coding: { label: "Medical coding", color: "var(--cap-coding)", soft: "var(--cap-coding-soft)" },
  agentic: { label: "Agentic framework", color: "var(--cap-agentic)", soft: "var(--cap-agentic-soft)" },
  deterministic: { label: "Deterministic", color: "var(--muted)", soft: "var(--surface-2)" },
};

interface Stage {
  id: string;
  title: string;
  role: string;
  /** Phrases within `role` to bold — the load-bearing terms that explain the stage. */
  highlights?: string[];
  capability: Capability;
  surface: string;
  output: string;
  icon: typeof FileText;
}

const INPUTS: { id: string; label: string; sub: string; icon: typeof FileText }[] = [
  { id: "note", label: "Clinical note", sub: "The encounter documentation", icon: FileText },
  { id: "billed", label: "Billed codes", sub: "What the company submitted", icon: Receipt },
  { id: "history", label: "Patient history", sub: "Prior charts (optional)", icon: Database },
];

const STAGES: Stage[] = [
  {
    id: "facts",
    title: "Fact extraction",
    role: "Structure the clinical note into facts (chief complaint, vitals, assessment, plan). Minimizes inputs for scale.",
    highlights: ["Structure the clinical note into facts", "Minimizes inputs for scale"],
    capability: "textgen",
    surface: "POST /v2/tools/extract-facts",
    output: "Structured clinical facts",
    icon: FileSearch,
  },
  {
    id: "coding",
    title: "Code prediction",
    role: "Predict the ICD-10/CPT codes the note supports — with candidates and evidences (char offsets).",
    highlights: ["Predict the ICD-10/CPT codes", "evidences (char offsets)"],
    capability: "coding",
    surface: "POST /v2/tools/coding + coding-expert agent",
    output: "Predicted codes + candidates + evidences",
    icon: Sparkles,
  },
  {
    id: "compare",
    title: "Set-intersection comparison",
    role: "Compare billed vs predicted. Common = fine. Billed-not-predicted = investigate. Predicted-not-billed = under-billed.",
    highlights: ["Common = fine", "Billed-not-predicted = investigate", "Predicted-not-billed = under-billed"],
    capability: "deterministic",
    surface: "CodeAnalysis[] (exact | extra | missing)",
    output: "Common / over-billed / under-billed buckets",
    icon: Workflow,
  },
  {
    id: "chart-summary",
    title: "Chart summary",
    role: "Summarize prior charts when patient history is provided — grounds the retrace agent's history check (amputation, prior procedures).",
    highlights: ["patient history is provided", "history check (amputation, prior procedures)"],
    capability: "textgen",
    surface: "POST /v2/documents (Guided Docs, dynamicTemplate)",
    output: "Summarized prior chart",
    icon: Stethoscope,
  },
  {
    id: "retrace",
    title: "Retrace / grounding",
    role: "For each billed-not-predicted code, reason whether it's defensible. Rate agreeability 0–100, grounding, cite note excerpts, flag history contradictions.",
    highlights: ["reason whether it's defensible", "agreeability 0–100", "cite note excerpts", "flag history contradictions"],
    capability: "agentic",
    surface: "coding-expert agent — A2A message:send",
    output: "Per-code agreeability + grounding + noteExcerpts",
    icon: ScanSearch,
  },
  {
    id: "judgement",
    title: "Judgement / classification",
    role: "Aggregate per-code results into a case verdict: category (upcoding/unbundling/phantom/dx-inflation/cloning) + fraud-vs-error + confidence.",
    highlights: ["case verdict", "fraud-vs-error"],
    capability: "agentic",
    surface: "coding-expert agent — A2A message:send",
    output: "CaseFinding (category + verdict + confidence)",
    icon: Gavel,
  },
  {
    id: "impact",
    title: "Economic impact",
    role: "Deterministic overpayment × frequency × penalty multiplier, persisted as findings.",
    highlights: ["overpayment × frequency × penalty multiplier"],
    capability: "deterministic",
    surface: "computeEconomicImpact",
    output: "$ projected impact + findings JSON",
    icon: Receipt,
  },
  {
    id: "brief",
    title: "Legal brief",
    role: "Draft a multi-section legal brief (FCA §3729, qui-tam, Escobar materiality, hedged disclaimers) — deterministic skeleton + LLM-filled narrative via Guided Docs.",
    highlights: ["FCA §3729, qui-tam, Escobar materiality", "deterministic skeleton + LLM-filled narrative"],
    capability: "textgen",
    surface: "POST /v2/documents (Guided Docs, legal sections)",
    output: "Legal brief (first-class textgen deliverable)",
    icon: Scale,
  },
];

const OUTPUTS: { id: string; label: string; sub: string; icon: typeof FileText }[] = [
  { id: "verdict", label: "Case verdict", sub: "Category + fraud-vs-error + confidence", icon: Gavel },
  { id: "evidence", label: "Grounded findings", sub: "Per-code agreeability + note excerpts", icon: ScanSearch },
  { id: "referral", label: "Referral brief", sub: "First-class textgen deliverable", icon: Scale },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">System architecture</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          FraudLens runs an honest <span className="font-semibold text-[var(--foreground)]">detect-and-explain</span> pipeline on Corti&apos;s platform — three capabilities
          (<span className="font-semibold text-[var(--cap-textgen)]">text generation</span>,{" "}
          <span className="font-semibold text-[var(--cap-coding)]">medical coding</span>,{" "}
          <span className="font-semibold text-[var(--cap-agentic)]">the agentic framework</span>) wired into agents that reason about
          every billed code, not a rule-based score.
        </p>
      </div>

      {/* Bento row: capability legend (wide) + honesty note (tall). Collapses
          to a single column on small screens. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
        {/* Legend — wide tile */}
        <div className="lg:col-span-7">
          <Card className="h-full p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Capabilities</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {(Object.keys(CAP_META) as Capability[]).map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: CAP_META[k].soft, color: CAP_META[k].color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: CAP_META[k].color }} />
                  {CAP_META[k].label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* Honesty note — tall tile */}
        <div className="lg:col-span-5">
          <Card className="h-full p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Why this is honest</p>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Synthetic cases carry <span className="font-semibold text-[var(--foreground)]">planted fraud</span> as an
              answer key. The pipeline never reads it to produce findings — it derives them from the note text,
              billed codes, and agent reasoning. A <span className="font-semibold text-[var(--risk-low)]">detected</span>{" "}
              signal confirms the detector independently arrived at the planted type.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted-2)]">
              Traced with{" "}
              <span className="font-semibold text-[var(--cap-textgen)]">Opik</span> when{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[10px]">FRAUDLENS_TRACING=1</code>.
            </p>
          </Card>
        </div>
      </div>

      {/* Flow */}
      <div className="space-y-4">
        {/* Inputs */}
        <FlowRow label="Inputs">
          {INPUTS.map((n) => (
            <Node key={n.id} icon={n.icon} title={n.label} sub={n.sub} capability="deterministic" compact />
          ))}
        </FlowRow>

        <Connector />

        {/* Pipeline stages */}
        <FlowRow label="Agentic pipeline">
          {STAGES.map((s) => (
            <StageCard key={s.id} stage={s} />
          ))}
        </FlowRow>

        <Connector />

        {/* Outputs */}
        <FlowRow label="Outputs">
          {OUTPUTS.map((n) => (
            <Node key={n.id} icon={n.icon} title={n.label} sub={n.sub} capability="deterministic" compact />
          ))}
        </FlowRow>
      </div>
    </div>
  );
}

function FlowRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">{label}</p>
      <div className="flex flex-wrap items-stretch gap-3">{children}</div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1">
      <ArrowRight className="h-4 w-4 rotate-90 text-[var(--muted-2)]" />
    </div>
  );
}

function Node({
  icon: Icon,
  title,
  sub,
  capability,
  compact,
}: {
  icon: typeof FileText;
  title: string;
  sub: string;
  capability: Capability;
  compact?: boolean;
}) {
  const meta = CAP_META[capability];
  return (
    <div
      className={cn("glass rounded-xl border p-3", compact ? "w-[180px]" : "w-[240px]")}
      style={{ borderColor: meta.color + "33" }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: meta.soft, color: meta.color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="text-[11px] leading-snug text-[var(--muted)]">{sub}</p>
    </div>
  );
}

/** Render `text` with each phrase in `highlights` bolded. Matches are
 *  case-sensitive and non-overlapping; the first occurrence of each phrase is
 *  bolded. Used to draw the eye to the load-bearing terms in a stage's role
 *  description without changing the readable string. */
function highlight(text: string, highlights?: string[]): ReactNode {
  if (!highlights || highlights.length === 0) return text;
  // Build a list of [phrase, index] for phrases actually present, then split
  // the string at each match index, longest-first so shorter substrings that
  // happen to sit inside a longer highlighted phrase don't double-wrap.
  const matches: { start: number; end: number }[] = [];
  for (const h of highlights) {
    const start = text.indexOf(h);
    if (start >= 0) matches.push({ start, end: start + h.length });
  }
  if (matches.length === 0) return text;
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  while (i < matches.length) {
    const m = matches[i];
    if (m.start < cursor) {
      // overlaps an already-emitted span — skip
      i++;
      continue;
    }
    if (m.start > cursor) out.push(text.slice(cursor, m.start));
    out.push(
      <span key={i} className="font-semibold text-[var(--foreground)]">
        {text.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
    i++;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function StageCard({ stage }: { stage: Stage }) {
  const meta = CAP_META[stage.capability];
  const Icon = stage.icon;
  return (
    <div
      className="glass w-[240px] rounded-xl border p-4 transition hover:shadow-md"
      style={{ borderColor: meta.color + "44" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"
          style={{ background: meta.soft, color: meta.color }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{stage.title}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
            {meta.label}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-xs leading-snug text-[var(--muted)]">{highlight(stage.role, stage.highlights)}</p>
      <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-2.5">
        <div className="flex items-start gap-1.5">
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">surface</span>
          <code className="font-mono text-[10px] text-[var(--foreground)]">{stage.surface}</code>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">output</span>
          <span className="text-[10px] text-[var(--muted)]">{stage.output}</span>
        </div>
      </div>
    </div>
  );
}
