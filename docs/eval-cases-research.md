# Eval Cases — Research Subagent Findings

Ground-truth medical coding fraud cases for evaluating the FraudLens "coding expert"
agent and driving the guided tour. Each case is detectable from the clinical note
alone: the `correct_codes` are what the note supports; the fraudulent
`billed_codes` are not.

These six cases were researched and authored to complement the existing curated set
in `eval-cases.md` / `eval-cases.json` (which holds `case_padding_002`,
`case_upcoding_001`, `case_unbundling_003`, `case_phantom_004`, `case_cloning_005`).
The two cases supplied in the task prompt (`case_padding_002`, `case_upcoding_001`)
are NOT repeated here.

## Sources consulted

Code descriptions were verified against first-party / authoritative sources rather
than relied on from memory:

- **ICD-10-CM code descriptors** — verified per code via ICD10Data / icd10check
  cross-references, which mirror the official CDC NCHS ICD-10-CM tabular list
  (the CMS ICD-10-CM code set). Each code's long descriptor below was checked
  against this source.
- **CPT code descriptors / E/M levels** — verified via AAPC code lookups
  (aapc.com/codes/cpt-codes) and the CMS E/M documentation guidelines
  (2021+ office-visit rules: MDM-based or time-based). Established-patient
  office-visit levels: 99212 = straightforward MDM / ≥15 min (self-pay-ish minimal);
  99213 = low MDM / ≥20 min; 99214 = moderate MDM / ≥30 min; 99215 = high MDM /
  ≥40 min.
- **NCCI edits / unbundling** — CMS NCCI (National Correct Coding Initiative)
  policy: 93000 (ECG, global) bundles the technical component 93005 and the
  professional/interpretation component 93010; they cannot be billed together
  except with an appropriate modifier under narrowly defined circumstances.
  Likewise 80053 (comprehensive metabolic panel) bundles its component labs
  (glucose 82947, calcium 82310, total protein 84155, albumin 82040, total
  bilirubin 82247, alkaline phosphatase 84075, AST 84060, ALT 84460, BUN 84520,
  creatinine 82565, sodium 84295, potassium 84132, chloride 82435, CO2 82374).
- **HCC / risk-adjustment** — the CMS-HCC risk-adjustment model used in Medicare
  Advantage. High-value HCC-carrying diagnoses (CKD stage 3+ N18.3/N18.4,
  COPD J44.x, CHF I50.x, diabetes with complications E11.22/E11.65, vascular
  dementia, major depressive disorder F33.x) raise a beneficiary's risk score
  and the plan's capitated payment. Diagnosis padding of these codes is a
  recurring OIG/DOJ enforcement theme (e.g. the long-running series of Medicare
  Advantage "chart review" settlements).
- **DRG upcoding** — CMS MS-DRG weights: severe sepsis with MCC (DRG 871) pays
  markedly more than sepsis without MCC (DRG 872); adding an MCC-level
  complication (e.g. acute respiratory failure J96.00, acute kidney failure
  N17.9) to a lower-severity admission can move a case to a higher-weighted
  DRG. Cellulitis (L03.x) admitted without organ failure contrasts with severe
  sepsis (R65.20/R65.21) which carries MCC capture.

The deeper dive on HCC and DRG fraud codes (verbatim descriptors, DOJ/OIG case
citations) is in the companion file `research-hcc-drg-fraud.md`.

## Verification notes on the two prompt examples and the existing JSON

While matching style, one accuracy fix was noted in the existing
`eval-cases.json`: `case_cloning_005` labels CPT 99213 as "moderate complexity",
but per the 2021+ E/M guidelines 99213 is **low** complexity (moderate is 99214).
The new cases below use the corrected, verified MDM-level descriptions.

## Cases produced here

| case_id | fraud_type | billing_impact_mechanism | note shape |
|---|---|---|---|
| case_unbundling_006 | unbundling | fee_for_service | CMP panel 80053 billed + glucose 82947 billed separately |
| case_dx_inflation_007 | dx_inflation | risk_adjustment | COPD J44.1 added to a routine HTN/lipid visit with no respiratory findings |
| case_upcoding_008 | upcoding | fee_for_service | Simple stable HTN recheck billed as 99214 (moderate); note supports 99213 (low) |
| case_padding_009 | diagnosis_padding | risk_adjustment | Major depressive disorder F33.1 added at a med refill, no depression screening |
| case_phantom_010 | phantom | fee_for_service | CBC 85025 billed on a routine BP recheck with no labs drawn |
| case_drg_weight_011 | dx_inflation | drg_weight | Cellulitis admission upcoded to severe sepsis R65.20 with no sepsis criteria in note |

