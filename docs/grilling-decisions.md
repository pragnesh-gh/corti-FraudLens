# Grilling Decisions — Corti Hack for Health Demo

## Round 1 — Top-level architecture
- **Q1 Pipeline reality**: (b) real on one hero case, mocked elsewhere, `--live`/`--replay` toggle; ship replay-first, abstract orchestrator behind a `Pipeline` interface. Never fully-real-on-all.
- **Q2 Persona**: (a) retrospective investigator (MFCU/SIU/attorney). Hero screen = Case Detail → zoom to Provider Pattern Dashboard.
- **Q3 Corti APIs**: offline-first with a thin adapter interface (`predictCodes`/`extractFacts`/`judgeFraud`); Corti-backed on the hero case IF keys exist, else pure replay. Architecture identical either way.
- **Q4 Stack**: (a) All-TS — Next.js 15 App Router + TS + Tailwind + shadcn/ui + Recharts. One language, native Corti JS SDK.
- **Q5 Synthetic data**: self-contained generator + fixtures with a published typed Zod/TS schema. Teammate data drops in via same `Case` contract.
- **Q6 Agent cards**: replay by default (pre-baked trace, ~1–1.5s/card sequential streaming); live only on hero if `--live` stable.

## Round 2 — Downstream contracts
- **Q7 Case schema**: (see types in `src/lib/types.ts`). `Case` (provider, patient, encounter, submitted_codes, clinical_note, evidence_spans, billed/paid, planted_fraud) + `CaseResult` (predicted_codes, findings[], case_summary, total_impact) + `AgentCard` (id, title, status, summary, duration_ms).
- **Q8 Fraud types**: FULLY built = upcoding + unbundling (deterministic signals + UI evidence + $ calc). Stubbed (flag + one-line evidence) = phantom, dx-inflation, cloning.
- **Q9 Provider dashboard charts**: 3 charts + KPI strip — (1) horizontal bar top-10 CPT villain vs peer median; (2) E/M level distribution stacked bar villain vs peers; (3) 18-month $-impact trend line vs peer baseline. Cut choropleth + demographic bar.
- **Q10 Roles**: (b) lightweight role toggle changing framing/CTA text + worklist column labels; shared screens.
- **Q11 DB**: (b) in-memory JSON fixtures at boot behind a `Repository` interface. No SQLite for demo.
- **Q12 Grounding**: explicit evidence spans (start/end + verbatim text) in fixtures + per-code in `CaseResult.findings`. Non-negotiable — click code → note highlights.

## Round 3 — Further downstream
- **Q13 Live LLM**: Corti Medical Coding + TextGen for coding/facts (load-bearing host APIs); Claude API for agentic reasoning/judgement. No keys → pure replay, `--live` inert.
- **Q14 Deploy**: local-first `npm run dev`; Vercel only as stretch goal if stable after rehearsal.
- **Q15 Dataset**: 6 providers, 140 cases. Villain "Dr. Elias Mercer" (Internal Med, FL) 45 cases (upcoding+unbundling+cloning, hero case among them). 2 minor-issue providers (~15 each = 30, "Possible Error" flags). 3 clean controls (~22/22/21 = 65). Villain tops worklist ~$189K flagged.
- **Q16 $ impact**: deterministic formula, no LLM. `dollar_impact = (submitted_value − expected_value) × frequency × penalty_multiplier` (2–3× fraud, 1× error). LLM judges fraud type + intent; math is reproducible.

## Round 4 — Scope cuts
- **Q17 Out of scope**: (1) auth/login & user accounts; (2) real-time websocket streaming (replay only); (3) geographic choropleth map (state bar instead); (4) citizen-relator full flow / separate role builds (toggle only); (5) automated test suite & CI (manual + one smoke test). Bonus cuts: licensed NCCI tables (hand-built edit pairs), real DB (in-memory), real claims/payments integration (synthetic only).
- **Q18 90s demo script**: Worklist (0–12s) → open hero Case Detail (16–40s, agent cards stream: Facts→Predicted→Grounding→Judgement) → flag drilldown with note highlighting (40–55s) → $ impact panel (55–66s) → Provider Pattern Dashboard, 3 charts animate (66–88s) → KPI strip (88–90s, "Remove Corti, and this is a dead map.").
