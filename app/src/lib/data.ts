import type {
  Case,
  Provider,
  Patient,
  EvidenceSpan,
  CaseResult,
  Finding,
  AgentCard,
  FraudType,
  ProviderAggregate,
  WorklistRow,
  CodeAnalysis,
} from "./types";
import { EM_CODES, PROC_CODES, DX_CODES, NCCI_EDITS } from "./codes";

/**
 * Deterministic synthetic dataset: 6 providers, 140 cases, with planted fraud.
 * The villain "Dr. Elias Mercer" has a sustained multi-fraud pattern.
 *
 * This generator is the single source of truth for the demo — the UI, the
 * replay engine, and the pattern dashboard all read from its output.
 */

// Deterministic PRNG so the dataset is identical on every run.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260819);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

const PROVIDERS: Provider[] = [
  {
    id: "P-001",
    npi: "1345928703",
    name: "Dr. Elias Mercer",
    specialty: "Internal Medicine",
    type: "individual",
    state: "FL",
    zip5: "33101",
    taxonomy: "207R00000X",
  },
  {
    id: "P-002",
    npi: "1538294761",
    name: "Dr. Priya Nandakumar",
    specialty: "Family Medicine",
    type: "individual",
    state: "FL",
    zip5: "33139",
    taxonomy: "207Q00000X",
  },
  {
    id: "P-003",
    npi: "1629384705",
    name: "Dr. Marcus Field",
    specialty: "Cardiology",
    type: "individual",
    state: "FL",
    zip5: "33132",
    taxonomy: "207RC0000X",
  },
  {
    id: "P-004",
    name: "Bayfront Health Partners",
    npi: "1738405927",
    specialty: "Internal Medicine",
    type: "organization",
    state: "FL",
    zip5: "33136",
    taxonomy: "208D00000X",
  },
  {
    id: "P-005",
    npi: "1847506319",
    name: "Dr. Hannah Okafor",
    specialty: "Family Medicine",
    type: "individual",
    state: "FL",
    zip5: "33130",
    taxonomy: "207Q00000X",
  },
  {
    id: "P-006",
    npi: "1958617420",
    name: "Dr. Tomás Riveiro",
    specialty: "Internal Medicine",
    type: "individual",
    state: "FL",
    zip5: "33133",
    taxonomy: "207R00000X",
  },
];

const AGES: Patient["age_band"][] = ["0-17", "18-39", "40-64", "65+"];
const SEXES: Patient["sex"][] = ["M", "F"];

// ---- Clinical note templates ----
// Each returns the note text + the evidence span for the E/M level the note actually supports.
// "supportedEm" is the code the note truly justifies (the grounding truth for upcoding detection).

interface NoteTemplate {
  note: string;
  supportedEm: string; // the E/M level the note's MDM actually supports
  evidenceText: string; // the sentence that proves the MDM level
}

function lowComplexityNote(): NoteTemplate {
  const evidence =
    "Stable chronic conditions. No medication changes. MDM straightforward, minimal data reviewed.";
  return {
    note: `Established patient, routine follow-up. No new complaints. Vitals stable (BP 128/82, HR 74). ${evidence} Assessment: hypertension and hyperlipidemia, well controlled on current regimen. Plan: continue current medications, recheck labs in 6 months.`,
    supportedEm: "99212",
    evidenceText: evidence,
  };
}

function moderateComplexityNote(): NoteTemplate {
  const evidence =
    "MDM moderate: reviewed prior labs, addressed one stable chronic and one acute issue, adjusted one medication.";
  return {
    note: `Established patient. Reports intermittent mild dyspepsia over the past 2 weeks. Vitals BP 132/86. ${evidence} Assessment: GERD flare, hypertension stable. Plan: started on PPI, reevaluate in 4 weeks. Continue antihypertensive.`,
    supportedEm: "99213",
    evidenceText: evidence,
  };
}

function highComplexityNote(): NoteTemplate {
  const evidence =
    "MDM high: reviewed multiple data sources, addressed several chronic conditions with medication escalation, moderate risk of morbidity.";
  return {
    note: `Established patient with uncontrolled diabetes. Home glucose logs reviewed (avg 220 mg/dL). Reports polyuria. ${evidence} Assessment: T2DM poorly controlled, HTN, hyperlipidemia. Plan: added second-line agent, ordered HbA1c, nephrology referral.`,
    supportedEm: "99214",
    evidenceText: evidence,
  };
}

