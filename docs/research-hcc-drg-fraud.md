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

> **Note on N18.3**: In the FY2024+ ICD-10-CM code set, N18.3 was expanded
> into sub-codes N18.30 (stage 3 unspecified), N18.31 (stage 3a), and N18.32
> (stage 3b). The parent descriptor "Chronic kidney disease, stage 3
> (moderate)" still describes the category. See the HCC mapping table in
> §2.3 for the sub-code-to-HCC mapping (N18.30/N18.31 → V28 HCC 329;
> N18.32 → V28 HCC 328).

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

### 2.1 How it works

In Medicare Advantage, CMS pays plans a **capitated** amount per enrollee,
adjusted for the enrollee's health status using the **CMS-HCC (Hierarchical
Condition Category)** risk-adjustment model. Each ICD-10-CM diagnosis code
submitted for a beneficiary maps to one HCC category. Each HCC category has a
coefficient (relative factor). The risk score is the sum of (coefficient ×
demographic factors + each HCC coefficient). A higher risk score → a higher
monthly capitated payment to the plan.

**The core incentive for fraud**: plans are paid more for sicker-seeming
patients, and the diagnosis code itself is the payout lever. Adding a
high-weight HCC diagnosis (e.g. CHF, CKD stage 3+, COPD with exacerbation,
diabetes with complications, major depression, vascular dementia) raises the
payment **with no additional service rendered**. This is the "diagnosis
padding" / "risk-adjustment" fraud pattern: plans mine charts to add or
"find" diagnoses that are unsupported by the clinical record.

### 2.2 Model versions

- **V24** (used for payment years through 2023): the long-standing CMS-HCC
  model with ~79 HCC categories.
- **V28** (effective for payment year 2024+): the redesigned model with ~115
  HCC categories. V28 renumbered many categories, split diabetes into
  acute/chronic/glycemic sub-categories, expanded CKD into stage-specific
  categories, and added separate heart-failure tiers.

Both the V24 and V28 mappings and coefficients below are from **official CMS
model software files** downloaded from the CMS Medicare Advantage Rate
Statistics / Risk Adjustment page.

**Source**: CMS Medicare Advantage Rates & Statistics — Risk Adjustment
Model Software and ICD-10 Mappings. Downloaded:
- 2024 Midyear/Final ICD-10-CM Mappings:
  https://www.cms.gov/files/zip/2024-midyear/final-icd-10-mappings.zip
- 2024 Midyear/Final Model Software (V24 + V28):
  https://www.cms.gov/files/zip/2024-midyear/final-model-software.zip-0
- CMS Risk Adjustment landing page:
  https://www.cms.gov/Medicare/Health-Plans/MedicareAdvtgSpecRateStats/Risk-Adjustors

### 2.3 ICD-10 → HCC mapping (V24 and V28)

Official CMS mapping from the 2024 Midyear/Final ICD-10-CM Mappings CSV.
Blank = no HCC assigned (code carries no risk-adjustment weight in that model).

