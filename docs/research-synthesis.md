# Research Synthesis — Medical Coding Fraud Detection (Corti Hack for Health)

## 0. Critical context: it's Corti, not Corticon

The hackathon is **Corti** (corti.ai) — a Copenhagen healthcare-AI company — **not** Progress Corticon the rules engine. Gerrit Van Arkel is VP of Operations at Corti. The event is "Corti Hack for Health" (Copenhagen Aug 2026; NYC/London Fall 2026). Prizes €2k + credits. Judging criteria officially TBA. **Per the user: don't worry about the Corticon-related part — focus on the demo itself.**

Corti's APIs (the load-bearing backbone): Speech-to-Text, Medical Coding (ICD-10 & CPT with audit trail/evidence), Text Generation, Agentic Framework (20+ agents), SDKs (JS, .NET, Agent SDK). A winning-style prior project used Corti APIs as the clinical backbone + deterministic TypeScript rules for decisions + a replayable synthetic demo + tests, framed as "remove Corti and this is a dead map."

## 1. Medical coding fundamentals

- **ICD-10-CM** (diagnoses): 3–7 chars, letter-first, decimal after 3rd. `E11.9` T2DM, `I10` HTN, `S72.001A` femur fx initial. 7th char = encounter (A/D/S).
- **CPT** (procedures): 5-digit. E/M 99202–99215 (tiered by MDM complexity → upcoding lever), Surgery, Radiology, Path/Lab, Medicine. `99213` est. low, `99204` new mod, `80053` CMP, `93000` ECG.
- **HCPCS Level II** (supplies/drugs/DME): alpha + 4 digits. `J0696` cefazolin.
- **DRG** (inpatient): 3-digit + relative weight. Upcoding = pushing case to higher-weight DRG via CC/MCC.
- **Reimbursement tiers** drive upcoding: E/M level, DRG weight, RVUs (`payment = total RVU × conversion factor`).
- **Modifiers** drive unbundling: `-25` (separate E/M same day), `-59` (distinct service — canonical unbundling bypass), `-LT/-RT`, `-26/-TC`, `-XE/XS/XP/XU`.
- **A case/claim** = provider NPI + patient demographics + DOS + dx codes (principal + secondaries) + procedure codes (with units/modifiers) + charge amounts + POS + clinical note. Medical necessity = each CPT points to a dx that justifies it.
- **NPI**: 10-digit, Luhn-validated, Type 1 (individual) / Type 2 (org), taxonomy = specialty.
- **POS**: 11 office, 22 outpatient hospital, 23 ER, 24 ASC, 21 inpatient.

## 2. Fraud detection signals (the five types)

- **Upcoding**: E/M 99214/15 when note supports 99212/13; DRG CC/MCC not supported; high-complexity share >> peer mean; short note + high code.
- **Unbundling**: NCCI edits (col1/col2 mutually exclusive); `-59` overuse; component codes billed where a comprehensive code applies.
- **Phantom billing**: no supporting doc; service after death date / outside admit; impossible hours/day; duplicates across providers.
- **Diagnosis inflation**: dx not in chart; HCC/CC risk-score clustering; procedure-dx implausibility; year-end dx dumping.
- **Cloning**: identical/near-identical note text across visits/patients; boilerplate unedited; verbatim ROS/exam repeated; note complexity vs code mismatch.

**Public datasets**: NPPES NPI registry, LEIE (excluded providers), Medicare Provider Utilization (data.cms.gov), HCPCS/CPT, CDC. NCCI edits = policy manual free, machine tables licensed (hand-build for demo). DE-SynPUF = synthetic Medicare claims (good base, URL may be stale).

**Synthetic generation**: start from public synthetic base or simulate claims with realistic distributions + provider peer groups; inject fraud patterns deterministically (upcode a fraction, split bundles, clone text, add no-note services, inflate dx); label each injected claim.

## 3. Agentic architecture

**Recommendation**: lightweight custom async orchestrator (a `Pipeline` class + shared `CaseState` + response cache). Fastest to a reliable, narratable demo; easiest to mock/cache. Reserve LangGraph for production.

**Pipeline**: TextGen (facts) → Medical Coding (predicted codes + confidence) → [if unmatched/low-conf] parallel agentic fan-out per code: A grounding-in-note → B extended verification in journal (interloop calls TextGen to summarise chart) → C fraud/error judgement + scoring into 5 categories → D economic impact → E aggregation agent writes structured case → DB → F pattern-matching agent crunches across DB rows (provider/geo/demographic anomalies vs expected normal distribution).

**DB schema**: `cases` (case_id, provider_id/npi, specialty, state, zip5, patient_age_band/sex, encounter_date, predicted_codes jsonb, billed/paid, flags_summary jsonb, max_confidence, est_impact) + `case_findings` (finding_id, case_id, code, fraud_type, grounding_score, fraud_confidence, dollar_impact, journal_summary, agent_trace jsonb). JSONB + indexes for cross-case GROUP BY.

**Demo pragmatics**: live LLM on one curated hero case; cache/mock the rest (JSON fixtures keyed by case_id/code); pre-seed DB with ~50–200 synthetic cases w/ planted patterns; `--live`/`--replay` toggle; response cache keyed by prompt hash; short timeouts + cached fallback. → polished streaming UI + guaranteed-fast, non-flaky output.

## 4. UI/UX patterns

**Screens**: Case Queue/Worklist (filterable table ranked by risk + $, KPI tiles) → Case Detail (clinical note + submitted vs predicted codes side-by-side, alignment scores, grounding chips) → per-code grounding drilldown (verbatim note spans + rationale) → Fraud Flags + Evidence panel → Economic Impact breakdown → Provider Pattern Dashboard (code mix vs peers, outliers, geo/demographics, trend) → Timeline.

**Code alignment viz**: per-code confidence bar (green match / amber low / red mismatch) + circular gauge for note-level score + highlighted note spans linked to codes (click code → note scrolls/highlights). Evidence-linked highlighting is the most persuasive demo element.

**Five fraud types**: distinct icon + accent color + severity badge — upcoding (↑ red), unbundling (✂ orange), phantom (ghost deep red), dx inflation (📈 amber), cloning (⧉ purple). Two-tier fraud-vs-error: solid red "Likely Fraud (intent)" vs hollow amber "Possible Error".

**Provider patterns**: horizontal bar chart (top codes, provider vs peer median + delta), box/whisker or percentile strip for outliers, choropleth/regional heatmap, stacked bar demographics, line/area trend w/ peer baseline.

**Aesthetic**: clean clinical (light bg, whitespace, slate/neutral base + semantic risk colors, crisp type) — NOT dark hacker theater. Subtle dark-mode toggle is a nice flourish.

**Tech stack**: Vite + React + TS + Tailwind + shadcn/ui + Recharts. Backend FastAPI/Python (or Next.js all-in-JS). SQLite for demo.