/** Build an evidence span object from a substring of the note. */
function spanFor(note: string, code: string, evidenceText: string): EvidenceSpan {
  const start = note.indexOf(evidenceText);
  if (start < 0) throw new Error(`Evidence text not found in note:\n${evidenceText}`);
  return { code, start, end: start + evidenceText.length, text: evidenceText };
}

// ---- Case construction helpers ----

function makePatient(i: number): Patient {
  return {
    mrn: `M-${(1000 + i).toString()}`,
    age_band: pick(AGES),
    sex: pick(SEXES),
  };
}

function isoDate(monthsAgo: number): string {
  // anchor "today" at the demo date 2026-09-15
  const d = new Date(2026, 8, 15);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(between(1, 28));
  return d.toISOString().slice(0, 10);
}

let caseCounter = 42;

function newCaseId(): string {
  return `C-2026-${(caseCounter++).toString().padStart(4, "0")}`;
}

interface BuildOpts {
  provider: Provider;
  monthsAgo: number;
  noteTpl: NoteTemplate;
  billedEm: string; // the E/M code actually BILLED (may differ from supported → upcoding)
  dxCodes: { code: string; description: string }[];
  procedures: {
    code: string;
    description: string;
    units: number;
    modifiers: string[];
    charge: number;
    supporting_dx_index: number[];
  }[];
  planted: Case["planted_fraud"];
  noteOverride?: string;
  evidenceOverride?: { code: string; text: string }[];
}

function buildCase(opts: BuildOpts): Case {
  const note = opts.noteOverride ?? opts.noteTpl.note;
  const evidence_spans: EvidenceSpan[] = [];

  if (opts.evidenceOverride) {
    for (const e of opts.evidenceOverride) {
      evidence_spans.push(spanFor(note, e.code, e.text));
    }
  } else {
    evidence_spans.push(spanFor(note, opts.billedEm, opts.noteTpl.evidenceText));
  }

  const billed_total = (EM_CODES[opts.billedEm]?.charge ?? 0) +
    opts.procedures.reduce((s, p) => s + p.charge * p.units, 0);

  return {
    case_id: newCaseId(),
    provider_id: opts.provider.id,
    patient: makePatient(caseCounter),
    encounter: { date: isoDate(opts.monthsAgo), pos: 11, type: "office" },
    submitted_codes: {
      dx: opts.dxCodes,
      procedures: [
        {
          code: opts.billedEm,
          description: EM_CODES[opts.billedEm].description,
          units: 1,
          modifiers: [],
          charge: EM_CODES[opts.billedEm].charge,
          supporting_dx_index: [0],
        },
        ...opts.procedures,
      ],
    },
    clinical_note: note,
    evidence_spans,
    billed_total,
    paid_total: billed_total,
    planted_fraud: opts.planted,
  };
}

const DX = (code: string) => ({ code, description: DX_CODES[code].description });

// ---- Generator: build all cases ----

