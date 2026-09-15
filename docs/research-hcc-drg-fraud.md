# Research — HCC & DRG Fraud Codes (Verbatim ICD-10-CM Descriptors, DOJ/OIG Cases)

Deep-dive companion to `eval-cases-research.md`. Verbatim ICD-10-CM long
descriptors verified against the official CDC/NCHS ICD-10-CM tabular list (the
U.S. adaptation of WHO ICD-10), cross-checked per code via AAPC code lookups
(aapc.com/codes/icd-10-codes), which mirror the CDC/CMS code set. HCC mappings
and DOJ/OIG fraud-case citations follow, with primary-source URLs.

> **Verification standard**: every ICD-10-CM descriptor below was checked
> per-code against an authoritative lookup that reproduces the CDC NCHS
> "ICD-10-CM Tabular List of Diseases and Injuries." Descriptors are quoted
> verbatim (matching case and punctuation). Where a coefficient or case fact
> could not be verified against a primary source, it is flagged as such.

---

## 1. ICD-10-CM codes — exact official descriptors

### 1.1 Hypertension

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **I10** | Essential (primary) hypertension | Low/none. In the CMS-HCC model, uncomplicated essential hypertension carries little or no risk weight on its own — it is the *base* condition, not a high-value HCC. The incentive is to "upgrade" it to a hypertensive-heart or hypertensive-CKD code (I11/I12/I13) which carry HCCs. |
| **I11.9** | Hypertensive heart disease without heart failure | HCC-relevant. Hypertensive heart disease (no HF) captures a cardiovascular HCC. A classic "diagnosis creep" target: I10 → I11.9 raises the risk score with no additional lab/imaging if the chart merely mentions "LVH" or "cardiomegaly." |
| **I11.0** | Hypertensive heart disease with heart failure | High-value HCC. Heart failure (any I50.x or I11.0/I13.0/I13.2) is one of the highest-weighted cardiovascular HCCs. Adding HF to a hypertensive patient is a frequent padding pattern. |
| **I12.9** | Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease | HCC-relevant. Links HTN + CKD; captures a renal HCC. |
| **I12.0** | Hypertensive chronic kidney disease with stage 5 chronic kidney disease or end stage renal disease | High-value renal HCC (ESRD). |
| **I13.0** | Hypertensive heart and chronic kidney disease with heart failure and stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease | High-value. Stacks cardiac + renal HCCs. |
| **I13.2** | Hypertensive heart and chronic kidney disease with heart failure and with stage 5 chronic kidney disease, or end stage renal disease | High-value (cardiac + ESRD). |

### 1.2 Diabetes mellitus, Type 2

The diabetes HCCs are the canonical example of "with complications" paying
far more than "without complications." E11.9 (no complications) carries a low
HCC; any E11.2x (kidney), E11.3x (eye), E11.4x (neuropathy), E11.5x
(circulatory), or E11.6x (hyperglycemia/hypoglycemia) raises the risk score
materially. Padding E11.9 → E11.22 (diabetic CKD) or E11.65 (hyperglycemia)
is a recurring OIG audit theme.

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **E11.9** | Type 2 diabetes mellitus without complications | Low HCC. The "base" diabetes code; low risk weight. |
| **E11.8** | Type 2 diabetes mellitus with unspecified complications | Higher HCC. "With complications" tier — vague enough to be abused. |
| **E11.21** | Type 2 diabetes mellitus with diabetic nephropathy | Higher HCC (renal complication). |
| **E11.22** | Type 2 diabetes mellitus with diabetic chronic kidney disease | Higher HCC (renal complication). One of the most-padded: adds the CKD HCC on top of diabetes. |
| **E11.29** | Type 2 diabetes mellitus with other diabetic kidney complication | Higher HCC (renal complication). |
| **E11.319** | Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema | Higher HCC (eye complication). |
| **E11.3599** | Type 2 diabetes mellitus with proliferative diabetic retinopathy without macular edema, unspecified eye | Higher HCC (eye complication). |
| **E11.36** | Type 2 diabetes mellitus with diabetic cataract | Higher HCC (eye complication). |
| **E11.40** | Type 2 diabetes mellitus with diabetic neuropathy, unspecified | Higher HCC (neurological complication). |
| **E11.51** | Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene | Higher HCC (circulatory complication). |
| **E11.59** | Type 2 diabetes mellitus with other circulatory complications | Higher HCC (circulatory complication). |
| **E11.649** | Type 2 diabetes mellitus with hypoglycemia without coma | Higher HCC (metabolic complication). |
| **E11.65** | Type 2 diabetes mellitus with hyperglycemia | Higher HCC (metabolic complication). A frequent pad: "hyperglycemia" can be documented from a single elevated glucose reading. |
| **E11.69** | Type 2 diabetes mellitus with other specified complication | Higher HCC (other complication). |
| **E13.9** | Other specified diabetes mellitus without complications | Low HCC (secondary diabetes, no complications). |

