# Economic Impact Methodology — FraudLens Demo

How each demo case's dollar figure is computed, and where every input comes
from. Two distinct mechanisms: **risk-adjustment** (HCC) cases use a fully
CMS-published formula; **fee-for-service** (FFS) cases use real 2025 Medicare
payments from the CMS Physician Fee Schedule. The `SIMILAR_*` frequency counts
are illustrative assumptions, not audited figures — labeled as such.

## 1. Risk-adjustment (HCC) cases — `case_padding_002`, `case_depression_pad_013`

Medicare Advantage pays plans a capitated, risk-adjusted rate. Each
diagnosis maps to a CMS-HCC category with a published coefficient (relative
factor); adding a high-weight diagnosis raises the beneficiary's risk score
by that coefficient, and the plan's monthly payment rises proportionally.

**Formula:**

```
per-year impact ≈ HCC coefficient × USPCC base rate ÷ V28 normalization factor
```

| Input | Value | CMS source |
|---|---|---|
| HCC coefficient (N18.30) | 0.127 (V28 HCC 329) | CMS-HCC model software file `C2824T2N.csv` |
| HCC coefficient (F33.1) | 0.299 (V28 HCC 155) | same model file |
| USPCC base rate (CY2025) | $13,570/yr ($1,130.85/mo) | CMS CY2025 Rate Announcement, Table I-2 |
| V28 normalization factor | 1.045 | CMS CY2025 Rate Announcement, p.5 |
| MA coding-pattern adjustment | 5.90% | CMS statutory MA coding-pattern difference adjustment |

**Computation:**
- N18.30: 0.127 × $13,570 ÷ 1.045 ≈ **$1,649/yr** (raw 0.127 × $13,570 ≈ $1,723). Headline: ~$1,692/yr.
- F33.1: 0.299 × $13,570 ÷ 1.045 ≈ **$3,874/yr** (raw 0.299 × $13,570 ≈ $4,058). Headline: ~$4,000/yr.

**What is CMS-published vs. estimated:** the coefficient, the 2025 USPCC, the
V28 normalization factor, and the 5.90% coding-pattern adjustment are all
CMS-published. The exact paid amount varies by county rate and bonus tier
(county rates range ~$649–$2,429/mo per the 2025 MA Rate Book); the headline
figures use the national base.

### Primary sources
- CMS-HCC risk-adjustment model software + ICD-10→HCC mappings:
  https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors
  (2024 Midyear/Final model software ZIP; V28 coefficients in `C2824T2N.csv`).
- CMS CY2025 Rate Announcement (base rate + normalization factor):
  https://www.cms.gov/files/document/2025-announcement.pdf

---

## 2. Fee-for-service (FFS) cases — per-claim Medicare payments

FFS cases show the **real 2025 Medicare payment** for the fraudulent code,
computed from the CMS Physician Fee Schedule RVU25A file.

**Formula:**

```
per-claim payment = total non-facility RVU × 2025 PFS conversion factor ($32.3465)
```

The 2025 national non-facility conversion factor ($32.3465) and all RVUs
below are from `PPRRVU25_JAN.csv` (CMS PFS RVU25A, January 2025 release).

| Case | Code | Description | Non-fac RVU | Medicare pay | Per-claim fraud $ |
|---|---|---|---|---|---|
| upcoding / cloning | 99214 | Office o/p est mod 30 min | 3.87 | $125.18 | **$36.23** (99214−99213) |
| upcoding / cloning | 99213 | Office o/p est low 20 min | 2.75 | $88.95 | (baseline) |
| unbundling | 93005 | Electrocardiogram tracing | 0.19 | $6.15 | **$6.15** (double-billed component) |
| unbundling | 93000 | Electrocardiogram complete | 0.43 | $13.91 | (the comprehensive code) |
| phantom | 93000 | Electrocardiogram complete | 0.43 | $13.91 | **$13.91** (never-rendered full fee) |
| history | 97597 | Dbrdmt opn wnd 1st 20 cm/< | 2.99 | $96.72 | **$96.72** (impossible debridement) |

**Per-claim fraud $:**
- **Upcoding** (`case_upcoding_001`): 99214 − 99213 = $125.18 − $88.95 = **$36.23/claim**
- **Unbundling** (`case_unbundling_003`): the double-billed 93005 = **$6.15/claim** (already in 93000)
- **Phantom** (`case_phantom_004`): the never-rendered 93000 = **$13.91/claim**
- **Cloning** (`case_cloning_005`): 99214 − 99213 = **$36.23/claim** (same E/M delta)
- **History** (`case_history_012`): the impossible 97597 = **$96.72/claim**

### Projected impact

```
projected impact = per-claim fraud $ × SIMILAR_* frequency count
```

| Case | Per-claim | × Frequency | = Projected impact |
|---|---|---|---|
| upcoding | $36.23 | 45 | $1,630 |
| unbundling | $6.15 | 45 | $277 |
| phantom | $13.91 | 45 | $626 |
| cloning | $36.23 | 30 | $1,087 |
| history | $96.72 | 18 | $1,741 |

**The `SIMILAR_*` counts (45, 30, 18) are illustrative frequency assumptions**,
not audited figures — they represent "how many similar claims the investigator
found in this provider's history" for the demo narrative. The per-claim
dollar amounts are real CMS-published 2025 Medicare payments; the frequency
multiplier is a narrative device.

### Primary source
- CMS Physician Fee Schedule RVU25A file (`PPRRVU25_JAN.csv`), January 2025
  release: https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files/rvu25a
- 2025 PFS national non-facility conversion factor: $32.3465 (in the file).
- CPT codes and descriptions are copyright 2024 American Medical Association;
  CMS reproduces the short descriptors under license in the PFS files.

---

## 3. What's citable vs. illustrative (summary)

| Component | Citable? | Source |
|---|---|---|
| HCC coefficients (0.127, 0.299) | ✅ CMS-published | CMS-HCC model software |
| USPCC base rate ($13,570/yr) | ✅ CMS-published | CY2025 Rate Announcement |
| V28 normalization (1.045) | ✅ CMS-published | CY2025 Rate Announcement |
| FFS per-claim payments | ✅ CMS-published | PFS RVU25A file |
| PFS conversion factor ($32.3465) | ✅ CMS-published | PFS RVU25A file |
| `SIMILAR_*` frequency counts | ❌ Illustrative | Narrative assumption for the demo |
| County rate / bonus tier variation | Not used | Demo uses the national base |

Every dollar figure a viewer sees traces to either a CMS-published input
(HCC + FFS cases) or a clearly-labeled illustrative frequency assumption.
No LLM computes money.