The full JSON block follows.

```json
{
  "cases": [
    {
      "case_id": "case_unbundling_006",
      "fraud_type": "unbundling",
      "billing_impact_mechanism": "fee_for_service",
      "note_text": "CC: Fatigue and general checkup.\n\nHistory: 59yo female presents with several weeks of fatigue. No chest pain, no dyspnea, no abdominal pain, no weight loss. Has essential hypertension managed with lisinopril and hyperlipidemia managed with atorvastatin. Wants routine labs.\n\nExam: BP 126/80, HR 70, afebrile. Heart regular rate and rhythm, no murmurs. Lungs clear. Abdomen soft, non-tender. No edema.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril.\n2. Hyperlipidemia - continue atorvastatin.\n3. Fatigue, etiology unclear - order comprehensive metabolic panel and CBC. Recheck if symptoms persist.",
      "correct_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension" },
        { "code": "E78.5", "description": "Hyperlipidemia, unspecified" },
        { "code": "80053", "description": "Comprehensive metabolic panel (CMP)" },
        { "code": "85025", "description": "Blood count; complete (CBC) and automated differential" }
      ],
      "billed_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension", "fraudulent": false },
        { "code": "E78.5", "description": "Hyperlipidemia, unspecified", "fraudulent": false },
        { "code": "80053", "description": "Comprehensive metabolic panel (CMP)", "fraudulent": false },
        { "code": "85025", "description": "Blood count; complete (CBC) and automated differential", "fraudulent": false },
        {
          "code": "82947",
          "description": "Glucose; quantitative, blood (except reagent strip)",
          "fraudulent": true,
          "flag_reason": "CPT 82947 (blood glucose) is a component bundled into the 80053 CMP already billed; the note orders a single CMP and CBC, not a separate glucose draw",
          "fraud_mechanism": "unbundling",
          "billing_impact_mechanism": "fee_for_service",
          "billing_impact_note": "Billing 82947 separately alongside 80053 double-collects for the glucose that is already included in the comprehensive metabolic panel, typically with a -59 modifier to bypass the NCCI edit. The plan pays for the same test twice."
        }
      ]
    },
    {
      "case_id": "case_dx_inflation_007",
      "fraud_type": "dx_inflation",
      "billing_impact_mechanism": "risk_adjustment",
      "note_text": "CC: Medication refill.\n\nHistory: 70yo male presents for a routine medication refill. Reports feeling well. Has essential hypertension and hyperlipidemia, both stable. Denies cough, dyspnea, wheezing, sputum, chest pain, or any recent illness. Never smoked. No inhalers, no prior pulmonary function testing, no history of COPD or asthma.\n\nExam: BP 130/82, HR 72, afebrile, SpO2 98% on room air. Heart regular rate and rhythm. Lungs clear bilaterally, no wheezes, no crackles, no rhonchi, no prolonged expiration. No accessory muscle use.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril.\n2. Hyperlipidemia - continue atorvastatin.\n3. Refill complete, return in 6 months.",
      "correct_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension" },
        { "code": "E78.5", "description": "Hyperlipidemia, unspecified" },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making" }
      ],
      "billed_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension", "fraudulent": false },
        { "code": "E78.5", "description": "Hyperlipidemia, unspecified", "fraudulent": false },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making", "fraudulent": false },
        {
          "code": "J44.1",
          "description": "Chronic obstructive pulmonary disease with (acute) exacerbation",
          "fraudulent": true,
          "flag_reason": "No respiratory complaint, no COPD history, no wheezing or prolonged expiration, normal SpO2, and no exacerbation described; the note explicitly documents clear lungs with no respiratory findings of any kind",
          "fraud_mechanism": "dx_inflation",
          "billing_impact_mechanism": "risk_adjustment",
          "billing_impact_note": "J44.1 (COPD with acute exacerbation) is a high-value HCC code in the CMS-HCC Medicare Advantage risk model. Adding it raises the patient's risk score and the plan's capitated payment even though no procedure or higher E/M level is billed - the diagnosis itself is the payout lever."
        }
      ]
    },
    {
      "case_id": "case_upcoding_008",
      "fraud_type": "upcoding",
      "billing_impact_mechanism": "fee_for_service",
      "note_text": "CC: Blood pressure recheck.\n\nHistory: 58yo male presents for a routine blood pressure recheck. Tolerating lisinopril well, no side effects. Denies chest pain, dyspnea, palpitations, headache, dizziness, or edema. No new concerns. One stable chronic problem only.\n\nExam: BP 124/78, HR 68. Heart regular rate and rhythm, no murmurs, no S3/S4. Lungs clear. No peripheral edema. No JVD.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril, recheck BP in 6 months.",
      "correct_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension" },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making" }
      ],
      "billed_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension", "fraudulent": false },
        {
          "code": "99214",
          "description": "Office visit, established patient, moderate level of medical decision making",
          "fraudulent": true,
          "flag_reason": "The visit involves a single stable chronic problem (hypertension) with an unremarkable exam and no medication change - this is low-complexity MDM supporting 99213, not moderate. Nothing in the note shows prescription drug management complexity, undiagnosed problems, or data review that would meet moderate MDM.",
          "fraud_mechanism": "upcoding",
          "billing_impact_mechanism": "fee_for_service",
          "billing_impact_note": "99214 (moderate MDM) reimburses roughly 30-40% more than 99213 (low MDM) in the Medicare physician fee schedule. Billing 99214 for a routine, single-condition BP recheck inflates the fee without any additional service."
        }
      ]
    },
    {
      "case_id": "case_padding_009",
      "fraud_type": "diagnosis_padding",
      "billing_impact_mechanism": "risk_adjustment",
      "note_text": "CC: Medication refill and labs.\n\nHistory: 66yo female presents for routine refill of thyroid and blood pressure medications. Reports feeling well, good energy, normal sleep, normal appetite. Denies depressed mood, anhedonia, anxiety, suicidal ideation, or any psychiatric symptoms. No history of depression or any mental health condition. No mental health counseling or psychiatric referral. Vital, active, and socially engaged per her own report.\n\nExam: BP 122/80, HR 70. Affect bright and appropriate, normal speech. Heart regular. Lungs clear. No edema.\n\nAssessment/Plan:\n1. Essential hypertension, well-controlled - continue lisinopril.\n2. Hypothyroidism, stable - continue levothyroxine.\n3. Refills provided, return in 6 months.",
      "correct_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension" },
        { "code": "E03.9", "description": "Hypothyroidism, unspecified" },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making" }
      ],
      "billed_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension", "fraudulent": false },
        { "code": "E03.9", "description": "Hypothyroidism, unspecified", "fraudulent": false },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making", "fraudulent": false },
        {
          "code": "F33.1",
          "description": "Major depressive disorder, recurrent, moderate",
          "fraudulent": true,
          "flag_reason": "No depression screening (e.g. PHQ-9), no report of depressed mood or anhedonia, no psychiatric history, no antidepressant prescribed, no mental health referral - the note explicitly states the patient denies depressed mood and has no psychiatric history",
          "fraud_mechanism": "diagnosis_padding",
          "billing_impact_mechanism": "risk_adjustment",
          "billing_impact_note": "F33.1 (recurrent major depression, moderate) is an HCC-carrying diagnosis in the CMS-HCC risk model. In Medicare Advantage, adding it increases the patient's risk score and the plan's capitated payment - pure diagnosis-driven revenue with no additional service rendered."
        }
      ]
    },
    {
      "case_id": "case_phantom_010",
      "fraud_type": "phantom",
      "billing_impact_mechanism": "fee_for_service",
      "note_text": "CC: Blood pressure follow-up.\n\nHistory: 64yo male presents for a routine blood pressure check after a dose adjustment of amlodipine last month. Denies headache, dizziness, chest pain, dyspnea, or edema. Feels well. No new labs ordered today; next labs due in 3 months at annual visit.\n\nExam: BP 128/80, HR 70. Heart regular rate and rhythm, no murmurs. Lungs clear. No peripheral edema. No phlebotomy performed; no blood drawn at this encounter.\n\nAssessment/Plan:\n1. Essential hypertension, improving on current amlodipine dose - continue, recheck at annual visit with labs in 3 months.",
      "correct_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension" },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making" }
      ],
      "billed_codes": [
        { "code": "I10", "description": "Essential (primary) hypertension", "fraudulent": false },
        { "code": "99213", "description": "Office visit, established patient, low level of medical decision making", "fraudulent": false },
        {
          "code": "85025",
          "description": "Blood count; complete (CBC) and automated differential",
          "fraudulent": true,
          "flag_reason": "The note explicitly states no blood was drawn at this encounter and that labs are not due for 3 months; a CBC was never ordered or performed",
          "fraud_mechanism": "phantom",
          "billing_impact_mechanism": "fee_for_service",
          "billing_impact_note": "A CBC (85025) is billed for a service that was never rendered - no phlebotomy, no lab order, no result. The provider collects the full fee for a blood test the patient never received."
        }
      ]
    },
    {
      "case_id": "case_drg_weight_011",
      "fraud_type": "dx_inflation",
      "billing_impact_mechanism": "drg_weight",
      "note_text": "CC: Right leg redness and swelling.\n\nHistory: 57yo male presents to the ED with 3 days of progressive redness, warmth, and swelling of the right lower leg. No fever at home. Denies rigors, chills, hypotension, confusion, dyspnea, or chest pain. Vital signs on arrival: BP 134/84, HR 88, RR 18, Temp 99.1F, SpO2 97% on room air.\n\nExam: Right lower leg with circumferential erythema, warmth, and tenderness from ankle to mid-calf, no crepitus, no abscess. Heart regular rate and rhythm. Lungs clear bilaterally. Oriented and conversing normally.\n\nLabs: WBC 9.2 (normal), lactate 1.1 mmol/L, creatinine 0.9, normal serum bicarbonate. Blood cultures drawn, pending.\n\nAssessment/Plan: Cellulitis of right lower limb. Admit for IV antibiotics (cefazolin). Monitor for improvement. No evidence of sepsis.",
      "correct_codes": [
        { "code": "L03.115", "description": "Cellulitis of right lower limb" }
      ],
      "billed_codes": [
        { "code": "L03.115", "description": "Cellulitis of right lower limb", "fraudulent": false },
        {
          "code": "A41.9",
          "description": "Sepsis, unspecified organism",
          "fraudulent": true,
          "flag_reason": "The note documents localized cellulitis with no SIRS/sepsis criteria: normal WBC, normal lactate, afebrile, no tachycardia, no tachypnea, no hypotension, no organ dysfunction, and an explicit assessment of 'No evidence of sepsis.' Adding A41.9 misrepresents a skin infection as sepsis.",
          "fraud_mechanism": "dx_inflation",
          "billing_impact_mechanism": "drg_weight",
          "billing_impact_note": "Under the CMS MS-DRG system, severe sepsis (DRG 871) carries a much higher weight and base payment than a skin infection / cellulitis admission (DRG 602-603). Coding localized cellulitis as sepsis upcodes the inpatient DRG and inflates the hospital's payment without a sicker patient or more complex care."
        }
      ]
    }
  ]
}
```

