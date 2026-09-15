# Eval Cases — Curated Fraud Examples

A small, high-quality set of ground-truth fraud cases used to (1) evaluate the
medical-coding "coding expert" agent and (2) feed the guided tour. Each case is
detectable from the clinical note alone: the `correct_codes` are what the note
supports; the fraudulent `billed_codes` are not.

## Registry of examples we intend to use

| case_id | fraud_type | billing_impact_mechanism | note shape | source |
|---|---|---|---|---|
| case_padding_002 | diagnosis_padding | risk_adjustment | Medicare wellness visit; CKD added with no renal labs | user-provided example |
| case_upcoding_001 | upcoding | fee_for_service | HTN follow-up; I11.9 billed, exam shows no heart disease | user-provided example |
| case_unbundling_003 | unbundling | fee_for_service | ECG 93000 + 93005 billed together with -59 | authored (matches app hero) |
| case_phantom_004 | phantom | fee_for_service | ECG billed, note never mentions any cardiac workup | authored |
| case_cloning_005 | cloning | fee_for_service | verbatim-identical note across encounters | authored (see research for cross-encounter variant) |

### Research subagent's expanded set (in `eval-cases-research.md`)

All five fraud types + a DRG-weight upcoding case. Code descriptions verified
against ICD10Data / AAPC / CMS NCCI / CMS-HCC sources.

| case_id | fraud_type | billing_impact_mechanism | note shape |
|---|---|---|---|
| case_unbundling_006 | unbundling | fee_for_service | CMP 80053 + glucose 82947 billed separately |
| case_dx_inflation_007 | dx_inflation | risk_adjustment | COPD J44.1 added to a routine HTN/lipid visit |
| case_upcoding_008 | upcoding | fee_for_service | Stable HTN recheck billed 99214; note supports 99213 |
| case_padding_009 | diagnosis_padding | risk_adjustment | Major depressive disorder F33.1 at a med refill, no screening |
| case_phantom_010 | phantom | fee_for_service | CBC 85025 billed on a BP recheck with no labs drawn |
| case_drg_weight_011 | dx_inflation | drg_weight | Cellulitis admission upcoded to severe sepsis R65.20 |

> The canonical JSON for the first five cases lives in `eval-cases.json`; the
> research subagent's six are in the JSON code block inside
> `eval-cases-research.md`. Merge into one file when ready to drive eval runs.

> More cases (5–7, all five fraud types) are researched and authored by the
> research subagent in `eval-cases-research.md`. The canonical JSON for all
> cases lives in `eval-cases.json`.

## Design notes (why these are "good" examples)

- **Real codes**: every ICD-10-CM and CPT code is real and the description
  matches the code.
- **Note-detectable**: the fraud is provable from the note text alone — no
  external chart peeking. This is what makes them eval cases, not just
  illustrations.
- **Billing-impact mechanism is explicit**: each case names *how* the wrong
  code increases payment (fee-for-service E/M uplift, risk-adjustment HCC
  bump, etc.), which is the whole point for an investigator audience.
- **Spread**: covers upcoding, unbundling, phantom, diagnosis padding, and
  cloning — the five types the app surfaces.
- **`diagnosis_padding` / risk-adjustment** is the most compelling for the
  tour because the dollar mechanism (HCC → capitated payment) is non-obvious
  and high-impact — it's a story, not just "wrong code."
