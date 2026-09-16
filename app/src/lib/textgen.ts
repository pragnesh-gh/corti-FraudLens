// Legal brief generator — first-class output for the attorney/relator ICP.
//
// The brief is built DETERMINISTICALLY by `buildLegalBrief` (a pure module,
// `./legal-brief.ts`) from the case + detector findings: a rich, multi-section
// brief with accurate statutory citations (FCA §3729, qui-tam §3730, criminal
// §1347, administrative §1320a-7), Escobar materiality, hedged disclaimers.
// This showcases the textgen capability: the LIVE path then OPTIONALLY appends
// an LLM-filled "Narrative Analysis" section generated via Corti Guided Docs
// (POST /v2/documents). If the LLM call fails or times out, the deterministic
// brief is returned alone — the live path is always robust.
//
// Proven on staging-eu (~0.011 credits). See memory/corti-api-surfaces.md.

import type { Case } from "./types";
import { CortiClient, type DocSection } from "./pipeline";
import type { CaseFinding } from "./agents/judgement";
import type { CodeAnalysis } from "./types";
import { buildLegalBrief, type BriefAnalysis, type BriefCode, type BriefFinding } from "./legal-brief";

/** Generate the legal brief. Deterministic multi-section skeleton (always
 *  returned) + optional LLM narrative appended via Guided Docs. */
export async function generateLegalBrief(
  client: CortiClient,
  c: Case,
  finding: CaseFinding,
  analyses: CodeAnalysis[],
  timeoutMs = 90_000,
): Promise<string> {
  // Build the rich deterministic brief from the case + finding + retrace analyses.
  const findingOpts: BriefFinding = {
    fraudType: finding.fraudType,
    verdict: finding.verdict,
    confidence: finding.confidence,
    summary: finding.summary,
    details: finding.details,
    rationale: finding.summary,
    dollarImpact: finding.findings.reduce((s, f) => s + f.dollar_impact, 0),
  };
  const analysisOpts: BriefAnalysis[] = analyses.map((a) => ({
    code: a.code,
    description: a.description,
    match: a.match,
    agreeability: a.agreeability,
    grounding: a.grounding,
    noteExcerpts: a.noteExcerpts,
    rationale: a.rationale,
    confidence: a.confidence,
  }));
  const billedCodes: BriefCode[] = [
    ...c.submitted_codes.dx.map((d) => ({ code: d.code, description: d.description })),
    ...c.submitted_codes.procedures.map((p) => ({ code: p.code, description: p.description, charge: p.charge })),
  ];

  // Try the LLM narrative via Guided Docs (best-effort — never breaks the brief).
  let liveNarrative: string | undefined;
  try {
    const sections = buildBriefSections(c, finding);
    const contextText = buildBriefContext(c, finding);
    const resp = await client.generateDocument(sections, contextText, "FraudLens legal narrative", timeoutMs);
    liveNarrative = resp.text;
  } catch {
    // LLM unavailable/timeout — the deterministic brief stands alone.
  }

  return buildLegalBrief({
    caseId: c.case_id,
    encounterDate: c.encounter.date,
    clinicalNote: c.clinical_note,
    billedCodes,
    finding: findingOpts,
    analyses: analysisOpts,
    totalImpact: finding.findings.reduce((s, f) => s + f.dollar_impact, 0),
    detected: !!c.planted_fraud,
    liveNarrative,
  });
}

/** The dynamic sections the LLM fills for the optional narrative (Guided Docs). */
function buildBriefSections(c: Case, finding: CaseFinding): DocSection[] {
  return [
    {
      heading: "Narrative Analysis",
      instructions: {
        contentPrompt: `Write a concise investigative narrative (2-4 paragraphs) tying the billing discrepancies to the clinical evidence. Fraud type: ${finding.fraudType}. Verdict: ${finding.verdict}. Confidence: ${finding.confidence}. Weave in the unsupported codes and why the documentation does not support them. Do not assert intent as fact — use hedged language.`,
        writingStylePrompt: "Clinical, precise, non-conclusory. Use 'may' and 'appears to' rather than definitive assertions.",
      },
      outputSchema: { type: "string" },
    },
  ];
}

function buildBriefContext(c: Case, finding: CaseFinding): string {
  return [
    `Case: ${c.case_id}`,
    `Encounter date: ${c.encounter.date}`,
    `Clinical note: ${c.clinical_note}`,
    `Billed procedures: ${c.submitted_codes.procedures.map((p) => `${p.code} (${p.description})`).join(", ")}`,
    `Billed diagnoses: ${c.submitted_codes.dx.map((d) => `${d.code} (${d.description})`).join(", ")}`,
    `Fraud type: ${finding.fraudType}`,
    `Verdict: ${finding.verdict}`,
    `Confidence: ${finding.confidence}`,
    `Summary: ${finding.summary}`,
    `Details: ${finding.details.join("; ")}`,
  ].join("\n");
}