function generateCases(): Case[] {
  const cases: Case[] = [];
  const villain = PROVIDERS[0];

  // ===== VILLAIN: Dr. Elias Mercer — 45 cases =====
  // Pattern: upcoding (99214/15 on low/moderate notes) + unbundling (ECG split, panel+CBC) + cloning.

  // The hero case: upcoding + unbundling together.
  {
    const tpl = lowComplexityNote();
    cases.push(
      buildCase({
        provider: villain,
        monthsAgo: 2,
        noteTpl: tpl,
        billedEm: "99215", // billed very-high; note supports minimal/low
        dxCodes: [DX("I10"), DX("E78.5")],
        procedures: [
          // Unbundling: bill complete ECG (93000) AND its bundled technical component
          // (93005) separately with a -59 modifier to bypass the NCCI edit.
          { code: "93000", description: PROC_CODES["93000"].description, units: 1, modifiers: [], charge: PROC_CODES["93000"].charge, supporting_dx_index: [0] },
          { code: "93005", description: PROC_CODES["93005"].description, units: 1, modifiers: ["-59"], charge: PROC_CODES["93005"].charge, supporting_dx_index: [0] },
        ],
        planted: {
          type: "upcoding",
          severity: "fraud",
          detail: "Billed 99215 (very high complexity) but the note documents a routine, stable follow-up with minimal MDM. Note supports 99212. ECG also unbundled: 93005 billed alongside 93000 with -59.",
          expected_code: "99212",
          submitted_code: "99215",
          dollar_delta: 200, // 240 - 40
        },
      }),
    );
  }

  // More villain cases: 37 upcoding cases (mix of low→high), ~half with unbundled ECG.
  // Villain total: 1 hero + 37 + 5 cloning + 1 dx-inflation + 1 phantom = 45.
  for (let i = 0; i < 37; i++) {
    const tpl = i % 3 === 0 ? lowComplexityNote() : moderateComplexityNote();
    const billed = i % 3 === 0 ? "99214" : "99215"; // both above what the note supports
    const dxSet = pick([
      [DX("I10"), DX("E78.5")],
      [DX("E11.9"), DX("I10")],
      [DX("K21.9")],
      [DX("M54.5"), DX("F41.1")],
    ]);
    // ~half also have an unbundled ECG: bill 93000 (complete) + 93005 (its bundled
    // technical component) together with -59 — a classic NCCI unbundling bypass.
    const procedures =
      i % 2 === 0
        ? [
            { code: "93000", description: PROC_CODES["93000"].description, units: 1, modifiers: [], charge: PROC_CODES["93000"].charge, supporting_dx_index: [0] },
            { code: "93005", description: PROC_CODES["93005"].description, units: 1, modifiers: ["-59"], charge: PROC_CODES["93005"].charge, supporting_dx_index: [0] },
          ]
        : [];
    cases.push(
      buildCase({
        provider: villain,
        monthsAgo: between(0, 18),
        noteTpl: tpl,
        billedEm: billed,
        dxCodes: dxSet,
        procedures,
        planted: {
          type: "upcoding",
          severity: "fraud",
          detail: `Billed ${billed} but the note supports ${tpl.supportedEm}.`,
          expected_code: tpl.supportedEm,
          submitted_code: billed,
          dollar_delta: EM_CODES[billed].charge - EM_CODES[tpl.supportedEm].charge,
        },
      }),
    );
  }

  // Cloning: 5 near-identical notes (same text) for the villain across patients.
  const cloneTpl = lowComplexityNote();
  for (let i = 0; i < 5; i++) {
    cases.push(
      buildCase({
        provider: villain,
        monthsAgo: between(1, 14),
        noteTpl: cloneTpl,
        billedEm: "99214",
        dxCodes: [DX("I10"), DX("E78.5")],
        procedures: [],
        noteOverride: cloneTpl.note, // identical text = clone signal
        planted: {
          type: "cloning",
          severity: "fraud",
          detail: "Clinical note is verbatim-identical to 4 other encounters for different patients.",
          submitted_code: "99214",
          expected_code: "99212",
          dollar_delta: 100,
        },
      }),
    );
  }

  // A couple phantom + dx-inflation on the villain (stubbed but visible flags)
  {
    const tpl = lowComplexityNote();
    cases.push(
      buildCase({
        provider: villain,
        monthsAgo: 4,
        noteTpl: tpl,
        billedEm: "99213",
        dxCodes: [DX("I10"), DX("N18.3")], // CKD stage 3 NOT mentioned anywhere in note → dx inflation
        procedures: [{ code: "80053", description: PROC_CODES["80053"].description, units: 1, modifiers: [], charge: PROC_CODES["80053"].charge, supporting_dx_index: [1] }],
        planted: {
          type: "dx_inflation",
          severity: "fraud",
          detail: "Diagnosis N18.3 (CKD stage 3) billed but never mentioned in the clinical note.",
          submitted_code: "N18.3",
          dollar_delta: 90,
        },
      }),
    );
  }
  {
    const tpl = lowComplexityNote();
    cases.push(
      buildCase({
        provider: villain,
        monthsAgo: 5,
        noteTpl: tpl,
        billedEm: "99213",
        dxCodes: [DX("I10")],
        procedures: [{ code: "93000", description: PROC_CODES["93000"].description, units: 1, modifiers: [], charge: PROC_CODES["93000"].charge, supporting_dx_index: [0] }],
        // Phantom: ECG billed but the note never mentions any cardiac complaint or ECG being performed.
        planted: {
          type: "phantom",
          severity: "fraud",
          detail: "ECG (93000) billed but the note documents no cardiac complaint and no ECG was performed.",
          submitted_code: "93000",
          dollar_delta: 175,
        },
      }),
    );
  }

  // ===== MINOR-ISSUE providers: P-002 and P-005, ~15 cases each =====
  // Occasional errors (flagged as "Possible Error", not fraud).
  for (const prov of [PROVIDERS[1], PROVIDERS[4]]) {
    for (let i = 0; i < 15; i++) {
      const isUpcodeError = i === 3; // one error each
      const tpl = moderateComplexityNote();
      const billed = isUpcodeError ? "99214" : "99213";
      const dxSet = pick([
        [DX("I10"), DX("E78.5")],
        [DX("J06.9")],
        [DX("K21.9")],
        [DX("F41.1")],
      ]);
      const procedures =
        isUpcodeError && i === 7
          ? [{ code: "85025", description: PROC_CODES["85025"].description, units: 1, modifiers: [], charge: PROC_CODES["85025"].charge, supporting_dx_index: [0] }]
          : [];
      cases.push(
        buildCase({
          provider: prov,
          monthsAgo: between(0, 18),
          noteTpl: tpl,
          billedEm: billed,
          dxCodes: dxSet,
          procedures,
          planted: isUpcodeError
            ? {
                type: "upcoding",
                severity: "error",
                detail: "Billed 99214 but note supports 99213. Isolated occurrence — no sustained pattern.",
                expected_code: "99213",
                submitted_code: "99214",
                dollar_delta: 60,
              }
            : null,
        }),
      );
    }
  }

  // ===== CLEAN controls: P-003, P-004, P-006 (~22/22/21 = 65) =====
  for (const prov of [PROVIDERS[2], PROVIDERS[3], PROVIDERS[5]]) {
    const n = prov.id === "P-006" ? 21 : 22;
    for (let i = 0; i < n; i++) {
      const tpl = pick([lowComplexityNote(), moderateComplexityNote(), highComplexityNote()]);
      const dxSet = pick([
        [DX("I10"), DX("E78.5")],
        [DX("E11.9"), DX("I10")],
        [DX("K21.9")],
        [DX("Z00.00")],
        [DX("J06.9")],
      ]);
      const hasEcg = chance(0.4);
      const procedures = hasEcg
        ? [{ code: "93000", description: PROC_CODES["93000"].description, units: 1, modifiers: [], charge: PROC_CODES["93000"].charge, supporting_dx_index: [0] }]
        : [];
      cases.push(
        buildCase({
          provider: prov,
          monthsAgo: between(0, 18),
          noteTpl: tpl,
          billedEm: tpl.supportedEm, // clean: billed matches what the note supports
          dxCodes: dxSet,
          procedures,
          planted: null,
        }),
      );
    }
  }

  return cases;
}

