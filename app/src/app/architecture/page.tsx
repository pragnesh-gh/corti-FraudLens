"use client";

import { Card, CardHeader } from "@/components/ui";
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
    capability: "textgen",
    surface: "POST /v2/tools/extract-facts",
    output: "Structured clinical facts",
    icon: FileSearch,
  },
  {
    id: "coding",
    title: "Code prediction",
    role: "Predict the ICD-10/CPT codes the note supports — with candidates and evidences (char offsets).",
    capability: "coding",
    surface: "POST /v2/tools/coding + coding-expert agent",
    output: "Predicted codes + candidates + evidences",
    icon: Sparkles,
  },
  {
    id: "compare",
    title: "Set-intersection comparison",
    role: "Compare billed vs predicted. Common = fine. Billed-not-predicted = investigate. Predicted-not-billed = under-billed.",
    capability: "deterministic",
    surface: "CodeAnalysis[] (exact | extra | missing)",
    output: "Common / over-billed / under-billed buckets",
    icon: Workflow,
  },
  {
    id: "chart-summary",
    title: "Chart summary",
    role: "Summarize prior charts when patient history is provided — grounds the retrace agent's history check (amputation, prior procedures).",
    capability: "textgen",
    surface: "POST /v2/documents (Guided Docs, dynamicTemplate)",
    output: "Summarized prior chart",
    icon: Stethoscope,
  },
  {
    id: "retrace",
    title: "Retrace / grounding",
    role: "For each billed-not-predicted code, reason whether it's defensible. Rate agreeability 0–100, grounding, cite note excerpts, flag history contradictions.",
    capability: "agentic",
    surface: "coding-expert agent — A2A message:send",
    output: "Per-code agreeability + grounding + noteExcerpts",
    icon: ScanSearch,
  },
  {
    id: "judgement",
    title: "Judgement / classification",
    role: "Aggregate per-code results into a case verdict: category (upcoding/unbundling/phantom/dx-inflation/cloning) + fraud-vs-error + confidence.",
    capability: "agentic",
    surface: "coding-expert agent — A2A message:send",
    output: "CaseFinding (category + verdict + confidence)",
    icon: Gavel,
  },
  {
    id: "impact",
    title: "Economic impact",
    role: "Deterministic overpayment × frequency × penalty multiplier, persisted as findings.",
    capability: "deterministic",
    surface: "computeEconomicImpact",
    output: "$ projected impact + findings JSON",
    icon: Receipt,
  },
  {
    id: "brief",
    title: "Case referral brief",
    role: "Draft a 13-section referral document (FCA §3729, qui-tam, hedged disclaimers) — LLM-filled from the verdict via Guided Docs.",
    capability: "textgen",
    surface: "POST /v2/documents (Guided Docs, legal sections)",
    output: "Referral-ready case package",
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
          FraudLens runs an honest detect-and-explain pipeline on Corti&apos;s platform — three capabilities
          (text generation, medical coding, the agentic framework) wired into agents that reason about
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
      <p className="mt-2.5 text-xs leading-snug text-[var(--muted)]">{stage.role}</p>
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