| ICD-10 | Description (abbrev.) | V24 HCC | V28 HCC |
|---|---|---|---|
| I10 | Essential (primary) hypertension | _(none)_ | _(none)_ |
| I11.0 | Hypertensive heart disease **with** HF | 85 | 226 |
| I11.9 | Hypertensive heart disease **without** HF | _(none)_ | _(none)_ |
| I12.0 | Hypertensive CKD, stage 5/ESRD | 136 | 326 |
| I12.9 | Hypertensive CKD, stage 1-4/unspecified | _(none)_ | _(none)_ |
| I13.0 | Hypertensive heart + CKD **with** HF, stage 1-4 | 85 | 226 |
| I13.2 | Hypertensive heart + CKD **with** HF, stage 5/ESRD | 85, 136 | 226, 326 |
| E11.9 | T2DM without complications | 19 | 38 |
| E11.8 | T2DM with unspecified complications | 17 | 38 |
| E11.21 | T2DM with diabetic nephropathy | 18 | 37 |
| E11.22 | T2DM with diabetic CKD | 18 | 37 |
| E11.29 | T2DM with other diabetic kidney complication | 18 | 37 |
| E11.319 | T2DM with unspecified diabetic retinopathy | 18 | 37 |
| E11.3599 | T2DM with proliferative diabetic retinopathy | 18, 122 | 37, 298 |
| E11.36 | T2DM with diabetic cataract | 18 | 37 |
| E11.40 | T2DM with diabetic neuropathy, unspecified | 18 | 37 |
| E11.51 | T2DM with diabetic peripheral angiopathy | 18 | 37, 108 |
| E11.59 | T2DM with other circulatory complications | 18 | 37 |
| E11.649 | T2DM with hypoglycemia without coma | 18 | 38 |
| E11.65 | T2DM with hyperglycemia | 18 | 38 |
| E11.69 | T2DM with other specified complication | 18 | 37 |
| E13.9 | Other specified diabetes without complications | 19 | 38 |
| N18.1 | CKD, stage 1 | _(none)_ | _(none)_ |
| N18.2 | CKD, stage 2 (mild) | _(none)_ | _(none)_ |
| N18.30 | CKD, stage 3 unspecified | 138 | 329 |
| N18.31 | CKD, stage 3a | 138 | 329 |
| N18.32 | CKD, stage 3b | 138 | 328 |
| N18.4 | CKD, stage 4 (severe) | 137 | 327 |
| N18.5 | CKD, stage 5 | 136 | 326 |
| N18.6 | End stage renal disease | 136 | 326 |
| N18.9 | CKD, unspecified | _(none)_ | _(none)_ |
| N17.9 | Acute kidney failure, unspecified | 135 | _(none)_ |
| J44.0 | COPD with acute lower respiratory infection | 111 | 280 |
| J44.1 | COPD with acute exacerbation | 111 | 280 |
| J44.9 | COPD, unspecified | 111 | 280 |
| I50.9 | Heart failure, unspecified | 85 | 226 |
| I50.1 | Left ventricular failure, unspecified | 85 | 226 |
| I50.20 | Unspecified systolic (congestive) HF | 85 | 226 |
| I50.21 | Acute systolic (congestive) HF | 85 | 225 |
| I50.22 | Chronic systolic (congestive) HF | 85 | 226 |
| I50.23 | Acute on chronic systolic (congestive) HF | 85 | 224 |
| I50.30 | Unspecified diastolic (congestive) HF | 85 | 226 |
| I50.32 | Chronic diastolic (congestive) HF | 85 | 226 |
| I50.33 | Acute on chronic diastolic (congestive) HF | 85 | 224 |
| I50.43 | Acute on chronic combined systolic/diastolic HF | 85 | 224 |
| I50.810 | Right heart failure, unspecified | 85 | 226 |
| I50.811 | Acute right heart failure | 85 | 225 |
| F32.9 | MDD, single episode, unspecified | _(none)_ | _(none)_ |
| F32.A | Depression, unspecified | _(none)_ | _(none)_ |
| F33.0 | MDD, recurrent, mild | 59 | _(none)_ |
| F33.1 | MDD, recurrent, moderate | 59 | 155 |
| F33.2 | MDD, recurrent, severe without psychotic features | 59 | 155 |
| F33.3 | MDD, recurrent, severe with psychotic symptoms | 59 | 152 |
| F33.41 | MDD, recurrent, in partial remission | 59 | _(none)_ |
| F33.42 | MDD, recurrent, in full remission | 59 | _(none)_ |
| F33.9 | MDD, recurrent, unspecified | 59 | _(none)_ |
| F01.50 | Vascular dementia, unspec. severity, without behavioral disturbance | 52 | 127 |
| F01.51 | Vascular dementia, unspec. severity, with behavioral disturbance | 51 | 127 |
| F01.A0 | Vascular dementia, mild, without behavioral disturbance | 52 | 127 |
| F01.A1 | Vascular dementia, mild, with behavioral disturbance | 51 | 127 |
| F01.C0 | Vascular dementia, severe, without behavioral disturbance | 52 | 125 |
| F02.80 | Dementia in other diseases, unspec. severity, without behavioral disturbance | 52 | 127 |
| F02.81 | Dementia in other diseases, unspec. severity, with behavioral disturbance | 51 | 127 |
| F02.A0 | Dementia in other diseases, mild, without behavioral disturbance | 52 | 127 |
| G30.0 | Alzheimer's disease with early onset | 52 | 127 |
| G30.1 | Alzheimer's disease with late onset | 52 | 127 |
| G30.8 | Other Alzheimer's disease | 52 | 127 |
| G30.9 | Alzheimer's disease, unspecified | 52 | 127 |
| G31.9 | Degenerative disease of nervous system, unspecified | 52 | _(none)_ |
| I21.4 | NSTEMI myocardial infarction | 86 | 228 |
| I63.9 | Cerebral infarction, unspecified | 100 | 249 |
| E66.01 | Morbid (severe) obesity due to excess calories | 22 | 48 |
| E78.5 | Hyperlipidemia, unspecified | _(none)_ | _(none)_ |
| A41.9 | Sepsis, unspecified organism | 2 | 2 |
| R65.20 | Severe sepsis without septic shock | 2 | 2 |
| R65.21 | Severe sepsis with septic shock | 2 | 2 |
| J96.00 | Acute respiratory failure, unspecified | 84 | 213 |
| J96.01 | Acute respiratory failure with hypoxia | 84 | 213 |
| J96.90 | Respiratory failure, unspecified | 84 | 213 |