// ---- Pipeline: honest detection engine (the "replay" / offline fallback) ----
// IMPORTANT: this derives findings from the NOTE TEXT and the billed codes —
// never from `planted_fraud`. planted_fraud is the answer key only, used solely
// to compute the `detected` honesty signal ("did we independently arrive at it?").
// The live pipeline (pipeline.ts + lib/agents/*) replaces these heuristics with
// real Corti calls; this module is the deterministic offline fallback.

/** Map a note's documented MDM complexity to the E/M level it supports.
 *  Analysis is keyword/phrase-based on the clinical note text — NOT planted_fraud. */
function predictEmFromNote(c: Case): { code: string; confidence: number; evidence: string } {
  const note = c.clinical_note.toLowerCase();
  // MDM complexity signals (1995/97 E/M guidelines + 2021 MDM).
  const highSignals = ["mdm high", "moderate risk of morbidity", "uncontrolled", "multiple data sources", "medication escalation", "severe", "escalation"];
  const moderateSignals = ["mdm moderate", "one stable chronic and one acute", "adjusted one medication", "prescription drug management", "acute uncomplicated"];
  const minimalSignals = ["mdm straightforward", "minimal data", "no medication changes", "stable chronic conditions", "self-limited"];
  const score = (sigs: string[]) => sigs.reduce((n, s) => n + (note.includes(s) ? 1 : 0), 0);
  const high = score(highSignals);
  const moderate = score(moderateSignals);
  const minimal = score(minimalSignals);
  // Pick the level with the strongest signal; tie-break downward (conservative).
  if (high > moderate && high > minimal) return { code: "99214", confidence: 0.78, evidence: "high-complexity MDM signals in note" };
  if (moderate > minimal) return { code: "99213", confidence: 0.82, evidence: "moderate-complexity MDM signals in note" };
  if (minimal > 0) return { code: "99212", confidence: 0.8, evidence: "minimal/straightforward MDM signals in note" };
  return { code: "99213", confidence: 0.5, evidence: "default moderate (no strong MDM signal)" };
}

