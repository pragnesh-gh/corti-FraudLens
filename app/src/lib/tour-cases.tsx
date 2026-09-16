/**
 * Tour case registry — the source of truth for every guided tour.
 *
 * Each case hardcodes its clinical note, billed/correct codes, fraud signals,
 * and the 7-step script verbatim from docs/eval-cases.json. The TourEngine +
 * step renderers in src/components/tour/tour-engine.tsx consume a TourCase and
 * adapt the layout to the fraud type.
 *
 * Cases:
 *   1. case_padding_002  — diagnosis padding (risk-adjustment, N18.3 CKD)
 *   2. case_upcoding_001  — upcoding (FFS, I11.9 hypertensive heart disease)
 *   3. case_unbundling_003 — unbundling (FFS, ECG 93000 + 93005)
 *   4. case_phantom_004  — phantom billing (FFS, ECG on a cough visit)
 */

import {
  FileText,
  Stethoscope,
  HeartPulse,
  TrendingUp,
  DollarSign,
  ScanSearch,
  Gavel,
  BrainCircuit,
  Scissors,
  Ghost,
  Copy,
  History,
  CheckCircle2,
} from "lucide-react";
import { formatUSD } from "@/lib/utils";
import type { FraudType } from "@/lib/types";
import type { TourCase } from "@/components/tour/tour-types";

// Shared 7-step arc. The middle steps now show the DETECTION METHOD:
//   intro → note → billed → predicted → retrace → impact → verdict
// The "predicted" step shows what our coding expert predicted (set-intersection
// compare); the "retrace" step shows the agentic framework reasoning about each
// over-billed code. Both source from the real precomputed pipeline output
// (getCaseResult), not hand-authored truth. Durations tuned to the original tour;
// the verdict step has duration 0 so auto-advance stops there.
const STEP_IDS = ["intro", "note", "billed", "predicted", "retrace", "impact", "verdict"] as const;

function baseSteps(
  overrides: Partial<Record<(typeof STEP_IDS)[number], { title: string; subtitle: string; duration: number }>>,
) {
  const defaults: Record<(typeof STEP_IDS)[number], { title: string; subtitle: string; duration: number }> = {
    intro: { title: "The case", subtitle: "", duration: 2600 },
    note: { title: "The clinical note", subtitle: "What the chart actually documents. Read it carefully.", duration: 4200 },
    billed: { title: "What was billed", subtitle: "The submitted codes — the provider's transcript.", duration: 4200 },
    predicted: { title: "What our coding expert predicted", subtitle: "The codes our Corti coding model predicts from the note — set-intersected with the billed codes.", duration: 4200 },
    retrace: { title: "The retrace agent", subtitle: "The agentic framework reasons about each over-billed code: is it defensible?", duration: 5600 },
    impact: { title: "Why it pays", subtitle: "", duration: 5600 },
    verdict: { title: "Verdict", subtitle: "", duration: 0 },
  };
  return STEP_IDS.map((id) => ({ id, ...defaults[id], ...(overrides[id] ?? {}) }));
}

// ---------------------------------------------------------------------------
// 1. case_padding_002 — diagnosis padding (risk-adjustment)
//    N18.30 CKD stage 3 on a wellness visit. The original tour.
//    Dollar impact grounded in the CMS-HCC model: N18.30 → V28 HCC 329,
//    coeff 0.127 → ~$1,650–1,720/yr added capitated payment at the CMS 2025
//    MA base (USPCC $13,570/yr, V28 normalization 1.045). See
//    docs/research-demo-categories.md §4.3.
// ---------------------------------------------------------------------------

// HCC risk-score → dollar impact (CMS-published, V28 model).
// 0.127 coeff × $13,570/yr base ≈ $1,723/yr (raw); ÷1.045 norm ≈ $1,649/yr.
const HCC_N18_PER_YEAR = 1692; // ~$1,650–1,720/yr headline figure