> **Key observation**: I10 (essential hypertension), I11.9 (hypertensive
> heart disease **without** HF), E78.5 (hyperlipidemia), F32.9/F32.A
> (unspecified depression), and N18.1/N18.2/N18.9 (early or unspecified CKD)
> carry **no HCC** in either model. Padding these to their "with
> complication" variants (I11.0, E11.22, F33.1, N18.30+) is where the
> risk-score inflation happens.

### 2.4 HCC coefficients (relative factors)

Official CMS coefficients from the 2024 model software files. Values shown
are the **Community NonDual Aged (CNA)** model — the largest segment of the
MA population. The model also has separate coefficients for NonDual Disabled,
Full/Partial Benefit Dual (Aged/Disabled), Long Term Institutional, and New
Enrollees; those coefficients differ but the category structure is the same.

**V24 coefficients (CMS-HCC software V2424.86.P1):**

| HCC # | V24 category name | V24 coeff (CNA) |
|---|---|---|
| 2 | Septicemia, Sepsis, SIRS/Shock | 0.352 |
| 17 | Diabetes with Acute Complications | 0.302 |
| 18 | Diabetes with Chronic Complications | 0.302 |
| 19 | Diabetes without Complication | 0.105 |
| 22 | Morbid Obesity | 0.250 |
| 51 | Dementia With Complications | 0.346 |
| 52 | Dementia Without Complication | 0.346 |
| 59 | Major Depressive, Bipolar, and Paranoid Disorders | 0.309 |
| 85 | Congestive Heart Failure | 0.331 |
| 86 | Acute Myocardial Infarction | 0.195 |
| 87 | Unstable Angina and Other Acute Ischemic Heart Disease | 0.195 |
| 100 | Ischemic or Unspecified Stroke | 0.230 |
| 108 | Vascular Disease | 0.288 |
| 111 | Chronic Obstructive Pulmonary Disease | 0.335 |
| 112 | Fibrosis of Lung and Other Chronic Lung Disorders | 0.219 |
| 122 | Proliferative Diabetic Retinopathy and Vitreous Hemorrhage | 0.222 |
| 135 | Acute Renal Failure | 0.274 |
| 136 | Chronic Kidney Disease, Stage 5 | 0.289 |
| 137 | Chronic Kidney Disease, Severe (Stage 4) | 0.289 |
| 138 | Chronic Kidney Disease, Moderate (Stage 3) | 0.069 |

**V28 coefficients (CMS-HCC software V2824.115.T1):**

| HCC # | V28 category name | V28 coeff (CNA) |
|---|---|---|
| 2 | Septicemia, Sepsis, SIRS/Shock | 0.500 |
| 36 | Diabetes with Severe Acute Complications | 0.166 |
| 37 | Diabetes with Chronic Complications | 0.166 |
| 38 | Diabetes with Glycemic, Unspecified, or No Complications | 0.166 |
| 48 | Morbid Obesity | 0.186 |
| 125 | Dementia, Severe | 0.341 |
| 127 | Dementia, Mild or Unspecified | 0.341 |
| 152 | Psychosis, Except Schizophrenia | 0.484 |
| 155 | Major Depression, Moderate or Severe, without Psychosis | 0.299 |
| 213 | Cardio-Respiratory Failure and Shock | 0.370 |
| 224 | Acute on Chronic Heart Failure | 0.360 |
| 225 | Acute Heart Failure (Excludes Acute on Chronic) | 0.360 |
| 226 | Heart Failure, Except End-Stage and Acute | 0.360 |
| 228 | Acute Myocardial Infarction | 0.252 |
| 249 | Ischemic or Unspecified Stroke | 0.239 |
| 280 | COPD, Interstitial Lung Disorders, and Other Chronic Lung Disorders | 0.319 |
| 298 | Severe Diabetic Eye Disease, Retinal Vein Occlusion, and Vitreous Hemorrhage | 0.336 |
| 326 | Chronic Kidney Disease, Stage 5 | 0.815 |
| 327 | Chronic Kidney Disease, Severe (Stage 4) | 0.514 |
| 328 | Chronic Kidney Disease, Moderate (Stage 3B) | 0.127 |
| 329 | Chronic Kidney Disease, Moderate (Stage 3, Except 3B) | 0.127 |