/** Detect upcoding: billed E/M level exceeds what the note supports. */
function detectUpcoding(c: Case, trace: AgentCard[]): Finding | null {
  const billedEm = c.submitted_codes.procedures[0]?.code ?? "";
  if (!billedEm.startsWith("992")) return null;
  const supported = predictEmFromNote(c);
  const billedVal = parseInt(billedEm, 10);
  const supportedVal = parseInt(supported.code, 10);
  if (billedVal <= supportedVal) return null; // billed at or below supported → no upcoding
  const delta = EM_CODES[billedEm].charge - EM_CODES[supported.code].charge;
  const span = c.evidence_spans.find((e) => e.code === billedEm) ?? null;
  return {
    code: billedEm,
    fraud_type: "upcoding",
    confidence: supported.confidence,
    grounding_score: 0.2,
    dollar_impact: delta,
    rationale: `Billed ${billedEm} (${EM_CODES[billedEm].description.toLowerCase()}) but the note documents ${supported.evidence} — supports ${supported.code}.`,
    evidence_spans: span ? [span] : [],
    agent_trace: trace,
    intent: "fraud",
    analysis: {
      code: billedEm,
      description: EM_CODES[billedEm].description,
      predicted: false,
      match: "extra",
      agreeability: 15,
      grounding: "contradicted",
      noteExcerpts: supported.evidence ? [supported.evidence] : [],
      category: "upcoding",
      verdict: "fraud",
      confidence: supported.confidence,
    },
  };
}

/** Detect unbundling: NCCI edit pairs billed together. Pure code-set check. */
function detectUnbundling(c: Case, trace: AgentCard[]): Finding[] {
  const submittedProcCodes = c.submitted_codes.procedures.map((p) => p.code);
  const out: Finding[] = [];
  for (const edit of NCCI_EDITS) {
    if (submittedProcCodes.includes(edit.col1) && submittedProcCodes.includes(edit.col2)) {
      out.push({
        code: `${edit.col1}+${edit.col2}`,
        fraud_type: "unbundling",
        confidence: 0.86,
        grounding_score: 0.3,
        dollar_impact: PROC_CODES[edit.col2]?.charge ?? 85,
        rationale: edit.reason,
        evidence_spans: [],
        agent_trace: trace,
        intent: "fraud",
        analysis: {
          code: edit.col2,
          description: PROC_CODES[edit.col2]?.description ?? edit.col2,
          predicted: false,
          match: "extra",
          agreeability: 10,
          grounding: "unsupported",
          noteExcerpts: [],
          category: "unbundling",
          verdict: "fraud",
          confidence: 0.86,
        },
      });
    }
  }
  return out;
}

/** Detect dx-inflation: a billed diagnosis code is never mentioned in the note. */
function detectDxInflation(c: Case, trace: AgentCard[]): Finding | null {
  const note = c.clinical_note.toLowerCase();
  for (const dx of c.submitted_codes.dx) {
    // Z00.00 (wellness) and common chronic dx are expected; check the higher-severity ones.
    const desc = (DX_CODES[dx.code]?.description ?? dx.description).toLowerCase();
    // Heuristic: if the diagnosis's key term isn't in the note at all, flag it.
    const keyTerm = desc.split(/,| without| with /)[0].trim();
    if (keyTerm && !note.includes(keyTerm) && !note.includes(dx.code.toLowerCase())) {
      // Avoid false positives on common wellness/chronic codes the note may paraphrase.
      if (["essential hypertension", "hyperlipidemia", "encounter for general"].some((t) => desc.includes(t))) continue;
      return {
        code: dx.code,
        fraud_type: "dx_inflation",
        confidence: 0.78,
        grounding_score: 0.08,
        dollar_impact: 90,
        rationale: `Diagnosis ${dx.code} (${dx.description}) billed but never mentioned in the clinical note.`,
        evidence_spans: [],
        agent_trace: trace,
        intent: "fraud",
        analysis: {
          code: dx.code,
          description: dx.description,
          predicted: false,
          match: "extra",
          agreeability: 8,
          grounding: "unsupported",
          noteExcerpts: [],
          category: "dx_inflation",
          verdict: "fraud",
          confidence: 0.78,
        },
      };
    }
  }
  return null;
}