## Design notes (why these are "good" examples)

- **Real codes**: every ICD-10-CM and CPT code is real and the description
  matches the code (verified against CDC/CMS-aligned ICD-10-CM tabular sources
  and AAPC/CMS CPT/E/M guidance).
- **Note-detectable**: each fraud is provable from the note text alone - the
  note either explicitly contradicts the billed diagnosis (normal lungs + no
  COPD history vs. J44.1; bright affect + denies depression vs. F33.1; "no
  blood drawn" vs. 85025; "no evidence of sepsis" + normal lactate vs. A41.9) or
  is a structural coding error (component 82947 bundled into panel 80053).
- **Billing-impact mechanism is explicit**: each case names *how* the wrong
  code increases payment (HCC risk-score bump for MA capitation, E/M level
  uplift in FFS, MS-DRG weight increase), which is the point for an
  investigator audience.
- **Spread across all five fraud types plus a DRG-weight variant**: unbundling
  (006), dx_inflation (007), upcoding (008), diagnosis_padding (009), phantom
  (010), and a DRG-weight dx_inflation case (011). The last is notable because
  `drg_weight` is a billing-impact mechanism not present in the original
  curated set, rounding out the four impact mechanisms the app tracks
  (`fee_for_service`, `risk_adjustment`, `drg_weight`, `rvu_based`).
- **E/M MDM levels are corrected**: 99213 is consistently described as "low
  level of medical decision making" and 99214 as "moderate level," per the
  2021+ CMS/AMA office-visit guidelines (fixing a "moderate complexity" label
  on 99213 seen in the existing JSON).
