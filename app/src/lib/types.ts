// Core domain types — the single typed contract for cases, pipeline results, and the UI.
// Drives the synthetic generator, the adapter interface, replay fixtures, and every screen.

export type FraudType =
  | "upcoding"
  | "unbundling"
  | "phantom"
  | "dx_inflation"
  | "cloning"
  | "clean";

export type Severity = "fraud" | "error" | "clean";

export type AgentStatus = "pending" | "running" | "done";

/** A provider (billing entity). */
export interface Provider {
  id: string; // "P-001"
  npi: string; // 10-digit, Luhn-valid
  name: string; // "Dr. Elias Mercer"
  specialty: string; // "Internal Medicine"
  type: "individual" | "organization";
  state: string; // "FL"
  zip5: string;
  taxonomy: string;
}

/** Patient demographics (synthetic, no PII). */
export interface Patient {
  mrn: string; // "M-1001"
  age_band: "0-17" | "18-39" | "40-64" | "65+";
  sex: "M" | "F" | "X";
}

export type EncounterType = "office" | "er" | "inpatient" | "asc" | "outpatient";

export interface Encounter {
  date: string; // ISO date
  pos: number; // place of service: 11 office, 22 outpatient, 23 ER, 24 ASC, 21 inpatient
  type: EncounterType;
}

export interface DiagnosisCode {
  code: string; // ICD-10-CM, e.g. "E11.9"
  description: string;
}

export interface ProcedureCode {
  code: string; // CPT/HCPCS, e.g. "99213"
  description: string;
  units: number;
  modifiers: string[]; // e.g. ["-59"]
  charge: number; // USD billed for this line
  /** Indices into the diagnosis array that justify this procedure (medical necessity). */
  supporting_dx_index: number[];
}

/** A verbatim span of the clinical note that grounds a code. */
export interface EvidenceSpan {
  code: string; // the code this span supports
  start: number; // char offset into clinical_note
  end: number; // char offset (exclusive)
  text: string; // verbatim excerpt
}

/** The raw submitted claim + clinical note (input). */
export interface Case {
  case_id: string; // "C-2026-0042"
  provider_id: string; // FK to Provider.id
  patient: Patient;
  encounter: Encounter;
  submitted_codes: {
    dx: DiagnosisCode[];
    procedures: ProcedureCode[];
  };
  clinical_note: string;
  evidence_spans: EvidenceSpan[];
  billed_total: number;
  paid_total: number;
  /** Optional structured patient history for chart-verification (amputation/contradiction cases). */
  patient_profile?: PatientProfile;
  /** Optional free-text prior chart summary for the extended-verification agent. */
  prior_history?: string;
  /** Ground-truth label used by the generator and the demo; never shown as a raw field in the UI. */
  planted_fraud: {
    type: FraudType | "clean";
    severity: Severity;
    detail: string;
    expected_code?: string; // the code that *should* have been billed
    submitted_code?: string; // the code that *was* billed
    dollar_delta?: number; // per-claim overpayment
  } | null;
}

/** Structured patient history for the extended chart-verification agent. */
export interface PatientProfile {
  patient_id: string;
  name?: string;
  date_of_birth?: string;
  conditions: {
    condition: string;
    status: "active" | "resolved" | "amputated" | "removed" | "chronic";
    date?: string;
    notes?: string;
  }[];
  procedures: { procedure: string; date?: string; notes?: string }[];
  medications: string[];
}

/** One step in the agent trace shown as a streaming card in the UI. */
export interface AgentCard {
  id: string;
  title: string; // "Extract clinical facts", "Predict codes", ...
  status: AgentStatus;
  summary: string; // one-line outcome
  duration_ms: number; // simulated/real duration for pacing
}