/** Detect phantom billing: a procedure is billed but the note mentions neither
 *  the procedure nor a relevant complaint. E.g. ECG billed with no cardiac mention. */
function detectPhantom(c: Case, trace: AgentCard[]): Finding | null {
  const note = c.clinical_note.toLowerCase();
  const phantomHints: Record<string, string[]> = {
    "93000": ["ecg", "ekg", "electrocardiogram", "cardiac", "chest pain", "palpitation", "arrhythmia", "atrial fibrillation"],
    "80053": ["metabolic panel", "lab", "labs", "blood test", "chemistry"],
    "85025": ["cbc", "blood count", "lab", "labs", "blood test", "anemia"],
  };
  for (const p of c.submitted_codes.procedures) {
    const hints = phantomHints[p.code];
    if (!hints) continue;
    if (hints.some((h) => note.includes(h))) continue; // note supports it
    return {
      code: p.code,
      fraud_type: "phantom",
      confidence: 0.82,
      grounding_score: 0.05,
      dollar_impact: p.charge,
      rationale: `Procedure ${p.code} (${p.description}) billed but the note documents no supporting complaint or service.`,
      evidence_spans: [],
      agent_trace: trace,
      intent: "fraud",
      analysis: {
        code: p.code,
        description: p.description,
        predicted: false,
        match: "extra",
        agreeability: 5,
        grounding: "contradicted",
        noteExcerpts: [],
        category: "phantom",
        verdict: "fraud",
        confidence: 0.82,
      },
    };
  }
  return null;
}

/** Detect cloning: the note is verbatim-identical to other cases in the dataset. */
function detectCloning(allCases: Case[], c: Case, trace: AgentCard[]): Finding | null {
  if (c.clinical_note.length < 80) return null;
  const dupes = allCases.filter((o) => o.case_id !== c.case_id && o.clinical_note === c.clinical_note);
  if (dupes.length < 2) return null;
  return {
    code: c.submitted_codes.procedures[0]?.code ?? "",
    fraud_type: "cloning",
    confidence: 0.88,
    grounding_score: 0.4,
    dollar_impact: 100,
    rationale: `Clinical note is verbatim-identical to ${dupes.length} other encounters for different patients.`,
    evidence_spans: [],
    agent_trace: trace,
    intent: "fraud",
    analysis: {
      code: c.submitted_codes.procedures[0]?.code ?? "",
      description: c.submitted_codes.procedures[0]?.description ?? "",
      predicted: true,
      match: "exact",
      agreeability: 12,
      grounding: "weakly_supported",
      noteExcerpts: [],
      category: "cloning",
      verdict: "fraud",
      confidence: 0.88,
    },
  };
}

/** Set-intersection comparison: billed vs predicted codes. */
function computeCodeAnalyses(c: Case, predictedEm: string): CodeAnalysis[] {
  const submittedProc = c.submitted_codes.procedures;
  const predictedSet = new Set([predictedEm, ...submittedProc.slice(1).map((p) => p.code)]);
  return submittedProc.map((p) => {
    const predicted = predictedSet.has(p.code);
    return {
      code: p.code,
      description: p.description,
      predicted,
      match: predicted ? "exact" : "extra",
      agreeability: predicted ? 100 : 20,
      grounding: predicted ? "supported" : "unsupported",
      noteExcerpts: [],
      confidence: predicted ? 0.95 : 0.4,
    };
  });
}

function makeAgentTrace(c: Case, predictedEm: string): AgentCard[] {
  return [
    { id: "facts", title: "Extract clinical facts", status: "done", summary: "MDM complexity, conditions, and procedures parsed from note.", duration_ms: 1100 },
    { id: "coding", title: "Predict medical codes", status: "done", summary: `Note supports E/M ${predictedEm} and listed procedures.`, duration_ms: 950 },
    { id: "grounding", title: "Ground unmatched codes", status: "done", summary: "Compared submitted vs predicted codes against note evidence.", duration_ms: 1300 },
    { id: "verify", title: "Extended chart verification", status: "done", summary: "Reviewed patient journal for supporting history.", duration_ms: 1500 },
    { id: "judgement", title: "Fraud vs error judgement", status: "done", summary: "Classified findings into fraud categories.", duration_ms: 1200 },
    { id: "impact", title: "Assess economic impact", status: "done", summary: "Computed overpayment from detected discrepancies.", duration_ms: 800 },
  ];
}