> **Notable V28 changes**: CKD stage 4-5 coefficients increased dramatically
> (V24: 0.289 → V28: 0.514-0.815), making stage 4-5 CKD padding even more
> lucrative. Heart failure coefficients rose (V24: 0.331 → V28: 0.360).
> Depression moderate/severe (V28 HCC 155) split from the old V24 HCC 59
> (which bundled all mood disorders). Diabetes coefficients dropped in V28
> (V24: 0.302 with complications → V28: 0.166) but are now uniform across
> complication tiers.

---

## 3. DRG upcoding

### 3.1 How MS-DRGs work

Medicare pays hospitals a lump sum per inpatient stay based on the
**MS-DRG** (Medicare Severity Diagnosis-Related Group) assigned to the case.
Each DRG has a **relative weight** (higher = more complex/ costly). Payment
= DRG relative weight × base payment rate. MS-DRGs are partitioned by severity:
the same clinical category has up to three tiers — **with MCC** (Major
Complication or Comorbidity), **with CC** (Complication or Comorbidity), and
**without CC/MCC**. The "with MCC" tier pays the most.

**The core incentive for fraud**: adding a secondary diagnosis that qualifies
as a CC or MCC — but is not supported by the medical record — moves the case
to a higher-weighted DRG. The single most classic pattern is coding a simple
infection or localized condition as **severe sepsis** to jump from a low-weight
DRG (e.g. cellulitis, respiratory infection) to the high-weight sepsis DRG.

### 3.2 Official MS-DRG titles and FY2025 relative weights

Official MS-DRG titles from the CMS ICD-10 MS-DRG Definitions Manual V43
(FY2026), and relative weights from the CMS FY2025 IPPS Final Rule Table 5.

**Source**: CMS MS-DRG Classifications and Software:
https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/ms-drg-classifications-and-software
— FY2025 Table 5 (relative weights):
https://www.cms.gov/files/zip/fy-2025-ipps-final-rule-table-5.zip

#### Sepsis DRGs (the classic upcoding target)

| DRG | Official MS-DRG title | FY2025 relative weight |
|---|---|---|
| 870 | Septicemia or Severe Sepsis with MV >96 Hours | 6.9565 |
| 871 | Septicemia or Severe Sepsis without MV >96 Hours with MCC | **1.9623** |
| 872 | Septicemia or Severe Sepsis without MV >96 Hours without MCC | 1.0310 |
| 867 | Other Infectious and Parasitic Diseases Diagnoses with MCC | 2.1442 |
| 868 | Other Infectious and Parasitic Diseases Diagnoses with CC | 1.0500 |
| 869 | Other Infectious and Parasitic Diseases Diagnoses without CC/MCC | 0.7195 |

The official CMS DRG logic table for sepsis:

```
+-----------------------------+
| Septicemia or Severe Sepsis |
+---------------+------+------+
| MV >96 Hours  | MCC  | DRG  |
+---------------+------+------+
|      Yes      |  No  | 870  |
+---------------+------+------+
|      No       | Yes  | 871  |
+---------------+------+------+
|      No       |  No  | 872  |
+---------------+------+------+
```

**Upcoding pattern**: a localized infection (cellulitis DRG 602/603, weight
0.88-1.47; or respiratory infection DRG 177-179, weight 0.77-1.62) is coded
as sepsis (A41.9) or severe sepsis (R65.20) to jump to DRG 871 (weight 1.96)
or even 870 (weight 6.96). The weight nearly doubles from DRG 872 to 871 by
adding an MCC.

Principal diagnoses that trigger the sepsis DRG family (official CMS list):
A40.x-A41.9 (sepsis codes), R57.1 (hypovolemic shock), R57.8 (other shock),
R65.20 (severe sepsis without septic shock), R65.21 (severe sepsis with
septic shock).

#### Respiratory DRGs