/** Per-code retrace output from the grounding agent. */
export interface CodeAnalysis {
  /** The submitted (billed) code under scrutiny. */
  code: string;
  description: string;
  /** Was it predicted by our coding expert? */
  predicted: boolean;
  /** Set-intersection verdict: exact (common), extra (billed-not-predicted → investigate), missing (predicted-not-billed), mismatch. */
  match: "exact" | "extra" | "missing" | "mismatch";
  /** Per-code defensibility from the retrace agent (0-100). High = minor miss; low = likely fraud. */
  agreeability: number;
  /** How well the note supports the code. */
  grounding: "supported" | "weakly_supported" | "unsupported" | "contradicted";
  /** Verbatim note excerpts the agent cited as evidence (char spans, when available). */
  noteExcerpts: string[];
  /** Optional history-contradiction flag from chart verification (e.g. amputation). */
  historyContradiction?: { flag: boolean; detail: string };
  /** Fraud category assigned to this code by the judgement agent. */
  category?: FraudType;
  /** Per-code verdict. */
  verdict?: "fraud" | "error" | "clean";
  /** Confidence 0-1. */
  confidence: number;
  /** Plain-language reasoning from the retrace agent (when present). */
  rationale?: string;
}

/** A per-code finding produced by the agentic pipeline. */
export interface Finding {
  code: string; // the submitted code under scrutiny
  fraud_type: FraudType;
  confidence: number; // 0-1
  grounding_score: number; // 0-1, how well the note supports the code
  dollar_impact: number; // USD, deterministic
  rationale: string; // plain-language why
  evidence_spans: EvidenceSpan[];
  agent_trace: AgentCard[];
  /** "Likely Fraud" (intent) vs "Possible Error" (no intent pattern). */
  intent: "fraud" | "error";
  /** Per-code retrace detail (agreeability, grounding, excerpts) — the crux output. */
  analysis?: CodeAnalysis;
}

/** The pipeline output for a case (computed live or cached for replay). */
export interface CaseResult {
  case_id: string;
  predicted_codes: {
    dx: DiagnosisCode[];
    procedures: ProcedureCode[];
  };
  findings: Finding[];
  case_summary: string;
  total_impact: number; // sum of finding dollar_impact
  max_confidence: number;
  agent_trace: AgentCard[]; // case-level agent cards
  /** Per-code analysis from the set-intersection + retrace. */
  code_analyses?: CodeAnalysis[];
  /** Generated legal brief (textgen: deterministic multi-section brief + optional Guided Docs narrative), first-class output. */
  legal_brief?: string;
  /** Live vs replay provenance. */
  source?: "live" | "replay";
  /** Honesty signal: did the detector independently arrive at the planted fraud type? */
  detected?: boolean;
}

/** Provider-level aggregate for the pattern dashboard. */
export interface ProviderAggregate {
  provider_id: string;
  provider: Provider;
  case_count: number;
  flagged_case_count: number;
  total_impact: number; // summed $ across flagged cases
  max_confidence: number;
  /** Count of findings by fraud type. */
  flags_by_type: Record<FraudType, number>;
  /** Top CPT codes by volume, with provider count + peer median. */
  top_codes: {
    code: string;
    description: string;
    provider_count: number;
    peer_median: number;
  }[];
  /** E/M level distribution (99202-99215) provider share vs peer share. */
  em_distribution: {
    level: string; // "99213"
    provider_share: number; // 0-1
    peer_share: number; // 0-1
  }[];
  /** 18-month monthly flagged $ impact, provider vs peer baseline. */
  monthly_trend: {
    month: string; // "2025-03"
    provider_impact: number;
    peer_baseline: number;
  }[];
}

/** Role toggle for the light reskin. */
export type Role = "investigator" | "provider" | "relator";

/** A row in the case worklist (lightweight projection of a Case + its CaseResult). */
export interface WorklistRow {
  case_id: string;
  provider_name: string;
  provider_id: string;
  specialty: string;
  state: string;
  encounter_date: string;
  fraud_types: FraudType[];
  risk_score: number; // 0-100, derived from max_confidence + impact
  est_impact: number; // USD
  status: "new" | "review" | "referred" | "closed";
  intent: "fraud" | "error" | "clean";
}
