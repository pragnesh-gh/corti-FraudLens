// Agent 2 — Retrace / Grounding agent (the crux).
// For each billed-not-predicted code, a Corti coding-expert agent reasons about
// whether the code is defensible and returns agreeability + grounding + noteExcerpts.
// For history-contradiction cases, a Guided-Docs chart summary is generated first
// and passed into the agent's context so it can catch e.g. amputation contradictions.
//
// All Corti calls use the proven staging-eu surfaces (see memory/corti-api-surfaces.md).
// Each agent call is an async boundary so an Opik span can wrap it later.

import type { Case, CodeAnalysis, EvidenceSpan } from "../types";
import { CortiClient, type DocSection } from "../pipeline";
import { EM_CODES, PROC_CODES, DX_CODES } from "../codes";

export interface RetraceResult {
  analysis: CodeAnalysis;
  rationale: string;
}

interface RetraceAgentResponse {
  agreeability: number;
  grounding: "supported" | "weakly_supported" | "unsupported" | "contradicted";
  reasoning: string;
  noteExcerpts: string[];
  historyContradiction?: { flag: boolean; detail: string };
}

const RETRACE_SYSTEM_PROMPT = `You are a medical coding auditor. Given a clinical note and ONE billed code the model did not predict, assess whether the code is defensible from the note. Reply ONLY with JSON:
{"agreeability": <0-100>, "grounding": "supported|weakly_supported|unsupported|contradicted", "reasoning": "...", "noteExcerpts": ["..."], "historyContradiction": {"flag": false, "detail": ""}}.
- agreeability: 100 = clearly defensible, 0 = clearly unsupported.
- grounding: how well the note supports the code.
- noteExcerpts: verbatim snippets from the note that support or refute the code.
- historyContradiction: if patient history is provided and the code contradicts it (e.g. billing for a body part that was amputated/removed), set flag=true and explain.`;

const CHART_SUMMARY_PROMPT: DocSection = {
  heading: "Prior Chart Summary",
  instructions: {
    contentPrompt:
      "Summarize the patient's prior medical history. Highlight conditions, prior procedures, and any amputations or removed organs that would contradict billing for services on those body parts.",
    writingStylePrompt: "Concise, clinical, factual.",
  },
  outputSchema: { type: "string" },
};

/** Retrace a single billed-not-predicted code. */
export async function retraceCode(
  client: CortiClient,
  c: Case,
  code: string,
  description: string,
  timeoutMs: number,
): Promise<RetraceResult> {
  // For history cases, generate a chart summary first (textgen showcase).
  let chartSummary = "";
  if (c.patient_profile || c.prior_history) {
    try {
      const historyText = c.prior_history ?? JSON.stringify(c.patient_profile, null, 2);
      const doc = await client.generateDocument([CHART_SUMMARY_PROMPT], historyText, "FraudLens chart summary");
      chartSummary = doc.text;
    } catch {
      // best-effort; proceed without chart summary
    }
  }

  const prompt = buildRetracePrompt(c, code, description, chartSummary);
  let agentId: string | null = null;
  try {
    agentId = await client.createReasoningAgent(
      `FraudLens_retrace_${code}`,
      "Assess defensibility of a single billed code.",
      RETRACE_SYSTEM_PROMPT,
    );
    const raw = await client.sendReasoningMessage(agentId, prompt, c.clinical_note, Math.max(timeoutMs, 120_000));
    const parsed = parseRetraceResponse(raw, code, description);
    return parsed;
  } finally {
    if (agentId) await client.deleteAgent(agentId);
  }
}

/** Run retrace over all billed-not-predicted codes. */
export async function retraceAll(
  client: CortiClient,
  c: Case,
  predictedCodes: { procedures: string[]; dx: string[] },
  timeoutMs: number,
): Promise<{ analyses: CodeAnalysis[]; findings: RetraceResult[] }> {
  const predictedProcSet = new Set(predictedCodes.procedures);
  const predictedDxSet = new Set(predictedCodes.dx);
  const analyses: CodeAnalysis[] = [];
  const findings: RetraceResult[] = [];

  // Retrace billed procedures not predicted.
  for (const p of c.submitted_codes.procedures) {
    const predicted = predictedProcSet.has(p.code);
    if (predicted) {
      analyses.push({
        code: p.code, description: p.description, predicted, match: "exact",
        agreeability: 100, grounding: "supported", noteExcerpts: [], confidence: 0.95,
      });
      continue;
    }
    const result = await retraceCode(client, c, p.code, p.description, timeoutMs);
    analyses.push(result.analysis);
    findings.push(result);
  }

  // Retrace billed dx not predicted (dx-inflation check).
  for (const dx of c.submitted_codes.dx) {
    const predicted = predictedDxSet.has(dx.code);
    if (predicted) {
      analyses.push({
        code: dx.code, description: dx.description, predicted, match: "exact",
        agreeability: 100, grounding: "supported", noteExcerpts: [], confidence: 0.95,
      });
      continue;
    }
    const result = await retraceCode(client, c, dx.code, dx.description, timeoutMs);
    analyses.push(result.analysis);
    findings.push(result);
  }

  return { analyses, findings };
}

function buildRetracePrompt(c: Case, code: string, description: string, chartSummary: string): string {
  const parts = [
    `Billed code: ${code} (${description}). The coding model did NOT predict this code from the note.`,
    `Assess whether this code is defensible based on the clinical note below. Return JSON only.`,
  ];
  if (chartSummary) {
    parts.push(`Patient prior history (from chart summary): ${chartSummary}`);
    parts.push(`If this billed code contradicts the prior history (e.g. the body part was amputated/removed), set historyContradiction.flag=true.`);
  }
  return parts.join("\n");
}

function parseRetraceResponse(raw: string, code: string, description: string): RetraceResult {
  const empty: RetraceResult = {
    analysis: {
      code, description, predicted: false, match: "extra",
      agreeability: 20, grounding: "unsupported", noteExcerpts: [], confidence: 0.4,
    },
    rationale: "Agent did not return a parseable response.",
  };
  if (!raw) return empty;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return empty;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<RetraceAgentResponse>;
    const agreeability = clamp(Number(obj.agreeability ?? 20), 0, 100);
    const grounding = obj.grounding ?? "unsupported";
    const reasoning = String(obj.reasoning ?? "");
    const noteExcerpts = Array.isArray(obj.noteExcerpts) ? obj.noteExcerpts.map(String) : [];
    const historyContradiction = obj.historyContradiction?.flag
      ? { flag: true, detail: String(obj.historyContradiction.detail ?? "") }
      : undefined;
    return {
      analysis: {
        code, description, predicted: false, match: "extra",
        agreeability, grounding, noteExcerpts, historyContradiction,
        confidence: grounding === "supported" ? 0.9 : grounding === "contradicted" ? 0.85 : 0.6,
      },
      rationale: reasoning,
    };
  } catch {
    return empty;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