/** Honest derivation of findings from the note + billed codes (NOT planted_fraud). */
function computeFindings(allCases: Case[], c: Case, trace: AgentCard[], predictedEm: string): Finding[] {
  const findings: Finding[] = [];
  const up = detectUpcoding(c, trace);
  if (up) findings.push(up);
  findings.push(...detectUnbundling(c, trace));
  const dx = detectDxInflation(c, trace);
  if (dx) findings.push(dx);
  const ph = detectPhantom(c, trace);
  if (ph) findings.push(ph);
  const cl = detectCloning(allCases, c, trace);
  if (cl) findings.push(cl);
  return findings;
}

export function computeCaseResult(c: Case, allCases: Case[] = []): CaseResult {
  const siblings = allCases.length ? allCases : [c];
  const predicted = predictEmFromNote(c);
  const predictedEm = predicted.code;
  const trace = makeAgentTrace(c, predictedEm);
  const findings = computeFindings(siblings, c, trace, predictedEm);
  const total_impact = findings.reduce((s, f) => s + f.dollar_impact, 0);
  const code_analyses = computeCodeAnalyses(c, predictedEm);
  // Honesty signal: did the detector independently arrive at the planted fraud type?
  const detected = c.planted_fraud
    ? findings.some((f) => f.fraud_type === c.planted_fraud!.type) || (c.planted_fraud.type === "clean" && findings.length === 0)
    : findings.length === 0;
  return {
    case_id: c.case_id,
    predicted_codes: {
      dx: c.submitted_codes.dx,
      procedures: [
        { code: predictedEm, description: EM_CODES[predictedEm].description, units: 1, modifiers: [], charge: EM_CODES[predictedEm].charge, supporting_dx_index: [0] },
        ...c.submitted_codes.procedures.slice(1),
      ],
    },
    findings,
    case_summary: findings.length
      ? `${findings.length} finding${findings.length > 1 ? "s" : ""}: ${findings.map((f) => f.fraud_type).join(", ")}.`
      : "Codes align with the clinical note. No anomalies detected.",
    total_impact,
    max_confidence: findings.length ? Math.max(...findings.map((f) => f.confidence)) : 0,
    agent_trace: trace,
    code_analyses,
    source: "replay",
    detected,
  };
}

// ---- In-memory repository ----

let _cases: Case[] | null = null;
let _results: Map<string, CaseResult> | null = null;

function ensureBuilt(): void {
  if (_cases) return;
  _cases = generateCases();
  _results = new Map();
  for (const c of _cases) _results.set(c.case_id, computeCaseResult(c, _cases));
}

export function getProviders(): Provider[] {
  return PROVIDERS;
}

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getCases(): Case[] {
  ensureBuilt();
  return _cases!;
}

export function getCase(id: string): Case | undefined {
  ensureBuilt();
  return _cases!.find((c) => c.case_id === id);
}

export function getCaseResult(id: string): CaseResult | undefined {
  ensureBuilt();
  return _results!.get(id);
}

/** The hero case for the live demo — the villain's flagship upcoding+unbundling case. */
export function getHeroCaseId(): string {
  return getCases().find((c) => c.provider_id === "P-001" && c.planted_fraud?.type === "upcoding")?.case_id ?? "";
}

// ---- Worklist ----

function riskScore(c: Case, r: CaseResult): number {
  if (r.findings.length === 0) return 0;
  const conf = r.max_confidence * 60;
  const impact = Math.min(40, (r.total_impact / 5000) * 40);
  return Math.round(Math.min(100, conf + impact));
}