### 1.3 Chronic kidney disease (CKD)

CKD is a classic upcoding ladder: N18.9 (unspecified) → N18.3 (stage 3) →
N18.4 (stage 4) → N18.5/6 (stage 5/ESRD). Higher stage = higher HCC. Stage 3
is the most-padded because eGFR ranges (30–59) can be cherry-picked from one
lab; stages 4–5 are harder to support without dialysis/creatinine evidence.

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **N18.1** | Chronic kidney disease, stage 1 | Minimal HCC (mild). |
| **N18.2** | Chronic kidney disease, stage 2 (mild) | Low HCC. |
| **N18.3** | Chronic kidney disease, stage 3 (moderate) | **High-value HCC.** Stage 3 is the single most-cited "diagnosis padding" CKD code in OIG audits — moderate risk weight and easy to support with one eGFR. |
| **N18.4** | Chronic kidney disease, stage 4 (severe) | **High-value HCC.** Higher weight; requires eGFR 15–29. |
| **N18.5** | Chronic kidney disease, stage 5 | **High-value HCC.** Near-ESRD; highest non-dialysis CKD weight. |
| **N18.6** | End stage renal disease | **Top HCC (renal).** Dialysis-dependent; very high weight. |
| **N18.9** | Chronic kidney disease, unspecified | Low/none. Padding direction: N18.9 → N18.3+. |
| **N17.9** | Acute kidney failure, unspecified | Not a chronic HCC, but an **MCC** that drives DRG weight up (see §3). |

### 1.4 COPD / chronic lower respiratory disease

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **J44.0** | Chronic obstructive pulmonary disease with (acute) lower respiratory infection | HCC (chronic lung disease). Acute-infection variant. |
| **J44.1** | Chronic obstructive pulmonary disease with (acute) exacerbation | **High-value HCC.** The "exacerbation" variant is a frequent pad: adding "with exacerbation" to stable COPD raises the HCC and (inpatient) can move the DRG. |
| **J44.9** | Chronic obstructive pulmonary disease, unspecified | HCC (chronic lung disease). Base COPD code; lower weight than J44.1. Padding direction: J44.9 → J44.1. |

### 1.5 Heart failure

Heart failure is among the highest-weighted HCCs. Any specific I50.x captures
the CHF HCC; the sub-specification (systolic/diastolic/combined) does not
usually change the HCC, but unsupported addition of any HF code is a top
padding pattern.

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **I50.9** | Heart failure, unspecified | **High-value HCC.** The most-padded HF code: no specificity required. |
| **I50.1** | Left ventricular failure, unspecified | High-value HCC. |
| **I50.20** | Unspecified systolic (congestive) heart failure | High-value HCC. |
| **I50.21** | Acute systolic (congestive) heart failure | High-value HCC. |
| **I50.22** | Chronic systolic (congestive) heart failure | High-value HCC. |
| **I50.23** | Acute on chronic systolic (congestive) heart failure | High-value HCC. |
| **I50.30** | Unspecified diastolic (congestive) heart failure | High-value HCC. |
| **I50.32** | Chronic diastolic (congestive) heart failure | High-value HCC. |
| **I50.33** | Acute on chronic diastolic (congestive) heart failure | High-value HCC. |
| **I50.43** | Acute on chronic combined systolic (congestive) and diastolic (congestive) heart failure | High-value HCC. |
| **I50.810** | Right heart failure, unspecified | High-value HCC. |
| **I50.811** | Acute right heart failure | High-value HCC. |

### 1.6 Depression

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **F32.9** | Major depressive disorder, single episode, unspecified | HCC (depression). |
| **F32.A** | Depression, unspecified | HCC (depression). Low specificity. |
| **F33.0** | Major depressive disorder, recurrent, mild | HCC (depression). |
| **F33.1** | Major depressive disorder, recurrent, moderate | **High-value HCC.** Recurrent + moderate is a common pad at routine visits with no PHQ-9 / no psychiatric history. |
| **F33.2** | Major depressive disorder, recurrent severe without psychotic features | **High-value HCC.** Higher weight than F33.1; requires severe documentation. |
| **F33.3** | Major depressive disorder, recurrent, severe with psychotic symptoms | Higher HCC (severe + psychotic). |
| **F33.41** | Major depressive disorder, recurrent, in partial remission | HCC (depression). |
| **F33.42** | Major depressive disorder, recurrent, in full remission | HCC (depression). Still carries an HCC even in remission — a known padding incentive. |
| **F33.9** | Major depressive disorder, recurrent, unspecified | HCC (depression). |

### 1.7 Dementia (vascular & Alzheimer's)