| DRG | Official MS-DRG title | FY2025 relative weight |
|---|---|---|
| 177 | Respiratory Infections and Inflammations with MCC | 1.6165 |
| 178 | Respiratory Infections and Inflammations with CC | 0.9921 |
| 179 | Respiratory Infections and Inflammations without CC/MCC | 0.7697 |
| 189 | Pulmonary Edema and Respiratory Failure | 1.2375 |
| 190 | Chronic Obstructive Pulmonary Disease with MCC | 1.1233 |
| 191 | Chronic Obstructive Pulmonary Disease with CC | 0.8591 |
| 192 | Chronic Obstructive Pulmonary Disease without CC/MCC | 0.6472 |

**Upcoding pattern**: COPD admission without an exacerbation documented
(DRG 192, weight 0.65) → with "acute exacerbation" (J44.1) → DRG 190/191
(weight 0.86-1.12). Adding acute respiratory failure (J96.00/J96.01, an MCC)
to a respiratory infection moves DRG 179 → 177 (weight 0.77 → 1.62).

#### Heart failure / shock DRGs

| DRG | Official MS-DRG title | FY2025 relative weight |
|---|---|---|
| 291 | Heart Failure and Shock with MCC | 1.3049 |
| 292 | Heart Failure and Shock with CC | 0.8613 |
| 293 | Heart Failure and Shock without CC/MCC | 0.5490 |

**Upcoding pattern**: unspecified CHF (DRG 293, weight 0.55) → adding an
acute-on-chronic HF code (I50.23, an MCC) → DRG 291 (weight 1.30), nearly
doubling the payment.

#### Renal failure DRGs

| DRG | Official MS-DRG title | FY2025 relative weight |
|---|---|---|
| 682 | Renal Failure with MCC | 1.5020 |
| 683 | Renal Failure with CC | 0.8889 |
| 684 | Renal Failure without CC/MCC | 0.6075 |

#### Cellulitis / skin infection DRGs

| DRG | Official MS-DRG title | FY2025 relative weight |
|---|---|---|
| 602 | Cellulitis with MCC | 1.4694 |
| 603 | Cellulitis without MCC | 0.8809 |

### 3.3 CC and MCC designations (what drives the DRG tier)

Official CMS Appendix C (Complications or Comorbidities list) from the
MS-DRG Definitions Manual V43. Each diagnosis code, when coded as a
**secondary** diagnosis, is designated as either an MCC (Major), a CC, or
neither. Adding an MCC moves the case to the highest DRG tier; adding a CC
moves it to the middle tier.

| ICD-10 code | Official description | CC/MCC designation |
|---|---|---|
| R65.20 | Severe sepsis without septic shock | **MCC** |
| R65.21 | Severe sepsis with septic shock | **MCC** |
| J96.00 | Acute respiratory failure, unspecified | **MCC** |
| J96.01 | Acute respiratory failure with hypoxia | **MCC** |
| J96.02 | Acute respiratory failure with hypercapnia | **MCC** |
| J96.90 | Respiratory failure, unspecified | **MCC** |
| I50.21 | Acute systolic (congestive) heart failure | **MCC** |
| I50.23 | Acute on chronic systolic (congestive) heart failure | **MCC** |
| I50.33 | Acute on chronic diastolic (congestive) heart failure | **MCC** |
| I50.43 | Acute on chronic combined systolic/diastolic heart failure | **MCC** |
| N17.0 | Acute kidney failure with tubular necrosis | **MCC** |
| N17.1 | Acute kidney failure with acute cortical necrosis | **MCC** |
| N17.9 | Acute kidney failure, unspecified | CC |
| I50.20 | Unspecified systolic (congestive) heart failure | CC |
| I50.30 | Unspecified diastolic (congestive) heart failure | CC |
| I50.32 | Chronic diastolic (congestive) heart failure | CC |

> **The upcoding mechanism**: take a case in a lower-weight DRG (e.g.
> cellulitis DRG 603, weight 0.88; or COPD DRG 192, weight 0.65) and add a
> secondary diagnosis that is an MCC. If the MCC is not excluded by the
> principal diagnosis, the case jumps to the "with MCC" tier (cellulitis DRG
> 602 weight 1.47; COPD DRG 190 weight 1.12). The MCC codes most commonly
> abused for this: severe sepsis (R65.20/R65.21), acute respiratory failure
> (J96.00/J96.01), and acute heart failure variants (I50.21/I50.23/I50.33/
> I50.43). Each of these is an MCC by CMS's own designation.

### 3.4 POA (Present on Admission) manipulation

