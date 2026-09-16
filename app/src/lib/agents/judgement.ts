// Agent 3 — Judgement / Classification agent.
// Aggregates per-code retrace results into a case-level verdict: fraud category,
// fraud-vs-error, confidence, summary. Backed by the coding-expert agent on
// staging-eu (Envoy/Models are blocked — see memory/corti-api-surfaces.md).
// Async boundary so an Opik span can wrap it later.

import type { Case, CodeAnalysis, Finding, FraudType, AgentCard, EvidenceSpan } from "../types";
import { CortiClient } from "../pipeline";
import { EM_CODES, PROC_CODES } from "../codes";

export interface CaseFinding {
  verdict: "fraud" | "error" | "clean";
  fraudType: FraudType | "none";
  fraudVsError: "fraud" | "error" | "clean";
  confidence: number;
  summary: string;
  details: string[];
  findings: Finding[];
}

const JUDGEMENT_SYSTEM_PROMPT = `You are a medical coding fraud classifier. Given a clinical note, billed codes, predicted codes, and per-code retrace results (agreeability + grounding), classify the case. Reply ONLY with JSON:
{"fraud_type": "upcoding|unbundling|phantom_billing|diagnosis_inflation|cloning|none", "verdict": "fraud|error|clean", "confidence": <0-1>, "summary": "...", "details": ["..."]}.
- fraud_type: the dominant scheme, or "none" if no fraud.
- verdict: "fraud" if there's intent/pattern, "error" if isolated mistake, "clean" if no issue.
- Map "phantom_billing" → phantom, "diagnosis_inflation" → dx_inflation in your reasoning, but use the exact labels above in the JSON.`;

/** Run the judgement agent over retrace results. */
export async function runJudgement(
  client: CortiClient,
  c: Case,
  analyses: CodeAnalysis[],
  predictedCodes: { procedures: string[]; dx: string[] },
  timeoutMs: number,
): Promise<CaseFinding> {
  const prompt = buildJudgementPrompt(c, analyses, predictedCodes);
  let agentId: string | null = null;
  try {
    agentId = await client.createReasoningAgent(
      "FraudLens_judgement",
      "Classify a case into a fraud category and verdict.",
      JUDGEMENT_SYSTEM_PROMPT,
    );
    const raw = await client.sendReasoningMessage(agentId, prompt, c.clinical_note, Math.max(timeoutMs, 120_000));
    return parseJudgementResponse(raw, c, analyses);
  } finally {
    if (agentId) await client.deleteAgent(agentId);
  }
}

function buildJudgementPrompt(c: Case, analyses: CodeAnalysis[], predictedCodes: { procedures: string[]; dx: string[] }): string {
  const billedProc = c.submitted_codes.procedures.map((p) => `${p.code} (${p.description})`).join(", ");
  const billedDx = c.submitted_codes.dx.map((d) => `${d.code} (${d.description})`).join(", ");
  const predictedProc = predictedCodes.procedures.join(", ");
  const predictedDx = predictedCodes.dx.join(", ");
  const retraces = analyses
    .filter((a) => a.match === "extra")
    .map((a) => `  - ${a.code}: agreeability=${a.agreeability}, grounding=${a.grounding}${a.historyContradiction?.flag ? `, historyContradiction=${a.historyContradiction.detail}` : ""}`)
    .join("\n");
  return [
    `Billed procedures: ${billedProc}`,
    `Billed diagnoses: ${billedDx}`,
    `Predicted procedures: ${predictedProc}`,
    `Predicted diagnoses: ${predictedDx}`,
    `Per-code retrace results (billed-not-predicted):`,
    retraces || "  (none — all billed codes were predicted)",
    `Classify this case. Return JSON only.`,
  ].join("\n");
}

function parseJudgementResponse(raw: string, c: Case, analyses: CodeAnalysis[]): CaseFinding {
  const trace: AgentCard[] = [];
  const empty: CaseFinding = {
    verdict: "clean", fraudType: "none", fraudVsError: "clean",
    confidence: 0, summary: "No parseable judgement.", details: [], findings: [],
  };
  if (!raw) return empty;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return empty;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      fraud_type?: string; verdict?: string; confidence?: number; summary?: string; details?: string[];
    };
    const fraudType = normalizeFraudType(obj.fraud_type) ?? "none";
    const verdict = (obj.verdict === "fraud" || obj.verdict === "error" || obj.verdict === "clean") ? obj.verdict : "clean";
    const confidence = Math.max(0, Math.min(1, Number(obj.confidence ?? 0)));
    const summary = String(obj.summary ?? "");
    const details = Array.isArray(obj.details) ? obj.details.map(String) : [];
    const findings = buildFindings(c, analyses, fraudType, verdict, confidence, trace);
    return {
      verdict,
      fraudType,
      fraudVsError: verdict,
      confidence,
      summary,
      details,
      findings,
    };
  } catch {
    return empty;
  }
}

function normalizeFraudType(s?: string): FraudType | "none" | undefined {
  if (!s) return undefined;
  const t = s.toLowerCase().replace(/-/g, "_");
  if (t === "upcoding") return "upcoding";
  if (t === "unbundling") return "unbundling";
  if (t === "phantom_billing" || t === "phantom") return "phantom";
  if (t === "diagnosis_inflation" || t === "dx_inflation") return "dx_inflation";
  if (t === "cloning") return "cloning";
  return "none";
}

/** Build Finding objects from the judgement + analyses (for the UI). */
function buildFindings(
  c: Case,
  analyses: CodeAnalysis[],
  fraudType: FraudType | "none",
  verdict: "fraud" | "error" | "clean",
  confidence: number,
  trace: AgentCard[],
): Finding[] {
  if (fraudType === "none" || verdict === "clean") return [];
  return analyses
    .filter((a) => a.match === "extra" && (a.grounding === "unsupported" || a.grounding === "contradicted" || a.agreeability < 50))
    .map((a) => ({
      code: a.code,
      fraud_type: fraudType as FraudType,
      confidence,
      grounding_score: groundingToScore(a.grounding),
      dollar_impact: computeImpact(c, a.code, verdict),
      rationale: a.historyContradiction?.flag
        ? `${a.code} contradicts patient history: ${a.historyContradiction.detail}`
        : `${a.code} (${a.description}) not supported by the note (agreeability ${a.agreeability}/100, grounding ${a.grounding}).`,
      evidence_spans: [] as EvidenceSpan[],
      agent_trace: trace,
      intent: verdict === "fraud" ? "fraud" : "error",
      analysis: a,
    }));
}

function groundingToScore(g: string): number {
  return g === "supported" ? 0.9 : g === "weakly_supported" ? 0.5 : g === "unsupported" ? 0.15 : 0.05;
}

function computeImpact(c: Case, code: string, verdict: "fraud" | "error" | "clean"): number {
  const charge = EM_CODES[code]?.charge ?? PROC_CODES[code]?.charge ?? 100;
  const freq = verdict === "fraud" ? 45 : 1;
  const penalty = verdict === "fraud" ? 2.5 : 1;
  return Math.round(charge * freq * penalty);
}