Dementia is a high-value HCC category. The "without behavioral disturbance"
variants (F01.50, F02.80) are common in charts because they need less
specificity; "with behavioral disturbance" can carry equal or higher weight
but is harder to support.

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **F01.50** | Vascular dementia, unspecified severity, without behavioral disturbance, psychotic disturbance, mood disturbance, and anxiety | **High-value HCC.** Vascular dementia; very common pad in elderly MA beneficiaries. |
| **F01.51** | Vascular dementia, unspecified severity, with behavioral disturbance | High-value HCC. |
| **F01.A1** | Vascular dementia, mild, with behavioral disturbance | High-value HCC. |
| **F01.C0** | Vascular dementia, severe, without behavioral disturbance, psychotic disturbance, mood disturbance, and anxiety | High-value HCC (severe). |
| **F02.80** | Dementia in other diseases classified elsewhere, unspecified severity, without behavioral disturbance, psychotic disturbance, mood disturbance, and anxiety | **High-value HCC.** Use this code when dementia is due to an underlying classified disease (e.g. Alzheimer's, Parkinson's); often paired with G30.x. |
| **F02.81** | Dementia in other diseases classified elsewhere, unspecified severity, with behavioral disturbance | High-value HCC. |
| **F02.A0** | Dementia in other diseases classified elsewhere, mild, without behavioral disturbance, psychotic disturbance, mood disturbance, and anxiety | High-value HCC. |
| **G30.0** | Alzheimer's disease with early onset | High-value HCC. |
| **G30.1** | Alzheimer's disease with late onset | High-value HCC. |
| **G30.8** | Other Alzheimer's disease | High-value HCC. |
| **G30.9** | Alzheimer's disease, unspecified | High-value HCC. Most-padded Alzheimer's code (no specificity). |
| **G31.9** | Degenerative disease of nervous system, unspecified | Lower HCC. Non-specific neuro. |

### 1.8 Other cardiovascular & metabolic (HCC / DRG-relevant)

| Code | Exact official ICD-10-CM long descriptor | HCC / risk-adjustment note |
|---|---|---|
| **I21.4** | Non-ST elevation (NSTEMI) myocardial infarction | **High-value HCC + MCC.** Acute MI is a top HCC and an inpatient MCC. |
| **I63.9** | Cerebral infarction, unspecified | **High-value HCC + MCC.** Stroke; acute HCC and DRG MCC. |
| **E66.01** | Morbid (severe) obesity due to excess calories | HCC (morbid obesity is an MCC for DRG). |
| **E78.5** | Hyperlipidemia, unspecified | Low/no HCC. Base lipid code. |

### 1.9 Sepsis & respiratory failure (DRG upcoding drivers — see §3)

| Code | Exact official ICD-10-CM long descriptor | DRG / risk-adjustment note |
|---|---|---|
| **A41.9** | Sepsis, unspecified organism | **DRG driver.** Principal sepsis code → sepsis DRG (867-872). |
| **A41.01** | Sepsis due to Methicillin susceptible Staphylococcus aureus | DRG driver (specific organism sepsis). |
| **A41.02** | Sepsis due to Methicillin resistant Staphylococcus aureus | DRG driver (MRSA sepsis). |
| **R65.20** | Severe sepsis without septic shock | **DRG driver (MCC).** Severe sepsis is an MCC; drives DRG 871 (severe sepsis with MCC). |
| **R65.21** | Severe sepsis with septic shock | **DRG driver (MCC, highest).** Septic shock = highest-severity sepsis DRG. |
| **J96.00** | Acute respiratory failure, unspecified whether with hypoxia or hypercapnia | **MCC** for DRG. |
| **J96.01** | Acute respiratory failure with hypoxia | **MCC** for DRG. |
| **J96.90** | Respiratory failure, unspecified, unspecified whether with hypoxia or hypercapnia | CC/MCC depending on context. |
| **R09.02** | Hypoxemia | CC for DRG. |
| **L03.115** | Cellulitis of right lower limb | Base skin-infection DRG (602-603). Padding direction: L03.x → A41.9/R65.2x (cellulitis upcoded to sepsis). |

---

## 2. CMS-HCC risk-adjustment model

<!-- HCC coefficients to be filled from subagent research -->

_Placeholder — see subagent research below once integrated._

---

## 3. DRG upcoding

<!-- DRG data to be filled from subagent research -->

_Placeholder — see subagent research below once integrated._

---

## 4. Documented OIG/DOJ fraud cases (HCC diagnosis padding)

<!-- Fraud case citations to be filled from subagent research -->

_Placeholder — see subagent research below once integrated._

---

## Sources

- **ICD-10-CM Tabular List** — CDC NCHS, the U.S. authority for ICD-10-CM
  (authorized by WHO). https://www.cdc.gov/nchs/icd/icd-10-cm/index.html
- **Per-code descriptor verification** — AAPC ICD-10-CM code lookups
  (aapc.com/codes/icd-10-codes), which reproduce the CDC/CMS ICD-10-CM
  tabular list. Each descriptor above was verified per-code via this source.