A secondary diagnosis only affects the DRG if its **Present on Admission
(POA)** indicator is "Y" (yes, present at admission) — hospital-acquired
conditions (POA = "N") are generally excluded from DRG severity assignment.
A second upcoding technique is coding a hospital-acquired complication as
POA = "Y" so it counts as a valid CC/MCC. Example: a patient develops acute
kidney injury (N17.9) in the hospital after surgery; coding it as POA = "Y"
would improperly move the case to a higher DRG.

---

## 4. Documented OIG/DOJ fraud cases (HCC diagnosis padding)

The following are documented Medicare Advantage fraud cases where the
mechanism was **diagnosis padding / risk-adjustment upcoding** — plans or
providers submitting unsupported HCC diagnosis codes to inflate capitated
payments. Details and source URLs below each case.

### 4.1 Kaiser Permanente — $556 million (2026)

- **Defendant**: Kaiser Permanente affiliates
- **Amount**: $556 million (largest MA fraud settlement to date)
- **Mechanism**: Pressured doctors to add diagnoses regardless of whether
  conditions were actually addressed or documented during the visit;
  generated roughly $1 billion in improper payments from 2009-2018 via
  upcoding of patient sickness levels.
- **Source (KFF Health News)**:
  https://kffhealthnews.org/medicare/medicare-advantage-record-fraud-settlement-kaiser-permanente-556-million/
- **DOJ settlement document**:
  https://www.justice.gov/opa/media/1423426/dl

### 4.2 Sutter Health — $90 million (2021)

- **Defendant**: Sutter Health + Palo Alto Medical Foundation
- **Amount**: $90 million
- **Mechanism**: Submitted unsupported diagnoses to inflate Medicare
  Advantage risk-adjustment payments; DOJ intervened in a whistleblower
  (qui tam) False Claims Act suit alleging Sutter "exaggerated how sick
  certain Medicare patients were in order to collect higher payments."
