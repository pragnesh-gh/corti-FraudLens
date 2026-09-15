// CPT/ICD-10 code reference — real, concise descriptions used by the synthetic generator.

export interface CodeRef {
  code: string;
  description: string;
  /** Approximate Medicare charge (USD) — used for dollar-impact math. */
  charge: number;
}

// E/M (Evaluation & Management) office visits, established patient — tiered by MDM complexity.
// This tiering is the upcoding lever: higher level = higher charge.
export const EM_CODES: Record<string, CodeRef> = {
  "99211": { code: "99211", description: "Office visit, est. patient, minimal complexity", charge: 40 },
  "99212": { code: "99212", description: "Office visit, est. patient, low complexity", charge: 75 },
  "99213": { code: "99213", description: "Office visit, est. patient, moderate complexity", charge: 115 },
  "99214": { code: "99214", description: "Office visit, est. patient, high complexity", charge: 175 },
  "99215": { code: "99215", description: "Office visit, est. patient, very high complexity", charge: 240 },
};

// Common ancillary/procedure codes.
export const PROC_CODES: Record<string, CodeRef> = {
  "93000": { code: "93000", description: "ECG, complete, tracing + interpretation", charge: 175 },
  "80053": { code: "80053", description: "Comprehensive metabolic panel", charge: 90 },
  "85025": { code: "85025", description: "Complete blood count w/ differential", charge: 45 },
  "36415": { code: "36415", description: "Routine venipuncture", charge: 30 },
  "99000": { code: "99000", description: "Handling/transport of specimen", charge: 25 },
  // ECG components — classic unbundling of 93000 into 93000 + 93010 + 93005 should NOT be billed together.
  "93005": { code: "93005", description: "ECG, tracing only (technical component)", charge: 95 },
  "93010": { code: "93010", description: "ECG, interpretation only (professional component)", charge: 85 },
  // Vaccine admin + supply — often unbundled.
  "90471": { code: "90471", description: "Immunization administration, 1 vaccine", charge: 40 },
  "90658": { code: "90658", description: "Influenza vaccine, split-virus, preservative-free", charge: 25 },
};

// ICD-10-CM diagnosis codes.
export const DX_CODES: Record<string, CodeRef> = {
  "E11.9": { code: "E11.9", description: "Type 2 diabetes mellitus without complications", charge: 0 },
  "I10": { code: "I10", description: "Essential (primary) hypertension", charge: 0 },
  "E78.5": { code: "E78.5", description: "Hyperlipidemia, unspecified", charge: 0 },
  "M54.5": { code: "M54.5", description: "Low back pain", charge: 0 },
  "J06.9": { code: "J06.9", description: "Acute upper respiratory infection, unspecified", charge: 0 },
  "K21.9": { code: "K21.9", description: "Gastroesophageal reflux disease without esophagitis", charge: 0 },
  "F41.1": { code: "F41.1", description: "Generalized anxiety disorder", charge: 0 },
  "Z00.00": { code: "Z00.00", description: "Encounter for general adult medical exam w/o abnormal findings", charge: 0 },
  // Higher-severity variants used for dx-inflation.
  "E11.22": { code: "E11.22", description: "Type 2 diabetes mellitus with diabetic chronic kidney disease", charge: 0 },
  "I11.9": { code: "I11.9", description: "Hypertensive heart disease without heart failure", charge: 0 },
  "N18.3": { code: "N18.3", description: "Chronic kidney disease, stage 3", charge: 0 },
};

// Hand-built NCCI-style edit pairs: codes that should NOT be billed together.
// Column 1 = comprehensive code; Column 2 = component that's bundled into it.
// Billing both (often with -59) is the unbundling signal.
export const NCCI_EDITS: { col1: string; col2: string; reason: string }[] = [
  { col1: "93000", col2: "93005", reason: "93005 (ECG tracing) is bundled into 93000 (complete ECG). Billing both double-bills the technical component." },
  { col1: "93000", col2: "93010", reason: "93010 (ECG interpretation) is bundled into 93000 (complete ECG). Billing both double-bills the professional component." },
  { col1: "80053", col2: "85025", reason: "85025 (CBC w/ diff) is not separately payable with 80053 (comprehensive metabolic panel) on the same encounter unless distinct medical necessity." },
  { col1: "90471", col2: "90658", reason: "90658 (vaccine supply) administration is bundled into 90471 (immunization administration) — supply and admin are a single service." },
];