const PADDING_002: TourCase = {
  caseId: "case_padding_002",
  fraudType: "dx_inflation",
  billingModel: "risk_adjustment",
  billingModelLabel: "Medicare Advantage · risk-adjusted",
  demo: true, // presentation Case 1 — basic, precomputed intro
  teaser: "A CKD stage 3 diagnosis billed on a wellness visit — with no renal labs anywhere in the note.",
  noteText:
    "CC: Annual wellness visit.\n\nHistory: 68yo male presents for Medicare annual wellness visit. Reports feeling well overall. On lisinopril for blood pressure, well-controlled. Denies chest pain, dyspnea, cough, edema, or urinary symptoms. No recent hospitalizations.\n\nExam: BP 128/78, HR 70. Lungs clear bilaterally, no wheezes or crackles. Heart regular rate and rhythm. No peripheral edema. Extremities normal.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril.\n2. Medicare annual wellness visit completed, no new concerns.",
  correctCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "Z00.00", description: "Encounter for general adult medical exam without abnormal findings", fraudulent: false },
  ],
  billedCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "Z00.00", description: "Encounter for general adult medical exam without abnormal findings", fraudulent: false },
    {
      code: "N18.30",
      description: "Chronic kidney disease, stage 3 (unspecified)",
      fraudulent: true,
      flagReason: "No renal labs (creatinine/eGFR), no CKD history, no nephrology mention anywhere in note",
    },
  ],
  fraudCode: "N18.30",
  fraudConfidence: 0.79,
  fraudGrounding: 0.08,
  missingEvidenceSpans: [
    "Denies chest pain, dyspnea, cough, edema, or urinary symptoms.",
    "Lungs clear bilaterally, no wheezes or crackles.",
    "No peripheral edema. Extremities normal.",
  ],
  proofHeadline:
    "Look for any mention of kidneys, renal labs, creatinine, eGFR, or CKD. There is none.",
  proofBody:
    "No creatinine. No eGFR. No urinalysis. No \"chronic kidney disease\" anywhere. A stage-3 CKD diagnosis needs a sustained eGFR 30–59 — and there are no renal labs in the note.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A Medicare Advantage wellness visit — and a diagnosis that shouldn't be there.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "No CKD diagnosis appears — the note supports hypertension and a wellness visit only.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "N18.30 is over-billed. The agent asks: is a stage-3 CKD code defensible from this note?",
      duration: 5600,
    },
    impact: {
      title: "Why it pays",
      subtitle: "N18.30 is an HCC code. Here's how a diagnosis, not a procedure, becomes money.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Diagnosis padding · Likely Fraud · no procedure or higher E/M level needed.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Medicare annual wellness" },
    { icon: HeartPulse, label: "Patient", value: "68yo male, feels well, BP controlled" },
    { icon: FileText, label: "Payer model", value: "Medicare Advantage — capitated, risk-adjusted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          In <span className="font-semibold">fee-for-service</span>, fraud usually means a
          higher-priced <em>procedure</em>. But Medicare Advantage pays plans a{" "}
          <span className="font-semibold text-[var(--accent)]">capitated, risk-adjusted</span> rate
          per member.
        </>
      ),
    },
    {
      body: (
        <>
          The patient's <span className="font-medium text-[var(--foreground)]">risk score</span> is
          driven by submitted <span className="font-medium text-[var(--foreground)]">diagnoses</span>.
          A sicker diagnosis raises the payment —{" "}
          <span className="font-medium">no extra procedure or higher E/M level required</span>. The
          diagnosis <em>is</em> the money.
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: N18.30",
  mismatchSubtitle: "Billed as CKD stage 3 — with nothing in the note to back it.",
  mismatchTruthValue: "Nothing",
  mismatchTruthCaption: "No renal labs, no CKD history, no nephrology",
  impactTitle: "Why a diagnosis pays",
  impactSubtitle:
    "N18.30 is an HCC code — the diagnosis itself inflates the plan's payment.",
  impactNodes: [
    {
      icon: FileText,
      label: "N18.30 submitted",
      sub: "an HCC-eligible diagnosis",
      color: "var(--fraud-dx-inflation)",
      soft: "var(--risk-med-soft)",
    },
    {
      icon: TrendingUp,
      label: "Risk score rises",
      sub: "V28 HCC 329 · +0.127 to the member",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Capitated payment ↑",
      sub: `+${formatUSD(HCC_N18_PER_YEAR)}/yr to the plan`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim HCC uplift", value: `${formatUSD(HCC_N18_PER_YEAR)}/yr` },
    { label: "Risk-score delta", value: "+0.127 (V28 HCC 329)" },
    { label: "Similar claims detected", value: "45" },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> no procedure was upcoded and no E/M
      level was inflated. The provider billed the same wellness visit — but added{" "}
      <span className="font-mono font-semibold text-[var(--risk-high)]">N18.30</span> to the
      diagnosis list. In a risk-adjusted model, that single line raises the member's risk score by{" "}
      <span className="font-medium">0.127</span> (V28 HCC 329) — worth about{" "}
      <span className="font-medium">{formatUSD(HCC_N18_PER_YEAR)}/yr</span> in added capitated payment
      at the CMS 2025 base. <span className="font-medium">The diagnosis is the money.</span>
      <span className="mt-2 block text-[11px] text-[var(--muted-2)]">
        Impact = HCC coeff × CMS 2025 USPCC ($13,570/yr) ÷ V28 norm (1.045). Coeff from CMS-HCC model
        software; base rate from the CY2025 Rate Announcement.
      </span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Diagnosis Inflation" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "HCC uplift", value: `${formatUSD(HCC_N18_PER_YEAR)}/yr`, money: true },
    { icon: ScanSearch, label: "Evidence", value: "Zero grounding in note" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">No procedure or higher E/M level was needed.</span> The
      diagnosis itself is the money: <span className="font-mono">N18.30</span> is an HCC code that
      raised the patient's risk score (V28 HCC 329, +0.127) and inflated the plan's Medicare Advantage
      capitated payment by about {formatUSD(HCC_N18_PER_YEAR)}/yr — with no renal labs, no CKD
      history, and no nephrology anywhere in the note.
    </>
  ),
  accentColor: "var(--fraud-dx-inflation)",
  accentSoft: "var(--risk-med-soft)",
};

// ---------------------------------------------------------------------------
// 2. case_upcoding_001 — upcoding (FFS)
//    I11.9 hypertensive heart disease on a routine BP check; exam shows no
//    heart disease. Truth = I10. Note: I11.9 carries NO HCC in the CMS-HCC
//    model (V24/V28) — only I11.0 (with heart failure) does. A diagnosis swap
//    does not by itself set the E/M level (MDM/time does). So the impact here
//    is framed as diagnosis creep — a more severe chronic cardiac diagnosis
//    than documented — not as a risk-score or direct E/M-level uplift.
// ---------------------------------------------------------------------------

// CMS PFS RVU25A: 99214 ($125.18) − 99213 ($88.95) = $36.23; 2025 non-fac CF $32.3465
const PER_CLAIM_UPCODE = 36.23; // 99214−99213 Medicare overpayment per claim
const SIMILAR_UPCODES = 45; // illustrative frequency (not audited)
const UPCODING_IMPACT = 36.23 * 45; // = $1,630

const UPCODING_001: TourCase = {
  caseId: "case_upcoding_001",
  fraudType: "upcoding",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
  teaser: "Hypertensive heart disease billed on a routine BP check — but the exam shows no cardiac findings at all.",
  noteText:
    "CC: Follow-up for hypertension.\n\nHistory: 62yo male presents for routine BP check. Reports good adherence to amlodipine. Denies chest pain, dyspnea, palpitations, leg swelling, or headache. No recent ER visits or hospitalizations.\n\nExam: BP 132/84, HR 72, regular. Heart: regular rate and rhythm, no murmurs, no S3/S4. Lungs clear bilaterally. No peripheral edema. No JVD.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue amlodipine, recheck in 6 months.",
  correctCodes: [{ code: "I10", description: "Essential (primary) hypertension", fraudulent: false }],
  billedCodes: [
    {
      code: "I11.9",
      description: "Hypertensive heart disease without heart failure",
      fraudulent: true,
      flagReason:
        "No cardiac abnormality documented — exam explicitly notes no S3/S4, no murmurs, no JVD, no edema; nothing supports heart involvement",
    },
  ],
  fraudCode: "I11.9",
  fraudConfidence: 0.84,
  fraudGrounding: 0.05,
  missingEvidenceSpans: [
    "Denies chest pain, dyspnea, palpitations, leg swelling, or headache.",
    "Heart: regular rate and rhythm, no murmurs, no S3/S4.",
    "No peripheral edema. No JVD.",
  ],
  proofHeadline:
    "Look for any sign of heart disease — murmurs, S3/S4, JVD, edema. The exam explicitly finds none.",
  proofBody:
    "I11.9 (hypertensive heart disease) requires cardiac findings. The note documents a normal heart exam with no murmurs, no S3/S4, no JVD, and no edema — nothing supports heart involvement.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A routine BP check — billed as heart disease it doesn't have.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The note supports essential hypertension (I10) only — no cardiac diagnosis.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "I11.9 is over-billed. The agent asks: does the note support hypertensive heart disease?",
      duration: 5600,
    },
    impact: {
      title: "Why an upcode pays",
      subtitle: "A more severe chronic cardiac diagnosis than documented — higher complexity, same visit.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Upcoding · Likely Fraud · a higher-complexity diagnosis with no extra work.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Routine BP follow-up" },
    { icon: HeartPulse, label: "Patient", value: "62yo male, BP controlled on amlodipine" },
    { icon: FileText, label: "Payer model", value: "Fee-for-service — paid per code submitted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          In <span className="font-semibold text-[var(--accent)]">fee-for-service</span>, the
          provider is paid for each code submitted. A more{" "}
          <span className="font-medium text-[var(--foreground)]">severe diagnosis</span> than the
          note supports raises the visit's documented complexity — and can nudge its{" "}
          <span className="font-medium">reimbursement</span> upward.
        </>
      ),
    },
    {
      body: (
        <>
          Upcoding means billing a <span className="font-medium text-[var(--foreground)]">higher-tier
          code</span> than the note supports. Here, a routine hypertension check is billed as{" "}
          <span className="font-mono">I11.9</span> — hypertensive <em>heart</em> disease — with no
          cardiac findings at all. <span className="font-medium">The code is the money.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: I11.9",
  mismatchSubtitle: "Billed as hypertensive heart disease — with a normal heart exam.",
  mismatchTruthValue: "I10 only",
  mismatchTruthCaption: "Essential hypertension, no heart involvement",
  impactTitle: "Why an upcode pays",
  impactSubtitle:
    "A more severe chronic cardiac diagnosis than the note supports — higher documented complexity for the same visit.",
  impactNodes: [
    {
      icon: TrendingUp,
      label: "I11.9 submitted",
      sub: "a more severe cardiac dx",
      color: "var(--fraud-upcoding)",
      soft: "var(--risk-high-soft)",
    },
    {
      icon: BrainCircuit,
      label: "Documented complexity ↑",
      sub: "cardiac dx inflates the chart's severity",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Reimbursement ↑",
      sub: `+${formatUSD(PER_CLAIM_UPCODE)}/claim to the provider`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim upcode uplift", value: formatUSD(PER_CLAIM_UPCODE) },
    { label: "Similar claims detected", value: `${SIMILAR_UPCODES}` },
    { label: "Projected impact", value: formatUSD(UPCODING_IMPACT, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> the visit was a routine BP check — no
      extra work, no cardiac workup. But billing <span className="font-mono font-semibold text-[var(--risk-high)]">I11.9</span>{" "}
      instead of <span className="font-mono">I10</span> substitutes a more severe chronic cardiac
      diagnosis for essential hypertension — inflating the chart's documented complexity.{" "}
      <span className="font-medium">A higher code, not a higher service, is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Upcoding" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(UPCODING_IMPACT, true), money: true },
    { icon: ScanSearch, label: "Evidence", value: "Normal heart exam" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">No cardiac workup was done.</span> The note documents a normal
      heart exam — no murmurs, no S3/S4, no JVD, no edema. Billing{" "}
      <span className="font-mono">I11.9</span> (hypertensive heart disease) substitutes a more severe
      chronic cardiac diagnosis for <span className="font-mono">I10</span> (essential hypertension),
      inflating the documented complexity with no heart findings to justify it.
    </>
  ),
  accentColor: "var(--fraud-upcoding)",
  accentSoft: "var(--risk-high-soft)",
};

// ---------------------------------------------------------------------------
// 3. case_unbundling_003 — unbundling (FFS)
//    ECG 93000 + 93005 billed together. Truth = 93000 only (93005 is the
//    bundled technical component).
// ---------------------------------------------------------------------------

// CMS PFS RVU25A: 93005 technical component = $6.15 (already bundled in 93000 $13.91); CF $32.3465
const PER_CLAIM_UNBUNDLE = 6.15; // double-billed 93005 Medicare payment per claim
const SIMILAR_UNBUNDLES = 45; // illustrative frequency (not audited)
const UNBUNDLING_IMPACT = 6.15 * 45; // = $277

const UNBUNDLING_003: TourCase = {
  caseId: "case_unbundling_003",
  fraudType: "unbundling",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
  demo: true, // presentation Case 2 — mid, structural NCCI lookup
  teaser: "An ECG's technical component billed separately alongside the complete ECG — double-billing one service.",
  noteText:
    "CC: Pre-op cardiac clearance.\n\nHistory: 55yo female referred for ECG prior to elective cholecystectomy. Denies chest pain, palpitations, or dyspnea. Hypertension well-controlled on losartan.\n\nExam: BP 124/80, HR 68. Heart regular rate and rhythm, no murmurs. Lungs clear. No edema.\n\nAssessment/Plan: 12-lead ECG performed, normal sinus rhythm, no acute ischemic changes. Cleared for surgery. Continue losartan.",
  correctCodes: [
    { code: "93000", description: "Electrocardiogram, complete, tracing and interpretation", fraudulent: false },
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
  ],
  billedCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "93000", description: "Electrocardiogram, complete, tracing and interpretation", fraudulent: false },
    {
      code: "93005",
      description: "Electrocardiogram, tracing only (technical component)",
      fraudulent: true,
      flagReason:
        "93005 is the technical component bundled into the complete ECG 93000 already billed; the note documents a single 12-lead ECG, not a separate tracing service",
    },
  ],
  fraudCode: "93005",
  fraudConfidence: 0.88,
  fraudGrounding: 0.1,
  missingEvidenceSpans: [
    "12-lead ECG performed, normal sinus rhythm, no acute ischemic changes.",
    "Cleared for surgery. Continue losartan.",
  ],
  proofHeadline:
    "Look for a second ECG or a separate tracing service. The note documents a single 12-lead ECG.",
  proofBody:
    "CPT 93000 (complete ECG) already bundles the technical component (93005) and the interpretation (93010). Billing 93005 separately double-collects the technical component for one ECG — usually with a -59 modifier to bypass the NCCI edit.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "Pre-op cardiac clearance — and an ECG billed twice.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The note supports a single ECG (93000) — the expert does not split the components.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "93005 is over-billed. The agent asks: is the technical component separately defensible?",
      duration: 5600,
    },
    impact: {
      title: "Why unbundling pays",
      subtitle: "Splitting a bundled code double-collects for the same service.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Unbundling · Likely Fraud · one ECG, two technical-component fees.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Pre-op cardiac clearance" },
    { icon: HeartPulse, label: "Patient", value: "55yo female, pre-cholecystectomy ECG" },
    { icon: FileText, label: "Payer model", value: "Fee-for-service — paid per code submitted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          In <span className="font-semibold text-[var(--accent)]">fee-for-service</span>, every code
          submitted is a line item that pays. Medicare's{" "}
          <span className="font-medium text-[var(--foreground)]">NCCI edits</span> define which
          codes are <span className="font-medium">bundled</span> — components of a single service
          that must be billed together, never apart.
        </>
      ),
    },
    {
      body: (
        <>
          <span className="font-medium text-[var(--foreground)]">Unbundling</span> means splitting a
          bundled code to bill its components separately — usually with a{" "}
          <span className="font-mono">-59</span> modifier to bypass the edit. Here, the technical
          component of one ECG is billed twice. <span className="font-medium">Two codes, one service, double pay.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: 93005",
  mismatchSubtitle: "The technical component of the ECG — already inside 93000 — billed again.",
  mismatchTruthValue: "93000 only",
  mismatchTruthCaption: "One complete ECG; 93005 is bundled, not separate",
  impactTitle: "Why unbundling pays",
  impactSubtitle:
    "Billing 93000 and 93005 together double-collects the technical component for one ECG.",
  impactNodes: [
    {
      icon: Scissors,
      label: "93005 split off",
      sub: "technical component billed separately",
      color: "var(--fraud-unbundling)",
      soft: "#fff7ed",
    },
    {
      icon: FileText,
      label: "-59 modifier",
      sub: "bypasses the NCCI edit",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Double payment",
      sub: `+${formatUSD(PER_CLAIM_UNBUNDLE)}/claim for the same ECG`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim double-bill", value: formatUSD(PER_CLAIM_UNBUNDLE) },
    { label: "Similar claims detected", value: `${SIMILAR_UNBUNDLES}` },
    { label: "Projected impact", value: formatUSD(UNBUNDLING_IMPACT, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> the note documents a{" "}
      <span className="font-medium">single</span> 12-lead ECG. 93000 already includes the tracing{" "}
      <em>and</em> the interpretation. Billing <span className="font-mono font-semibold text-[var(--risk-high)]">93005</span>{" "}
      on top collects the technical component a second time — one ECG, two fees.{" "}
      <span className="font-medium">The split is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Unbundling" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(UNBUNDLING_IMPACT, true), money: true },
    { icon: ScanSearch, label: "Evidence", value: "One ECG, two technical fees" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">Only one ECG was performed.</span> The note documents a single
      12-lead ECG. <span className="font-mono">93000</span> (complete ECG) already bundles the
      technical component <span className="font-mono">93005</span> — billing both separately, typically
      with a <span className="font-mono">-59</span> modifier, double-collects for the same service.
    </>
  ),
  accentColor: "var(--fraud-unbundling)",
  accentSoft: "#fff7ed",
};

// ---------------------------------------------------------------------------
// 4. case_phantom_004 — phantom billing (FFS)
//    ECG billed on a cough visit; note says "no cardiac workup performed."
//    Truth = no ECG at all.
// ---------------------------------------------------------------------------

// CMS PFS RVU25A: 93000 complete ECG = $13.91 (never-rendered service); CF $32.3465
const PER_CLAIM_PHANTOM = 13.91; // full 93000 fee collected for nothing
const SIMILAR_PHANTOMS = 45; // illustrative frequency (not audited)
const PHANTOM_IMPACT = 13.91 * 45; // = $626

const PHANTOM_004: TourCase = {
  caseId: "case_phantom_004",
  fraudType: "phantom",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
  teaser: "An ECG billed on a cough visit — but the note explicitly says no cardiac workup was performed.",
  noteText:
    "CC: Cough, 1 week.\n\nHistory: 44yo male with productive cough, no fever, no dyspnea. Denies chest pain or palpitations. No smoking history.\n\nExam: BP 118/76, HR 74, afebrile. Lungs: few scattered rhonchi, no wheezes, no crackles. Heart regular. No edema.\n\nAssessment/Plan: Acute bronchitis. Symptomatic care, fluids, return if worsening. No cardiac workup indicated or performed.",
  correctCodes: [{ code: "J20.9", description: "Acute bronchitis, unspecified", fraudulent: false }],
  billedCodes: [
    { code: "J20.9", description: "Acute bronchitis, unspecified", fraudulent: false },
    {
      code: "93000",
      description: "Electrocardiogram, complete, tracing and interpretation",
      fraudulent: true,
      flagReason:
        "The note documents an uncomplicated respiratory visit with no cardiac complaint and explicitly states no cardiac workup was performed; an ECG was never done",
    },
  ],
  fraudCode: "93000",
  fraudConfidence: 0.9,
  fraudGrounding: 0.0,
  missingEvidenceSpans: [
    "Denies chest pain or palpitations.",
    "Heart regular. No edema.",
    "No cardiac workup indicated or performed.",
  ],
  proofHeadline:
    "Look for any ECG result, tracing, or cardiac workup. The note explicitly says none was performed.",
  proofBody:
    "An ECG (93000) produces a tracing and an interpretation — there is none in the note. The assessment explicitly states \"No cardiac workup indicated or performed.\" A service billed with no supporting documentation is a phantom service.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A cough visit — and an ECG that was never done.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The note supports a cough visit — no ECG is predicted from the documentation.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "93000 is over-billed. The agent asks: is an ECG defensible on a cough visit with no cardiac workup?",
      duration: 5600,
    },
    impact: {
      title: "Why a phantom pays",
      subtitle: "A service billed with no documentation collects the full fee for nothing.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Phantom Billing · Likely Fraud · a service billed but never rendered.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Acute cough (respiratory)" },
    { icon: HeartPulse, label: "Patient", value: "44yo male, productive cough, no chest pain" },
    { icon: FileText, label: "Payer model", value: "Fee-for-service — paid per code submitted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          In <span className="font-semibold text-[var(--accent)]">fee-for-service</span>, the
          provider is paid for each code on the claim. If a code is submitted, the payer assumes the{" "}
          <span className="font-medium text-[var(--foreground)]">service was rendered</span>.
        </>
      ),
    },
    {
      body: (
        <>
          <span className="font-medium text-[var(--foreground)]">Phantom billing</span> means
          billing for a service that was <span className="font-medium">never performed</span>. Here,
          an ECG is billed on a cough visit where the note explicitly states no cardiac workup was
          done. <span className="font-medium">The code with no service is the money.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: 93000",
  mismatchSubtitle: "An ECG billed — with no tracing, no interpretation, and no cardiac workup.",
  mismatchTruthValue: "No ECG",
  mismatchTruthCaption: "The note says no cardiac workup was performed",
  impactTitle: "Why a phantom pays",
  impactSubtitle:
    "A service billed with no supporting documentation collects the full fee for a service the patient never received.",
  impactNodes: [
    {
      icon: Ghost,
      label: "93000 billed",
      sub: "an ECG on the claim",
      color: "var(--fraud-phantom)",
      soft: "var(--risk-high-soft)",
    },
    {
      icon: ScanSearch,
      label: "No documentation",
      sub: "no tracing, no interpretation, no workup",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Full fee collected",
      sub: `+${formatUSD(PER_CLAIM_PHANTOM)}/claim for nothing`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim phantom fee", value: formatUSD(PER_CLAIM_PHANTOM) },
    { label: "Similar claims detected", value: `${SIMILAR_PHANTOMS}` },
    { label: "Projected impact", value: formatUSD(PHANTOM_IMPACT, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> there is no ECG tracing, no
      interpretation, and no cardiac complaint. The note documents an uncomplicated respiratory
      visit and explicitly states{" "}
      <span className="font-medium">\"No cardiac workup indicated or performed.\"</span> Billing{" "}
      <span className="font-mono font-semibold text-[var(--risk-high)]">93000</span> collects the
      full ECG fee for a service that never happened.{" "}
      <span className="font-medium">Nothing rendered is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Phantom Billing" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(PHANTOM_IMPACT, true), money: true },
    { icon: ScanSearch, label: "Evidence", value: "No ECG performed" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">No ECG was performed.</span> The note documents an
      uncomplicated cough visit and explicitly states{" "}
      <span className="font-medium">\"No cardiac workup indicated or performed.\"</span> Billing{" "}
      <span className="font-mono">93000</span> (complete ECG) collects the full fee for a service
      the patient never received — a phantom service.
    </>
  ),
  accentColor: "var(--fraud-phantom)",
  accentSoft: "var(--risk-high-soft)",
};

// ---------------------------------------------------------------------------
// 5. case_cloning_005 — cloning (FFS)
//    A verbatim-cloned note billed at 99214 (high complexity) when the note
//    supports 99213. The detector classified it as upcoding (the cloned note's
//    higher E/M level) — fraud caught, category differs from the planted
//    "cloning" label. The tour shows this honestly.
// ---------------------------------------------------------------------------

// CMS PFS RVU25A: 99214 ($125.18) − 99213 ($88.95) = $36.23; CF $32.3465
const PER_CLAIM_CLONE = 36.23; // 99214−99213 E/M uplift per cloned claim
const SIMILAR_CLONES = 30; // illustrative frequency (not audited)
const CLONE_IMPACT = 36.23 * 30; // = $1,087

const CLONING_005: TourCase = {
  caseId: "case_cloning_005",
  fraudType: "cloning",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
  teaser: "A routine follow-up note cloned verbatim across encounters — billed at a higher complexity than the note supports.",
  noteText:
    "CC: Routine follow-up.\n\nHistory: 71yo male, reports doing well. Denies chest pain, dyspnea, palpitations, edema, or headache. No new complaints.\n\nExam: BP 126/82, HR 70. Heart regular rate and rhythm, no murmurs, no S3/S4. Lungs clear bilaterally. No peripheral edema. No JVD.\n\nAssessment/Plan: 1. Essential hypertension, well-controlled - continue amlodipine, recheck in 6 months.",
  correctCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "99213", description: "Office visit, established patient, low complexity", fraudulent: false },
  ],
  billedCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    {
      code: "99214",
      description: "Office visit, established patient, high complexity",
      fraudulent: true,
      flagReason:
        "The note is a verbatim clone of other encounters (identical history and exam), boilerplate unedited from a template; and the note supports 99213, not 99214",
    },
  ],
  fraudCode: "99214",
  fraudConfidence: 0.84,
  fraudGrounding: 0.08,
  missingEvidenceSpans: [
    "reports doing well... No new complaints.",
    "Heart regular rate and rhythm, no murmurs, no S3/S4.",
    "Essential hypertension, well-controlled - continue amlodipine, recheck in 6 months.",
  ],
  proofHeadline:
    "Look for high-complexity medical decision-making — multiple unstable problems, significant data review, or high-risk management. There is none.",
  proofBody:
    "99214 requires moderate-to-high complexity MDM. The note documents one stable, well-controlled condition with a simple plan — that supports 99213, not 99214. The verbatim-identical text across encounters is the cloning signal.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A routine follow-up note — identical to other encounters, billed a level up.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The note supports 99213 (low complexity) — not the billed 99214.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "99214 is over-billed. The agent asks: does the note support high-complexity decision-making?",
      duration: 5600,
    },
    impact: {
      title: "Why cloning pays",
      subtitle: "A cloned note lets a provider bill the same higher-level E/M across many patients.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Cloning · Likely Fraud · boilerplate documentation billed at a higher level.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Routine follow-up" },
    { icon: HeartPulse, label: "Patient", value: "71yo male, BP controlled on amlodipine" },
    { icon: FileText, label: "Payer model", value: "Fee-for-service — paid per code submitted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          <span className="font-semibold">Cloning</span> means copy-pasting the same note across
          encounters — sometimes verbatim, sometimes with a tweak. It lets a provider bill the same{" "}
          <span className="font-medium text-[var(--foreground)]">higher-level E/M code</span> for many
          patients with no individualized documentation.
        </>
      ),
    },
    {
      body: (
        <>
          Here, a routine hypertension follow-up is billed as{" "}
          <span className="font-mono">99214</span> (high complexity) when the note supports{" "}
          <span className="font-mono">99213</span> (low complexity). The verbatim-identical text is the
          tell. <span className="font-medium">The cloned code is the money.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: 99214",
  mismatchSubtitle: "Billed as high complexity — with one stable, well-controlled condition.",
  mismatchTruthValue: "99213 only",
  mismatchTruthCaption: "Low-complexity follow-up, no high MDM",
  impactTitle: "Why cloning pays",
  impactSubtitle:
    "Cloned notes compound: the same higher-level E/M billed across many patients with no extra work.",
  impactNodes: [
    {
      icon: Copy,
      label: "99214 submitted",
      sub: "a higher-complexity E/M",
      color: "var(--fraud-cloning)",
      soft: "var(--risk-med-soft)",
    },
    {
      icon: Copy,
      label: "Note cloned",
      sub: "verbatim across encounters",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "E/M fee ↑",
      sub: `+${formatUSD(PER_CLAIM_CLONE)}/claim per clone`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim E/M uplift", value: formatUSD(PER_CLAIM_CLONE) },
    { label: "Similar cloned claims", value: `${SIMILAR_CLONES}` },
    { label: "Projected impact", value: formatUSD(CLONE_IMPACT, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> no extra work was done — the note is
      boilerplate cloned across encounters. But billing{" "}
      <span className="font-mono font-semibold text-[var(--risk-high)]">99214</span> instead of{" "}
      <span className="font-mono">99213</span> lifts the E/M fee on every cloned claim.{" "}
      <span className="font-medium">The cloned code is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Cloning" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(CLONE_IMPACT, true), money: true },
    { icon: ScanSearch, label: "Evidence", value: "Verbatim-cloned note" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">The note is a verbatim clone.</span> It documents one stable,
      well-controlled condition with a simple plan — that supports{" "}
      <span className="font-mono">99213</span>, not the billed <span className="font-mono">99214</span>.
      The identical text across encounters is the cloning signal, and the higher E/M level is where the
      money is.
    </>
  ),
  accentColor: "var(--fraud-cloning)",
  accentSoft: "var(--risk-med-soft)",
};

// ---------------------------------------------------------------------------
// 6. case_history_012 — impossible procedure on an absent body part (history)
//    A left-foot ulcer debridement (L97.523 + CPT 97597) billed on a diabetic
//    whose LEFT LEG was amputated below the knee (Z89.512) in 2023. The note
//    alone is PLAUSIBLE — it describes a credible left-foot wound — so a
//    note-only coding expert AGREES with the bill (the doomed codes land in
//    Common). Only the patient's HISTORY reveals the left foot cannot exist.
//    This is the history-dependent category: the note alone cannot resolve it.
//    Codes verified verbatim: Z89.512, L97.523, E11.42, E11.621, CPT 97597/97598.
//    See docs/research-demo-categories.md §Category D + the "mind-change" flow.
//    NOTE: the note must NOT mention the amputation — Z89.512 lives only in
//    patientHistory, and the note must not self-contradict, so the history
//    reveal (Common → Wrong) is the point.
// ---------------------------------------------------------------------------

// CMS PFS RVU25A: 97597 wound debridement = $96.72 (impossible on absent limb); CF $32.3465
const HISTORY_DEBRIDE_FEE = 96.72; // CPT 97597 Medicare payment per claim
const SIMILAR_HISTORY_CASES = 18; // illustrative frequency (not audited)
const HISTORY_IMPACT = 96.72 * 18; // = $1,741

const HISTORY_012: TourCase = {
  caseId: "case_history_012",
  fraudType: "phantom",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · history-dependent",
  demo: true, // presentation Case 3 — the live finale, history-dependent
  teaser:
    "A left-foot ulcer debridement billed on a diabetic — plausible from the note alone, but the patient's history says the left foot was amputated years ago.",
  // PLausible wound-care note. No mention of amputation, no internal
  // contradiction — a note-only coder would code the ulcer and debridement.
  noteText:
    "CC: Left foot ulcer follow-up.\n\nHistory: 64yo male with Type 2 diabetes and diabetic neuropathy presents for follow-up wound care of a left foot ulcer, present for 3 weeks. Reports mild discomfort at the ulcer site and occasional clear drainage. Denies fever, chills, or systemic symptoms. Home glucose logs in the 140s-180s. No new concerns.\n\nExam: Left foot: 2.5 cm plantar ulcer beneath the first metatarsal head with mild surrounding callus, shallow base, no exposed tendon or bone, mild serous drainage, no surrounding erythema or warmth. Right foot: intact skin, palpable dorsalis pedis pulse, no ulcer.\n\nAssessment/Plan:\n1. Type 2 diabetes with diabetic neuropathy - continue metformin and gabapentin.\n2. Left foot diabetic ulcer - sharp debridement of necrotic tissue performed today, offloading reinforced, wound care instructions reviewed.\n3. Right foot - intact, preventive diabetic foot care reinforced.",
  // Patient history is the load-bearing reveal. Z89.512 lives ONLY here.
  patientHistory: {
    summary:
      "Prior left below-knee amputation (Z89.512) in 2023 for a non-healing diabetic foot ulcer; uses a left transtibial prosthesis. Right foot intact with preventive care.",
    facts: [
      "Left below-knee amputation — 2023 (Z89.512, Acquired absence of left leg below knee)",
      "Uses a left transtibial prosthesis",
      "Type 2 diabetes mellitus with diabetic polyneuropathy (E11.42)",
      "Right foot intact, preventive diabetic foot care",
      "Medications: metformin, gabapentin, lisinopril",
    ],
  },
  // Note-only expert AGREES with the bill (note is plausible) → doomed codes
  // start in Common. On history pull, L97.523 + 97597 are revoked → Billed-only.
  noteOnlyPredictedCodes: ["E11.42", "L97.523", "97597"],
  historyRevokedCodes: ["L97.523", "97597"],
  correctCodes: [
    { code: "E11.42", description: "Type 2 diabetes mellitus with diabetic polyneuropathy", fraudulent: false },
    { code: "Z89.512", description: "Acquired absence of left leg below knee", fraudulent: false },
    { code: "99213", description: "Office visit, established patient, low complexity", fraudulent: false },
  ],
  // The bill omits Z89.512 (a fraudster wouldn't bill the amputation status
  // alongside a left-foot procedure) and adds the impossible ulcer + debridement.
  billedCodes: [
    { code: "E11.42", description: "Type 2 diabetes mellitus with diabetic polyneuropathy", fraudulent: false },
    {
      code: "L97.523",
      description: "Non-pressure chronic ulcer of other part of left foot with necrosis of muscle",
      fraudulent: true,
      flagReason:
        "The patient's history (Z89.512) records a prior left below-knee amputation — the left foot does not exist, so a left-foot ulcer cannot be present or debrided. The service is anatomically impossible.",
    },
    {
      code: "97597",
      description: "Active wound care management (debridement), total wound surface area 20 sq cm or less",
      fraudulent: true,
      flagReason:
        "Debridement billed for a left-foot ulcer that cannot exist on a patient with a prior left below-knee amputation. The service was not — and could not be — rendered.",
    },
  ],
  fraudCode: "L97.523",
  fraudConfidence: 0.92,
  fraudGrounding: 0.0,
  missingEvidenceSpans: [
    "Left foot: 2.5 cm plantar ulcer beneath the first metatarsal head ...",
    "Left foot diabetic ulcer - sharp debridement of necrotic tissue performed today ...",
    "Right foot: intact skin, palpable dorsalis pedis pulse, no ulcer.",
  ],
  proofHeadline:
    "From the note alone, this is a credible diabetic foot-ulcer debridement. Pull the patient history.",
  proofBody:
    "A coding expert reading only the note would code the left-foot ulcer (L97.523) and the debridement (97597) — the note describes a real wound. The impossibility only surfaces in the patient's history: Z89.512 (acquired absence of left leg below knee, 2023) means the left foot no longer exists. A left-foot ulcer and its debridement are anatomically impossible — the service could not have been rendered.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A diabetic foot-ulcer follow-up — plausible from the note. Then we pull the history.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "From the note alone, the expert AGREES — it codes the left-foot ulcer and debridement.",
      duration: 4200,
    },
    retrace: {
      title: "Pull patient history",
      subtitle: "The note can't resolve this. The agent pulls the chart — and finds a prior left below-knee amputation.",
      duration: 5600,
    },
    impact: {
      title: "Why the history changes everything",
      subtitle: "The billed left-foot debridement is anatomically impossible — the left foot was amputated in 2023.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Phantom / services not rendered · Likely Fraud · impossible on this patient.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Diabetic foot-ulcer follow-up" },
    { icon: HeartPulse, label: "Patient", value: "64yo male, Type 2 diabetes with neuropathy" },
    { icon: History, label: "History needed", value: "Yes — the note alone is plausible" },
  ],
  introMechanism: [
    {
      body: (
        <>
          Some fraud a coding expert can catch from the <span className="font-semibold">note alone</span>{" "}
          — an unsupported diagnosis, a bundled code split apart. But some claims look perfectly
          credible on their face.
        </>
      ),
    },
    {
      body: (
        <>
          Here, the note describes a real left-foot ulcer and a real debridement. To catch it, the
          agent has to <span className="font-medium text-[var(--foreground)]">pull the patient&apos;s history</span>{" "}
          — and discover the left foot was amputated years ago.{" "}
          <span className="font-medium">The history is the money.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: L97.523 + 97597",
  mismatchSubtitle:
    "A left-foot ulcer debridement — on a patient whose left leg was amputated below the knee.",
  mismatchTruthValue: "Left foot absent",
  mismatchTruthCaption: "Z89.512 · prior left below-knee amputation (2023)",
  impactTitle: "Why the history changes everything",
  impactSubtitle:
    "The billed left-foot debridement is anatomically impossible — the service could not have been rendered.",
  impactNodes: [
    {
      icon: History,
      label: "Z89.512 in history",
      sub: "prior left below-knee amputation",
      color: "var(--fraud-phantom)",
      soft: "var(--fraud-phantom-soft)",
    },
    {
      icon: ScanSearch,
      label: "Left-foot codes fail",
      sub: "L97.523 + 97597 can't apply",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Fee for nothing",
      sub: `+${formatUSD(HISTORY_DEBRIDE_FEE)}/claim for an impossible service`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim debridement fee", value: formatUSD(HISTORY_DEBRIDE_FEE) },
    { label: "Similar history-flagged claims", value: `${SIMILAR_HISTORY_CASES}` },
    { label: "Projected impact", value: formatUSD(HISTORY_IMPACT, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> the note alone is credible — a coding
      expert reading it would agree with the bill. Only the patient&apos;s history reveals the left foot
      was amputated in 2023 (<span className="font-mono">Z89.512</span>). A left-foot ulcer
      (<span className="font-mono">L97.523</span>) and its debridement (<span className="font-mono">97597</span>)
      are anatomically impossible.{" "}
      <span className="font-medium">An impossible service is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Phantom Billing" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(HISTORY_IMPACT, true), money: true },
    { icon: History, label: "Caught by", value: "Patient history" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">The note alone could not resolve this.</span> It describes a
      credible left-foot ulcer and debridement. But the patient&apos;s history records a prior left
      below-knee amputation (<span className="font-mono">Z89.512</span>, 2023) — the left foot does not
      exist. Billing <span className="font-mono">L97.523</span> and <span className="font-mono">97597</span>{" "}
      collects a fee for a service that is anatomically impossible to render — a phantom service,
      caught only by pulling the chart.
    </>
  ),
  accentColor: "var(--fraud-phantom)",
  accentSoft: "var(--fraud-phantom-soft)",
};

// ---------------------------------------------------------------------------
// 7. case_depression_pad_013 — diagnosis padding (risk-adjustment)
//    F33.1 (MDD, recurrent, moderate — ACTIVE) billed at a wellness visit
//    where the note documents the depression as RESOLVED: bereavement-related,
//    off sertraline 18 months, PHQ-9 1/27, "I don't feel depressed anymore,"
//    normal psych exam, "No current treatment indicated." A note-only coding
//    expert would code remission (F33.42) or flag F33.1 as unsupported — not
//    bill the active moderate code. F33.1 is a high-value HCC (V28 HCC 155,
//    coeff 0.299 ≈ $4,000/yr at the CMS 2025 base — bigger than the N18.30
//    case). This teaches the core risk-adjustment rule: "on the problem list"
//    ≠ "supported by the current encounter." No history needed.
//    See docs/research-hcc-drg-fraud.md §F33 + docs/research-demo-categories.md.
// ---------------------------------------------------------------------------

// HCC risk-score → dollar impact (CMS-published, V28 model).
// 0.299 coeff × $13,570/yr base ≈ $4,058/yr (raw); ÷1.045 norm ≈ $3,874/yr.
const HCC_F33_PER_YEAR = 4000; // ~$3,874–4,058/yr headline figure

const DEPRESSION_PAD_013: TourCase = {
  caseId: "case_depression_pad_013",
  fraudType: "dx_inflation",
  billingModel: "risk_adjustment",
  billingModelLabel: "Medicare Advantage · risk-adjusted",
  demo: true, // presentation Demo 4 — resolved depression billed as active
  teaser:
    "Major depressive disorder billed as active at a wellness visit — but the note documents full remission: off sertraline 18 months, PHQ-9 1/27, 'I don't feel depressed anymore.'",
  noteText:
    "CC: Medicare Annual Wellness Visit and chronic disease follow-up.\n\nHistory of Present Illness: 72yo female. Overall reports doing well. Lives independently and remains active with gardening and walking approximately 30 minutes four times weekly.\n\nHypertension has been stable on amlodipine 5 mg daily. Home blood pressure readings generally range from 118-132/68-78 mmHg. Denies dizziness, syncope, chest pain, palpitations, or exertional dyspnea.\n\nHyperlipidemia treated with atorvastatin 20 mg nightly. Denies myalgias.\n\nPatient has history of depressive symptoms following the death of her husband approximately three years ago. At that time she was treated with sertraline 50 mg daily and attended grief counseling. She discontinued sertraline approximately 18 months ago. She reports that her mood has been good since that time. She denies depressed mood, anhedonia, hopelessness, sleep disturbance, impaired concentration, guilt, or suicidal ideation. PHQ-9 completed today: 1/27, with one point for occasional fatigue. Patient states: \"That was a difficult period after my husband died, but I don't feel depressed anymore.\" No psychiatric medication currently prescribed.\n\nProblem List: Essential hypertension. Hyperlipidemia. Osteopenia. Major depressive disorder, recurrent. History of grief reaction. Vitamin D deficiency.\n\nMedications: Amlodipine 5 mg daily. Atorvastatin 20 mg nightly. Vitamin D3 1,000 IU daily. Calcium carbonate 600 mg daily.\n\nReview of Systems: Constitutional: No fever, chills, or weight loss. Cardiovascular: No chest pain or palpitations. Respiratory: No cough or dyspnea. Neurologic: No dizziness or weakness. Psychiatric: Denies depression, anxiety, insomnia, suicidal ideation, or loss of interest.\n\nPhysical Examination: BP 126/72, HR 68, BMI 25.4. General: Well appearing, no acute distress. Cardiac: Regular rate and rhythm. Pulmonary: Clear bilaterally. Neurologic: Alert and oriented. Psychiatric: Normal mood and affect. Appropriate behavior. Normal thought content and judgment.\n\nAssessment and Plan:\n1. Essential hypertension - Well controlled. Continue amlodipine.\n2. Hyperlipidemia - Stable. Continue atorvastatin.\n3. Osteopenia - Continue calcium/vitamin D. DEXA next year.\n4. History of depressive episode following bereavement - Patient reports continued resolution of symptoms. Off sertraline for approximately 18 months without recurrence. PHQ-9 today 1/27. No current treatment indicated.\n5. Preventive care - Vaccinations reviewed. Mammogram ordered.",
  correctCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "E78.5", description: "Hyperlipidemia, unspecified", fraudulent: false },
    { code: "M85.80", description: "Other specified disorders of bone density and structure", fraudulent: false },
    { code: "G0439", description: "Annual wellness visit, includes a personalized prevention plan of service", fraudulent: false },
  ],
  // The bill omits the wellness-visit code and pads F33.1 as ACTIVE moderate.
  // The note supports remission (F33.42), not active F33.1 — the expert does
  // not predict F33.1; it is unmatched/contradicted.
  billedCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "E78.5", description: "Hyperlipidemia, unspecified", fraudulent: false },
    { code: "M85.80", description: "Other specified disorders of bone density and structure", fraudulent: false },
    {
      code: "F33.1",
      description: "Major depressive disorder, recurrent, moderate",
      fraudulent: true,
      flagReason:
        "The note documents the depression as RESOLVED, not active: bereavement-related, off sertraline 18 months, PHQ-9 1/27, 'I don't feel depressed anymore,' normal psychiatric exam, and 'No current treatment indicated.' F33.1 (active recurrent moderate MDD) is unsupported — remission would be F33.42, not F33.1.",
    },
  ],
  fraudCode: "F33.1",
  fraudConfidence: 0.86,
  fraudGrounding: 0.04,
  missingEvidenceSpans: [
    "She discontinued sertraline approximately 18 months ago. She reports that her mood has been good since that time.",
    "PHQ-9 completed today: 1/27, with one point for occasional fatigue.",
    "\"That was a difficult period after my husband died, but I don't feel depressed anymore.\"",
    "Psychiatric: Normal mood and affect. Appropriate behavior. Normal thought content and judgment.",
    "Off sertraline for approximately 18 months without recurrence. PHQ-9 today 1/27. No current treatment indicated.",
  ],
  proofHeadline:
    "Look for evidence of ACTIVE, recurrent, moderate depression. The note documents the opposite — remission.",
  proofBody:
    "F33.1 (major depressive disorder, recurrent, moderate) describes an ACTIVE condition. The note documents resolution: a bereavement-related episode treated 3 years ago, sertraline stopped 18 months ago, no recurrence, a PHQ-9 of 1/27 (minimal), a normal psychiatric exam, and an explicit plan of 'No current treatment indicated.' A note-only coding expert would code remission (F33.42) — not bill the active moderate code. F33.1 is an unsupported, high-value HCC pad.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A Medicare wellness visit — and a depression diagnosis the note says is gone.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The note supports hypertension, hyperlipidemia, and osteopenia — and depression in remission, not active F33.1.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "F33.1 is over-billed. The agent asks: does the note support active, recurrent, moderate depression?",
      duration: 5600,
    },
    impact: {
      title: "Why it pays",
      subtitle: "F33.1 is a high-value HCC code. A resolved diagnosis billed as active inflates the plan's payment.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Diagnosis padding · Likely Fraud · a resolved condition billed as active.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Medicare annual wellness" },
    { icon: HeartPulse, label: "Patient", value: "72yo female, active, independent" },
    { icon: FileText, label: "Payer model", value: "Medicare Advantage — capitated, risk-adjusted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          In <span className="font-semibold">risk-adjusted</span> Medicare Advantage, a
          sicker <span className="font-medium text-[var(--foreground)]">diagnosis</span> raises the
          plan&apos;s capitated payment — no extra procedure required.{" "}
          <span className="font-medium">The diagnosis is the money.</span>
        </>
      ),
    },
    {
      body: (
        <>
          Mental-health codes are prime padding targets: <span className="font-mono">F33.1</span>{" "}
          (recurrent, moderate depression) carries a high HCC weight. The catch is that the note must
          support an <span className="font-medium">active</span> condition — and this one documents
          the opposite.
        </>
      ),
    },
  ],
  mismatchTitle: "The mismatch: F33.1",
  mismatchSubtitle: "Billed as active, recurrent, moderate depression — with a note that says it&apos;s resolved.",
  mismatchTruthValue: "Remission",
  mismatchTruthCaption: "Off sertraline 18 mo, PHQ-9 1/27, no current treatment",
  impactTitle: "Why a diagnosis pays",
  impactSubtitle:
    "F33.1 is a high-value HCC — billing a resolved condition as active inflates the plan's payment.",
  impactNodes: [
    {
      icon: FileText,
      label: "F33.1 submitted",
      sub: "active recurrent moderate MDD",
      color: "var(--fraud-dx-inflation)",
      soft: "var(--fraud-dx-inflation-soft)",
    },
    {
      icon: TrendingUp,
      label: "Risk score rises",
      sub: "V28 HCC 155 · +0.299 to the member",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Capitated payment ↑",
      sub: `+${formatUSD(HCC_F33_PER_YEAR)}/yr to the plan`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim HCC uplift", value: `${formatUSD(HCC_F33_PER_YEAR)}/yr` },
    { label: "Risk-score delta", value: "+0.299 (V28 HCC 155)" },
    { label: "Bigger than N18.30 pad", value: `~${Math.round(HCC_F33_PER_YEAR / HCC_N18_PER_YEAR)}× the CKD case` },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> the depression is on the problem list —
      but the note documents it as <span className="font-medium">resolved</span>: off sertraline 18
      months, PHQ-9 of 1/27, a normal psych exam, and &ldquo;No current treatment indicated.&rdquo;
      Billing <span className="font-mono font-semibold text-[var(--risk-high)]">F33.1</span> (active,
      recurrent, moderate) instead of remission (<span className="font-mono">F33.42</span>) adds{" "}
      <span className="font-medium">0.299</span> to the risk score — about{" "}
      <span className="font-medium">{formatUSD(HCC_F33_PER_YEAR)}/yr</span> in added capitated payment.{" "}
      <span className="font-medium">On the problem list is not the same as supported by the visit.</span>
      <span className="mt-2 block text-[11px] text-[var(--muted-2)]">
        Impact = HCC coeff × CMS 2025 USPCC ($13,570/yr) ÷ V28 norm (1.045). Coeff from CMS-HCC model
        software; base rate from the CY2025 Rate Announcement.
      </span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Diagnosis Inflation" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "HCC uplift", value: `${formatUSD(HCC_F33_PER_YEAR)}/yr`, money: true },
    { icon: ScanSearch, label: "Evidence", value: "Remission, not active" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">The note documents remission, not active depression.</span> A
      bereavement-related episode treated 3 years ago, sertraline stopped 18 months ago, no
      recurrence, PHQ-9 of 1/27, a normal psychiatric exam, and &ldquo;No current treatment
      indicated.&rdquo; Billing <span className="font-mono">F33.1</span> (active, recurrent, moderate
      MDD) submits a high-value HCC diagnosis the encounter does not support — remission would be{" "}
      <span className="font-mono">F33.42</span>. The diagnosis, not any procedure, is the money: about{" "}
      {formatUSD(HCC_F33_PER_YEAR)}/yr in added Medicare Advantage capitated payment.
    </>
  ),
  accentColor: "var(--fraud-dx-inflation)",
  accentSoft: "var(--fraud-dx-inflation-soft)",
};

// ---------------------------------------------------------------------------
// 8. case_clean_014 — clean claim (no fraud), the contrast/clean case
//    A 66yo established patient with Type 2 diabetes, hypertension, and
//    hyperlipidemia. The note documents MODERATE medical decision making across
//    all 3 elements (2021+ AMA/CMS office-visit E/M rules): (1) multiple stable
//    chronic conditions with a medication change, (2) moderate data (review of
//    an outside-lab A1c + independent interpretation + discussion re labs), and
//    (3) moderate risk (prescription drug management — metformin dose increase
//    + new statin requiring monitoring). 99214 is the CORRECT, fully-supported
//    E/M level — the mirror image of case_upcoding_001 (where 99214 was billed
//    with low MDM). The coding expert predicts the same codes the provider
//    billed; nothing is unmatched; verdict = clean / no fraud. This shows the
//    system's false-positive resistance.
//    Codes verified: I10, E11.9, E78.5 (CDC/CMS ICD-10-CM); 99214 = 3.87
//    non-fac RVU × $32.3465 = $125.18 (CMS PFS RVU25A). MDM per the 2021 E/M
//    revisions (Federal Register doc 2020-26815 + AMA 2021 E/M).
// ---------------------------------------------------------------------------

const CLEAN_99214_FEE = 125.18; // CMS PFS RVU25A: 99214 = 3.87 non-fac RVU × $32.3465

const CLEAN_014: TourCase = {
  caseId: "case_clean_014",
  fraudType: "clean",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
  // demo: true intentionally NOT set — this is the contrast/clean case, not one
  // of the 4 presentation fraud demos.
  teaser:
    "A diabetes follow-up billed at 99214 — and the note actually supports it. Moderate medical decision making, outside-lab review, a med change: a legitimate claim the system clears.",
  noteText:
    "CC: Diabetes follow-up.\n\nHistory: 66yo male, established patient, here for diabetes management. Reports checking home glucose 2x daily, fasting readings 130s-150s, occasional 180s after meals. Adherent to metformin 1000 mg BID. Denies polyuria, polydipsia, blurry vision, or neuropathic symptoms. Reports occasional leg cramps. No chest pain, dyspnea, or palpitations.\n\nHome glucose logs reviewed: fasting glucose 138 mg/dL average over the past 2 weeks. Patient brought results from an outside lab drawn 1 week ago: HbA1c 8.1% (up from 7.2% six months ago), LDL 112, creatinine 0.9, eGFR >60, normal urinalysis with no proteinuria.\n\nPast medical history: Type 2 diabetes mellitus, essential hypertension, hyperlipidemia.\n\nMedications: metformin 1000 mg BID, lisinopril 10 mg daily, atorvastatin 20 mg nightly. Reports no side effects from current medications.\n\nExam: BP 128/76, HR 72, BMI 28.2. General: well appearing. Neurologic: monofilament testing intact bilaterally, no focal deficits. Foot exam: intact skin, palpable pedal pulses, no ulcerations.\n\nAssessment and Plan:\n1. Type 2 diabetes mellitus - A1c has risen from 7.2% to 8.1% despite adherence to metformin 1000 mg BID. Will increase metformin to 1500 mg BID with meals and recheck A1c in 3 months. Reinforced dietary counseling and home glucose monitoring.\n2. Essential hypertension - Well controlled on lisinopril 10 mg daily. Continue current regimen. Recheck BP in 3 months.\n3. Hyperlipidemia - LDL 112, above goal for a diabetic patient (<100). Will increase atorvastatin to 40 mg nightly. Discussed statin side effects to monitor (muscle aches) and advised to report any symptoms. Will recheck lipid panel in 3 months.\n4. Preventive care - Diabetic foot exam intact. Reinforced annual eye exam and daily foot inspection.",
  correctCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "E11.9", description: "Type 2 diabetes mellitus without complications", fraudulent: false },
    { code: "E78.5", description: "Hyperlipidemia, unspecified", fraudulent: false },
    { code: "99214", description: "Office visit, established patient, moderate complexity", fraudulent: false },
  ],
  // The bill MATCHES the truth — identical codes. No fraudulent lines.
  billedCodes: [
    { code: "I10", description: "Essential (primary) hypertension", fraudulent: false },
    { code: "E11.9", description: "Type 2 diabetes mellitus without complications", fraudulent: false },
    { code: "E78.5", description: "Hyperlipidemia, unspecified", fraudulent: false },
    { code: "99214", description: "Office visit, established patient, moderate complexity", fraudulent: false },
  ],
  fraudCode: "99214",
  fraudConfidence: 0.05, // low fraud confidence = high confidence the claim is CLEAN
  fraudGrounding: 0.95, // 99214 is well grounded in the note (moderate MDM)
  missingEvidenceSpans: [
    "HbA1c 8.1% (up from 7.2% six months ago)...",
    "Will increase metformin to 1500 mg BID with meals and recheck A1c in 3 months.",
    "Will increase atorvastatin to 40 mg nightly. Discussed statin side effects to monitor...",
    "Home glucose logs reviewed: fasting glucose 138 mg/dL average over the past 2 weeks.",
  ],
  proofHeadline:
    "Every billed code is grounded in the note. This is what legitimate, well-documented moderate MDM looks like.",
  proofBody:
    "99214 (established patient, moderate MDM) is fully supported. The note documents moderate complexity across all 3 MDM elements: (1) multiple chronic conditions with progression — diabetes A1c rose from 7.2% to 8.1% requiring a medication change; (2) moderate data — review of an outside lab A1c and lipid panel plus home glucose logs; (3) moderate risk — prescription drug management requiring monitoring (metformin increased, new higher-dose statin). The diagnosis codes (I10, E11.9, E78.5) are each assessed and managed. The coding expert predicts the same four codes the provider billed — nothing is unmatched.",
  steps: baseSteps({
    intro: {
      title: "The case",
      subtitle: "A diabetes follow-up billed at 99214 — and the note actually supports it.",
      duration: 2600,
    },
    predicted: {
      title: "What our coding expert predicted",
      subtitle: "The expert predicts the same four codes the provider billed — a perfect match.",
      duration: 4200,
    },
    retrace: {
      title: "The retrace agent",
      subtitle: "Every code is grounded: moderate MDM, outside-lab review, a medication change. No findings.",
      duration: 5600,
    },
    impact: {
      title: "Why this is legitimate",
      subtitle: "99214 is the correct level for documented moderate decision making — a fair payment, not fraud.",
      duration: 5600,
    },
    verdict: {
      title: "Verdict",
      subtitle: "Clean · No Fraud · all billed codes fully supported by the note.",
      duration: 0,
    },
  }),
  introFacts: [
    { icon: Stethoscope, label: "Visit type", value: "Diabetes follow-up (established)" },
    { icon: HeartPulse, label: "Patient", value: "66yo male, T2DM + HTN + hyperlipidemia" },
    { icon: FileText, label: "Payer model", value: "Fee-for-service — paid per code submitted" },
  ],
  introMechanism: [
    {
      body: (
        <>
          Not every claim is fraud. A good fraud detector must also{" "}
          <span className="font-semibold text-[var(--risk-low)]">clear</span> the
          legitimate ones — false positives erode trust faster than missed cases.
        </>
      ),
    },
    {
      body: (
        <>
          This is the mirror image of an upcoding case: a diabetes follow-up billed at{" "}
          <span className="font-mono">99214</span> where the note <span className="font-medium">actually</span>{" "}
          documents moderate medical decision making. The coding expert agrees with the bill.{" "}
          <span className="font-medium">When the documentation supports the code, there is no fraud.</span>
        </>
      ),
    },
  ],
  mismatchTitle: "No mismatch: 99214 is supported",
  mismatchSubtitle: "Moderate MDM is documented — the expert predicts the same code the provider billed.",
  mismatchTruthValue: "99214 (correct)",
  mismatchTruthCaption: "Moderate MDM: med change + outside-lab review + Rx management",
  impactTitle: "Why this is legitimate",
  impactSubtitle:
    "99214 is the correct level for documented moderate decision making — a fair, supported payment.",
  impactNodes: [
    {
      icon: CheckCircle2,
      label: "99214 supported",
      sub: "moderate MDM, fully documented",
      color: "var(--risk-low)",
      soft: "var(--risk-low-soft)",
    },
    {
      icon: FileText,
      label: "All dx grounded",
      sub: "I10, E11.9, E78.5 each assessed",
      color: "var(--risk-low)",
      soft: "var(--risk-low-soft)",
    },
    {
      icon: DollarSign,
      label: "Legitimate payment",
      sub: `${formatUSD(CLEAN_99214_FEE)} for a real, documented visit`,
      color: "var(--risk-low)",
      soft: "var(--risk-low-soft)",
    },
  ],
  impactStats: [
    { label: "Billed codes supported", value: "4 / 4" },
    { label: "Expert agreement", value: "100%" },
    { label: "99214 Medicare payment", value: formatUSD(CLEAN_99214_FEE) },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> the note documents moderate medical decision
      making across all three elements — a rising A1c with a{" "}
      <span className="font-medium">medication change</span>, review of an{" "}
      <span className="font-medium">outside-lab A1c and lipid panel</span>, and{" "}
      <span className="font-medium">prescription drug management</span> (metformin increased, new higher-dose
      statin). That is exactly what <span className="font-mono">99214</span> requires. The coding expert
      predicts the same four codes the provider billed. <span className="font-medium">Supported codes are not fraud.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Classification", value: "Clean Claim" },
    { icon: CheckCircle2, label: "Verdict", value: "No Fraud" },
    { icon: ScanSearch, label: "Codes supported", value: "4 / 4" },
    { icon: DollarSign, label: "Legitimate payment", value: formatUSD(CLEAN_99214_FEE) },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">All billed codes are fully supported by the note.</span> The encounter
      documents moderate medical decision making — a rising A1c with a metformin dose increase, review of an
      outside-lab A1c and lipid panel, and prescription drug management with a new higher-dose statin.{" "}
      <span className="font-mono">99214</span> is the correct E/M level, and the diagnosis codes (I10, E11.9,
      E78.5) are each assessed and managed. The coding expert predicts the same codes the provider billed.
      This is a clean claim — a legitimate payment for a real, well-documented visit.
    </>
  ),
  accentColor: "var(--risk-low)",
  accentSoft: "var(--risk-low-soft)",
};

// ---------------------------------------------------------------------------
// Registry — the presentation demo cases first (demo: true), then the rest.
// The Live Demos hub shows a "Demo" badge on the demo:true cases.
// ---------------------------------------------------------------------------

export const TOUR_CASES: TourCase[] = [
  PADDING_002, // Demo 1 — diagnosis padding (risk-adjustment), precomputed intro
  UNBUNDLING_003, // Demo 2 — unbundling (NCCI structural), precomputed mid
  HISTORY_012, // Demo 3 — impossible procedure (history-dependent), live finale
  DEPRESSION_PAD_013, // Demo 4 — resolved depression billed as active (risk-adjustment)
  UPCODING_001, // reserve — not in the presentation
  PHANTOM_004, // reserve
  CLONING_005, // reserve
  CLEAN_014, // clean/contrast case — a legitimate 99214 the system clears (no fraud)
];

const TOUR_CASE_MAP: Record<string, TourCase> = Object.fromEntries(
  TOUR_CASES.map((tc) => [tc.caseId, tc]),
);

/** Look up a tour case by its URL case id. Returns undefined if not found. */
export function getTourCase(caseId: string): TourCase | undefined {
  return TOUR_CASE_MAP[caseId];
}

/** All case ids — used by the dynamic route's generateStaticParams. */
export const TOUR_CASE_IDS: string[] = TOUR_CASES.map((tc) => tc.caseId);

// Re-export for the hub page so it can read fraud-type metadata.
export type { FraudType };
