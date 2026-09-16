# FraudLens Demo Runbook

Everything you need to run the demo. The app works fully offline (replay mode);
the live Corti coding-expert path is optional and credits-gated.

## Quick start

```bash
cd app && npm run dev    # http://localhost:3000
```

Open `http://localhost:3000`. Hard-refresh (⌘+Shift+R) if a tab was open
before — the guided tours and demo pages are new.

## The screens

| Route | What it shows |
|---|---|
| `/` | Case Queue — worklist ranked by risk + $, KPI strip. Villain Dr. Elias Mercer tops the list (~$756K flagged). |
| `/case/C-2026-0042` | Hero case — streaming agent cards, clinical note with click-to-highlight findings, submitted-vs-predicted codes, $ impact. |
| `/tour` | **Guided Tour hub** — pick a fraud type, watch a 7-step animated "transcript vs truth" walkthrough. |
| `/tour/[caseId]` | An individual guided tour (diagnosis padding, upcoding, unbundling, phantom). |
| `/demo` | **Guided Demo** — a presenter overlay that drives the 90-second demo across screens with cue cards. |
| `/providers` | Provider list. |
| `/providers/P-001` | Villain's Provider Pattern Dashboard — 3 charts (top CPT vs peers, E/M distribution, 18-month $ trend). |

## How to demo (90 seconds)

1. **Worklist** (10s) — `/`. "Every submitted claim, ranked by risk and dollars. Mercer tops the list — 45 cases, $756K."
2. **Hero case** (30s) — click the top row → `/case/C-2026-0042`. Agent cards stream in. "Six agents: facts, coding, grounding, verification, judgement, impact."
3. **Flag drilldown** (15s) — click a finding (Upcoding or Unbundling). The clinical note highlights the evidence — or the absence of it.
4. **$ impact** (10s) — "Deterministic: overpayment × frequency × penalty. No LLM computes money."
5. **Provider dashboard** (20s) — "View provider pattern →" → 3 charts. "Sustained pattern across 18 months, not a one-off."
6. **Closer** (5s) — "Remove Corti, and this is a dead map."

> Use **`/demo`** to do this hands-free: the presenter overlay advances through
> these exact beats with cue cards, navigating for you. Pause/Next/Prev as needed.
> Use **`/tour`** for a deep, self-paced walk through one fraud type at a time.

## Live coding-expert path (optional)

The app is replay-first by default. To run the hero case against the real Corti
coding-expert agent:

```bash
cd app
# .env is already in place with the Corti credentials (gitignored).
echo "FRAUDLENS_LIVE=1" >> .env
npm run dev
```

Open the hero case `/case/C-2026-0042` — the agent pipeline now hits the real
Corti Medical Coding agent. On any failure or timeout it silently falls back to
replay, so the demo never breaks.

### Test the live path standalone

```bash
node scripts/live-test.mjs
```

This does a full end-to-end check: auth → create a coding-expert agent → send a
clinical note → report the prediction → clean up. **Status as of 2026-09-16:**
- **staging-eu** — ✅ works end-to-end; the coding expert returns correct codes. **This is the active region** (`CORTI_REGION=staging-eu`).
- **dev-weu** — ✅ also works end-to-end, but its `message:send` is intermittently flaky (404 / "fetch failed"). Reliable as a fallback.
- **eu** — auth + agent creation work, but message:send is REJECTED ("account balance insufficient"). Avoid until credits are added.

### Smoke test (always works, no network)

```bash
node scripts/smoke.mjs     # 37/37 checks across every route
```
