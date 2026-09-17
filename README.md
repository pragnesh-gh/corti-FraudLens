# corti-FraudLens

**Detects and explains medical-coding fraud — it doesn't score it with rules.**

An AI-driven medical-coding fraud detector built on [Corti](https://corti.ai)'s
healthcare-AI platform for the Corti Hack for Health. Feed it a clinical note
and the codes a provider billed; a coding-expert agent predicts the codes the
note actually supports, compares them against the bill, investigates every
discrepancy, cites the note, rates defensibility, and drafts a legal brief.

It is **replay-first**: runs end-to-end with zero credentials using precomputed
results. Add Corti API keys and flip `FRAUDLENS_LIVE=1` to run the real agents
live — the UI is identical either way.

## Pitch deck

A self-contained, one-file pitch deck lives at
[`fraudlens-pitch.html`](fraudlens-pitch.html) (repo root). Open it in a browser
— no build, no server.

## Pipeline

```text
clinical note + billed codes (+ optional patient history)
    │
    ▼
┌────────────────────────────────────────────────────────┐
│  1. Extract facts        (textgen)                      │
│  2. Predict codes        (medical coding)               │
│  3. Compare billed ∩ predicted                         │
│        common → fine                                     │
│        billed-not-predicted → investigate               │
│  4. Retrace each suspect code  (agentic)                │
│        agreeability 0–100 · grounding · note cites     │
│  5. Verdict: fraud / error / clean + confidence         │
│  6. Economic impact + legal brief                       │
└────────────────────────────────────────────────────────┘
    │
    ▼
verdict · grounded findings · referral brief
```

Three Corti capabilities, one honest pipeline — it **detects and explains**
rather than scoring with rules.

## Demo cases

The **Live Demos** hub (`/tour`) walks through five cases, plus a
**Try for yourself** playground where you paste your own note.

| # | Case | Fraud type | Why it matters |
|---|------|-----------|----------------|
| 1 | Diagnosis padding | Risk-adjustment | A CKD code billed at a wellness visit |
| 2 | Unbundling | NCCI structural | One ECG split into two charges |
| 3 | Impossible procedure | History-dependent | Foot debridement on an amputated limb |
| 4 | Resolved depression | Risk-adjustment | Active MDD billed when the note says remission |
| 5 | Clean claim | — (contrast) | A legitimate 99214 the system clears |

Case 3 needs **patient history** — the note alone looks fine, so the expert
initially agrees with the bill. Pulling the history (a prior amputation) flips
the codes from "common" to "wrong." That mind-change is the demo's thesis:
**the note alone isn't enough; you need the chart.**

## Quick start

```bash
cd app
cp .env.example .env      # leave keys blank for replay mode (works offline)
npm install
npm run dev               # → http://localhost:3000
```

Replay mode runs with no keys and no network to Corti — the full pipeline
plays back from precomputed results. No credentials, no friction.

## Run it live (optional)

To run the real Corti agents instead of replay:

1. Copy your Corti Agent API credentials into `app/.env` and set
   `CORTI_REGION=staging-eu` (the region with credits). See `.env.example`
   for the exact keys.
2. Set the live flag:

   ```bash
   FRAUDLENS_LIVE=1
   ```

3. Restart `npm run dev`. The hub shows a **Live armed** badge, and runs now
   hit the real coding-expert, retrace, judgement, and legal-brief agents.

If a live call fails or times out, corti-FraudLens silently falls back to the
cached replay result — the demo never breaks.

## How the money is calculated

Two mechanisms, both cited to CMS sources (see
[`docs/economic-impact-methodology.md`](docs/economic-impact-methodology.md)):

```text
Risk adjustment (diagnosis padding):
  HCC coefficient × Medicare base/year (~$13,570)  →  inflated annual payment

Fee for service (upcoding / unbundling / phantom):
  over-billed code RVUs × CMS PFS conversion factor ($32.35)  →  per-claim overpayment
```

An **HCC coefficient** is Medicare's price tag on a diagnosis — 0.299 means
the plan gets ~30% more per year for that patient. Pad the diagnosis, pad the
price tag. No LLM computes money; every figure traces to a CMS-published input
(or a clearly-labeled illustrative frequency assumption).

## Project layout

```text
app/
├── src/
│   ├── app/                # routes (pages)
│   │   ├── page.tsx        # Case Queue (home)
│   │   ├── tour/           # Live Demos hub + per-case walkthrough + try-it-yourself
│   │   ├── architecture/  # system map
│   │   ├── case/[id]/      # single-case deep view
│   │   └── api/            # /api/coding-expert, /api/run-pipeline
│   ├── components/         # UI (tour engine, legal-brief view, live-demo runner)
│   ├── lib/                # pipeline, agents, data, types, legal-brief builder
│   └── data/precomputed/   # the replay JSON per case
├── scripts/               # precompute / live-test / probes
├── .env.example
└── docs/                   # research, verified codes, methodology
```

## Notes

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Recharts.
- **No multimodal:** the UI is verified by build + source, never by screenshot.
- **Corti, not Corticon:** built on [Corti](https://corti.ai)'s healthcare-AI
  platform, not Progress Corticon.

Full documentation lives in [`app/README.md`](app/README.md). See
[`AGENTS.md`](AGENTS.md) for the architecture and `docs/` for research and
decisions.

## Claude Code setup

This repo enables the **Matt Pocock skills** plugin (grilling, TDD, code
review, domain modeling, docs-for-agents, etc.) via project-level settings in
`.claude/settings.json`.

First-time setup on a fresh machine — add the marketplace and install the
plugin once (user-scoped):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install mattpocock-skills@claude-plugins-official
```

After that, opening this repo automatically enables the skills.