- **DOJ press release (intervention, 2018)**:
  https://www.justice.gov/opa/pr/government-intervenes-false-claims-act-lawsuit-against-sutter-health-and-palo-alto-medical
  (Note: this URL was cited in KFF Health News reporting; the DOJ page
  may require JavaScript rendering. The DOJ press release title is
  "Government Intervenes in False Claims Act Lawsuit Against Sutter Health
  and Palo Alto Medical Foundation.")
- **Source (KFF Health News)**:
  https://kffhealthnews.org/courts/feds-join-lawsuit-alleging-sutter-health-padded-revenue-with-false-patient-data/
- **Wikipedia (settlement amount)**:
  https://en.wikipedia.org/wiki/Sutter_Health (settlement: $90 million)

### 4.3 DaVita / HealthCare Partners — $270 million (2018)

- **Defendant**: DaVita subsidiary HealthCare Partners
- **Amount**: $270 million
- **Mechanism**: Improper medical coding via "one-way" chart reviews that
  inflated Medicare Advantage payments. Chart reviews found and added
  diagnoses that increased risk scores but did not remove or correct
  diagnoses that would lower them — a "one-way" ratchet that only ever
  increased the risk score.
- **Source (KFF Health News)**:
  https://kffhealthnews.org/aging/feds-settle-huge-whistleblower-suit-over-medicare-advantage-fraud/

### 4.4 Independent Health / DxID — up to $100 million (2024)

- **Defendant**: Independent Health Association (Buffalo, NY) + DxID CEO
  Betsy Gaffney
- **Amount**: up to $100 million
- **Mechanism**: Used data mining to bill for exaggerated or nonexistent
  diagnoses. The DOJ intervened and filed a False Claims Act complaint
  alleging the insurer used chart reviews to submit unsupported HCC codes
  that inflated risk scores.
- **DOJ press release**:
  https://www.justice.gov/opa/pr/united-states-intervenes-and-files-complaint-false-claims-act-suit-against-health-insurer
- **Source (KFF Health News)**:
  https://kffhealthnews.org/courts/medicare-advantage-fraud-lawsuit-settlement-new-york/

### 4.5 UnitedHealth Group — $2+ billion alleged (ongoing)

- **Defendant**: UnitedHealth Group
- **Amount**: DOJ case accuses UnitedHealth of cheating Medicare by more
  than $2 billion; a WSJ report estimated $8.7 billion in payments from
  added diagnoses in 2021 alone.
- **Mechanism**: Instructed staff to mine medical records for "dubious
  diagnoses" to inflate Medicare Advantage risk scores. DOJ intervened in
  a whistleblower suit in 2017; in July 2025 UnitedHealth confirmed a
  criminal and civil federal investigation.
- **Source (KFF Health News)**:
  https://kffhealthnews.org/health-industry/medicare-advantage-cms-overcharges-lobbying-unitedhealth-lawsuit/
- **Source (Wikipedia)**:
  https://en.wikipedia.org/wiki/UnitedHealth_Group#Medicare_Advantage_overbilling

### 4.6 Aledade — whistleblower suit (2024)

- **Defendant**: Aledade (largest US independent primary care network / ACO)
- **Amount**: Allegations unquantified; DOJ declined to intervene (case
  continues as a whistleblower suit).
- **Mechanism**: Used software to systematically upcode diagnoses (e.g.
  converting anxiety to depression) to boost Medicare Advantage payments;
  the system allegedly "rigged" coding to ignore clinical judgment.
- **Source (KFF Health News)**:
  https://kffhealthnews.org/courts/whistleblower-upcoding-medicare-aledade-lawsuit-aco-accountable-care/

### 4.7 CMS RADV audits — $12 million net overpayment / $650 million extrapolated

- **What**: CMS Risk Adjustment Data Validation (RADV) audits of 90 Medicare
  Advantage plans (2011-2013 payment years), obtained via FOIA litigation by
  KFF Health News.
- **Findings**: 71 of 90 audits found net overpayments totaling $22.5 million
  (offset by $10.5M in underpayments) = $12 million net excess for 18,090
  sampled patients. Errors often involved unsupported conditions like
  diabetes or heart failure. Humana had overpayments >$1,000/patient in 10
  of 11 audits. Extrapolating these error rates, CMS could recoup ~$650
  million.
- **Plans audited**: UnitedHealthcare and Humana were heavily represented
  (26 of 90 audits); Touchstone Health HMO had the highest average
  overpayment at $5,888 per patient.
- **Source (KFF Health News)**:
  https://kffhealthnews.org/health-care-costs/audits-hidden-until-now-reveal-millions-in-medicare-advantage-overcharges/
- **GAO report**: https://www.gao.gov/products/gao-16-76

### 4.8 The recurring pattern

Across all these cases, the mechanism is the same — the **"chart review"
or "data mining" model**:

1. The plan (or a vendor) reviews patient charts retrospectively.
2. Diagnoses are added that were never documented, assessed, or treated
   during an actual encounter — often high-weight HCC conditions (CHF,
   CKD stage 3+, COPD with exacerbation, diabetes with complications,
   major depression, vascular dementia).
3. The added diagnoses raise the beneficiary's risk score, increasing
   the plan's capitated payment — pure diagnosis-driven revenue with no
   additional care rendered.
4. The chart review is "one-way": it only adds diagnoses that increase
   payment, never removes or corrects ones that would lower it.

This is the pattern the existing `eval-cases-research.md` cases
(`case_dx_inflation_007`, `case_padding_002`, `case_padding_009`) are
designed to detect: a high-value HCC code (COPD J44.1, CKD N18.3,
depression F33.1) added to a clinical note that explicitly contradicts the
diagnosis.

---

## Sources

### ICD-10-CM code descriptors
- **CDC NCHS ICD-10-CM** (official U.S. authority, maintained by NCHS
  under WHO authorization):
  https://www.cdc.gov/nchs/icd/icd-10-cm/index.html
- **Per-code verification** — AAPC ICD-10-CM code lookups
  (aapc.com/codes/icd-10-codes), which reproduce the CDC/CMS ICD-10-CM
  tabular list. Each descriptor in §1 was verified per-code via this source.

### CMS HCC risk-adjustment model (mappings + coefficients)
- **CMS Risk Adjustment landing page**:
  https://www.cms.gov/Medicare/Health-Plans/MedicareAdvtgSpecRateStats/Risk-Adjustors
- **2024 Midyear/Final ICD-10-CM Mappings (ZIP)** — official ICD-10 → HCC
  category mapping for V22, V24, V28 models:
  https://www.cms.gov/files/zip/2024-midyear/final-icd-10-mappings.zip
- **2024 Midyear/Final Model Software (ZIP)** — contains V24 and V28
  coefficient files (C2419P1M.TXT for V24, C2824T2N.TXT for V28):
  https://www.cms.gov/files/zip/2024-midyear/final-model-software.zip-0
- **2025 Model Software / ICD-10 Mappings**:
  https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2025-model-software/icd-10-mappings

### MS-DRG definitions, CC/MCC, and weights
- **CMS MS-DRG Classifications and Software**:
  https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/ms-drg-classifications-and-software
- **ICD-10 MS-DRG Definitions Manual Files V43** (FY2026) — DRG titles,
  logic tables, principal diagnosis lists:
  https://www.cms.gov/files/zip/icd10-ms-drg-definitions-manual-files-v43.zip
  (DRG titles in appendix_A.txt; sepsis DRG logic in mdcs_12_21.txt;
  CC/MCC designations in appendix_C.txt)
- **FY2025 IPPS Final Rule Table 5** — DRG relative weighting factors:
  https://www.cms.gov/files/zip/fy-2025-ipps-final-rule-table-5.zip

### DOJ / OIG / CMS fraud cases and audits
- KFF Health News (Kaiser Permanente $556M settlement):
  https://kffhealthnews.org/medicare/medicare-advantage-record-fraud-settlement-kaiser-permanente-556-million/
- DOJ Kaiser Permanente settlement document:
  https://www.justice.gov/opa/media/1423426/dl
- KFF Health News (Sutter Health, DOJ intervention):
  https://kffhealthnews.org/courts/feds-join-lawsuit-alleging-sutter-health-padded-revenue-with-false-patient-data/
- DOJ Sutter Health press release (cited URL):
  https://www.justice.gov/opa/pr/government-intervenes-false-claims-act-lawsuit-against-sutter-health-and-palo-alto-medical
- KFF Health News (DaVita/HealthCare Partners $270M):
  https://kffhealthnews.org/aging/feds-settle-huge-whistleblower-suit-over-medicare-advantage-fraud/
- KFF Health News (Independent Health/DxID $100M):
  https://kffhealthnews.org/courts/medicare-advantage-fraud-lawsuit-settlement-new-york/
- DOJ Independent Health complaint:
  https://www.justice.gov/opa/pr/united-states-intervenes-and-files-complaint-false-claims-act-suit-against-health-insurer
- KFF Health News (UnitedHealth $2B+ DOJ case):
  https://kffhealthnews.org/health-industry/medicare-advantage-cms-overcharges-lobbying-unitedhealth-lawsuit/
- KFF Health News (Aledade whistleblower):
  https://kffhealthnews.org/courts/whistleblower-upcoding-medicare-aledade-lawsuit-aco-accountable-care/
- KFF Health News (CMS RADV audits, $12M net / $650M extrapolated):
  https://kffhealthnews.org/health-care-costs/audits-hidden-until-now-reveal-millions-in-medicare-advantage-overcharges/
- GAO report on MA risk adjustment (GAO-16-76):
  https://www.gao.gov/products/gao-16-76
- NYT: "The Cash Monster Was Insatiable" (MA fraud allegations):
  https://www.nytimes.com/2022/10/08/upshot/medicare-advantage-fraud-allegations.html
- WSJ: "Insurers Pocketed $50 Billion From Medicare for Diseases No
  Doctor Treated" (July 2024):
  https://www.wsj.com/health/healthcare/medicare-health-insurance-diagnosis-payments-b4d99a5d

### Verification notes
- ICD-10-CM descriptors were verified per-code against AAPC lookups, which
  mirror the official CDC NCHS ICD-10-CM tabular list. The CDC page
  (https://www.cdc.gov/nchs/icd/icd-10-cm/index.html) confirms NCHS
  maintains ICD-10-CM for U.S. use under WHO authorization.
- HCC mappings and coefficients were extracted from official CMS model
  software ZIP files downloaded directly from cms.gov. The V24 coefficients
  are from file C2419P1M.TXT (CMS-HCC software V2424.86.P1.zip); the V28
  coefficients are from C2824T2N.TXT (CMS-HCC software V2824.115.T1.zip).
  Coefficient values shown are the Community NonDual Aged (CNA) segment.
- DRG titles and logic tables are from the CMS ICD-10 MS-DRG Definitions
  Manual V43 (appendix_A.txt, mdcs_12_21.txt, appendix_C.txt). Relative
  weights are from FY2025 IPPS Final Rule Table 5.
- Some DOJ press release URLs (justice.gov/opa/pr/...) may require
  JavaScript rendering and may not load via automated fetch. These URLs
  were cited in KFF Health News reporting and Wikipedia; the case facts
  (defendant, amount, mechanism) were verified from those secondary
  sources. Where a DOJ URL returned empty content via automated fetch,
  the URL is still provided as cited by the reporting source.