export function getWorklist(): WorklistRow[] {
  ensureBuilt();
  return _cases!
    .map((c) => {
      const r = _results!.get(c.case_id)!;
      const prov = getProvider(c.provider_id)!;
      const fraudTypes = [...new Set(r.findings.map((f) => f.fraud_type))] as FraudType[];
      const intent: "fraud" | "error" | "clean" = r.findings.some((f) => f.intent === "fraud")
        ? "fraud"
        : r.findings.some((f) => f.intent === "error")
          ? "error"
          : "clean";
      return {
        case_id: c.case_id,
        provider_name: prov.name,
        provider_id: prov.id,
        specialty: prov.specialty,
        state: prov.state,
        encounter_date: c.encounter.date,
        fraud_types: fraudTypes,
        risk_score: riskScore(c, r),
        est_impact: r.total_impact,
        status: r.findings.length ? ("new" as const) : ("closed" as const),
        intent,
      };
    })
    .sort((a, b) => b.risk_score - a.risk_score || b.est_impact - a.est_impact);
}

// ---- Provider aggregates (pattern dashboard) ----

export function getProviderAggregate(providerId: string): ProviderAggregate {
  ensureBuilt();
  const provider = getProvider(providerId)!;
  const provCases = _cases!.filter((c) => c.provider_id === providerId);
  const results = provCases.map((c) => _results!.get(c.case_id)!);

  const flaggedCases = provCases.filter((c) => (_results!.get(c.case_id)!.findings.length > 0));
  const flags_by_type: Record<FraudType, number> = {
    upcoding: 0, unbundling: 0, phantom: 0, dx_inflation: 0, cloning: 0,
  };
  for (const r of results) for (const f of r.findings) flags_by_type[f.fraud_type]++;

  // Top CPT codes by volume for this provider
  const codeCounts = new Map<string, { count: number; desc: string }>();
  for (const c of provCases) {
    for (const p of c.submitted_codes.procedures) {
      const existing = codeCounts.get(p.code);
      if (existing) existing.count++;
      else codeCounts.set(p.code, { count: 1, desc: p.description });
    }
  }
  const top = [...codeCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);

  // Peer median: across all OTHER providers
  const peerProviders = PROVIDERS.filter((p) => p.id !== providerId);
  const top_codes = top.map(([code, { count, desc }]) => {
    let peerSum = 0;
    for (const pp of peerProviders) {
      const pc = _cases!.filter((c) => c.provider_id === pp.id);
      const pCount = pc.reduce((s, c) => s + c.submitted_codes.procedures.filter((p) => p.code === code).length, 0);
      peerSum += pCount;
    }
    const peer_median = Math.round(peerSum / peerProviders.length);
    return { code, description: desc, provider_count: count, peer_median };
  });

  // E/M distribution
  const emLevels = ["99211", "99212", "99213", "99214", "99215"];
  const provEmTotal = provCases.reduce((s, c) => s + c.submitted_codes.procedures.length, 0) || 1;
  const peerCasesAll = _cases!.filter((c) => c.provider_id !== providerId);
  const peerEmTotal = peerCasesAll.reduce((s, c) => s + c.submitted_codes.procedures.length, 0) || 1;
  const em_distribution = emLevels.map((level) => ({
    level,
    provider_share: provCases.filter((c) => c.submitted_codes.procedures.some((p) => p.code === level)).length / provCases.length,
    peer_share: peerCasesAll.filter((c) => c.submitted_codes.procedures.some((p) => p.code === level)).length / peerCasesAll.length,
  }));

  // 18-month trend
  const months: string[] = [];
  const base = new Date(2026, 8, 1);
  for (let i = 17; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`);
  }
  const monthly_trend = months.map((m) => {
    const provImpact = results
      .filter((r) => {
        const c = provCases.find((cc) => cc.case_id === r.case_id)!;
        return c.encounter.date.slice(0, 7) === m;
      })
      .reduce((s, r) => s + r.total_impact, 0);
    const peerImpact = peerCasesAll
      .filter((c) => c.encounter.date.slice(0, 7) === m)
      .reduce((s, c) => s + _results!.get(c.case_id)!.total_impact, 0) / peerProviders.length;
    return { month: m, provider_impact: provImpact, peer_baseline: Math.round(peerImpact) };
  });

  return {
    provider_id: providerId,
    provider,
    case_count: provCases.length,
    flagged_case_count: flaggedCases.length,
    total_impact: results.reduce((s, r) => s + r.total_impact, 0),
    max_confidence: results.length ? Math.max(...results.map((r) => r.max_confidence)) : 0,
    flags_by_type,
    top_codes,
    em_distribution,
    monthly_trend,
  };
}

export function getAllProviderAggregates(): ProviderAggregate[] {
  return PROVIDERS.map((p) => getProviderAggregate(p.id));
}
