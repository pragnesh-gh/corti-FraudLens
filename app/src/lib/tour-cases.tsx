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
//    N18.3 CKD stage 3 on a wellness visit. The original tour.
// ---------------------------------------------------------------------------

const PADDING_002: TourCase = {
  caseId: "case_padding_002",
  fraudType: "dx_inflation",
  billingModel: "risk_adjustment",
  billingModelLabel: "Medicare Advantage · risk-adjusted",
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
      code: "N18.3",
      description: "Chronic kidney disease, stage 3 (moderate)",
      fraudulent: true,
      flagReason: "No renal labs (creatinine/eGFR), no CKD history, no nephrology mention anywhere in note",
    },
  ],
  fraudCode: "N18.3",
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
    "No creatinine. No eGFR. No urinalysis. No \"chronic kidney disease\" anywhere. A stage-3 CKD diagnosis needs renal labs — and there are none.",
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
      subtitle: "N18.3 is over-billed. The agent asks: is a stage-3 CKD code defensible from this note?",
      duration: 5600,
    },
    impact: {
      title: "Why it pays",
      subtitle: "N18.3 is an HCC code. Here's how a diagnosis, not a procedure, becomes money.",
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
  mismatchTitle: "The mismatch: N18.3",
  mismatchSubtitle: "Billed as CKD stage 3 — with nothing in the note to back it.",
  mismatchTruthValue: "Nothing",
  mismatchTruthCaption: "No renal labs, no CKD history, no nephrology",
  impactTitle: "Why a diagnosis pays",
  impactSubtitle:
    "N18.3 is an HCC code — the diagnosis itself inflates the plan's payment.",
  impactNodes: [
    {
      icon: FileText,
      label: "N18.3 submitted",
      sub: "an HCC-eligible diagnosis",
      color: "var(--fraud-dx-inflation)",
      soft: "var(--risk-med-soft)",
    },
    {
      icon: TrendingUp,
      label: "Risk score rises",
      sub: "HCC weight added to the member",
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    },
    {
      icon: DollarSign,
      label: "Capitated payment ↑",
      sub: `+${formatUSD(2000)}/yr to the plan`,
      color: "var(--risk-high)",
      soft: "var(--risk-high-soft)",
    },
  ],
  impactStats: [
    { label: "Per-claim HCC uplift", value: `${formatUSD(2000)}/yr` },
    { label: "Similar claims detected", value: "45" },
    { label: "Projected impact", value: formatUSD(10125, true), danger: true },
  ],
  impactInsight: (
    <>
      <span className="font-semibold">The key insight:</span> no procedure was upcoded and no E/M
      level was inflated. The provider billed the same wellness visit — but added{" "}
      <span className="font-mono font-semibold text-[var(--risk-high)]">N18.3</span> to the
      diagnosis list. In a risk-adjusted model, that single line raises the plan's capitated payment
      for the year. <span className="font-medium">The diagnosis is the money.</span>
    </>
  ),
  verdictFacts: [
    { icon: FileText, label: "Fraud type", value: "Diagnosis Inflation" },
    { icon: Gavel, label: "Intent", value: "Likely Fraud" },
    { icon: DollarSign, label: "Projected impact", value: formatUSD(10125, true), money: true },
    { icon: ScanSearch, label: "Evidence", value: "Zero grounding in note" },
  ],
  verdictConclusion: (
    <>
      <span className="font-semibold">No procedure or higher E/M level was needed.</span> The
      diagnosis itself is the money: <span className="font-mono">N18.3</span> is an HCC code that
      raised the patient's risk score and inflated the plan's Medicare Advantage capitated payment
      — with no renal labs, no CKD history, and no nephrology anywhere in the note.
    </>
  ),
  accentColor: "var(--fraud-dx-inflation)",
  accentSoft: "var(--risk-med-soft)",
};

// ---------------------------------------------------------------------------
// 2. case_upcoding_001 — upcoding (FFS)
//    I11.9 hypertensive heart disease on a routine BP check; exam shows no
//    heart disease. Truth = I10.
// ---------------------------------------------------------------------------

const PER_CLAIM_UPCODE = 95; // approximate E/M uplift per claim
const SIMILAR_UPCODES = 45;
const UPCODING_IMPACT = 10125;

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
      subtitle: "I11.9 upcodes the E/M complexity — a higher-paying code for the same visit.",
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
          provider is paid for each code submitted. A more complex{" "}
          <span className="font-medium text-[var(--foreground)]">diagnosis</span> raises the
          visit's medical-decision-making — and its <span className="font-medium">reimbursement</span>.
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
    "I11.9 upcodes the E/M medical decision-making to a higher-paying level — same visit, more money.",
  impactNodes: [
    {
      icon: TrendingUp,
      label: "I11.9 submitted",
      sub: "a higher-complexity cardiac dx",
      color: "var(--fraud-upcoding)",
      soft: "var(--risk-high-soft)",
    },
    {
      icon: BrainCircuit,
      label: "E/M complexity ↑",
      sub: "cardiac dx lifts the MDM level",
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
      instead of <span className="font-mono">I10</span> inflates the E/M complexity and the fee.{" "}
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
      <span className="font-mono">I11.9</span> (hypertensive heart disease) upcodes the visit from{" "}
      <span className="font-mono">I10</span> (essential hypertension) to a higher-paying complexity
      level, with no heart findings to justify it.
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

const PER_CLAIM_UNBUNDLE = 60;
const SIMILAR_UNBUNDLES = 45;
const UNBUNDLING_IMPACT = 10125;

const UNBUNDLING_003: TourCase = {
  caseId: "case_unbundling_003",
  fraudType: "unbundling",
  billingModel: "fee_for_service",
  billingModelLabel: "Fee-for-service · per-code payment",
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

const PER_CLAIM_PHANTOM = 110;
const SIMILAR_PHANTOMS = 45;
const PHANTOM_IMPACT = 10125;

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

const PER_CLAIM_CLONE = 80; // 99214 vs 99213 E/M uplift
const SIMILAR_CLONES = 30;
const CLONE_IMPACT = 6000;

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
// Registry — ordered so the diagnosis-padding tour is the default/first.
// ---------------------------------------------------------------------------

export const TOUR_CASES: TourCase[] = [PADDING_002, UPCODING_001, UNBUNDLING_003, PHANTOM_004, CLONING_005];

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
