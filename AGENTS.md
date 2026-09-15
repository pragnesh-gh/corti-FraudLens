# AGENTS.md

Orientation for AI agents working in this repo.

## What this is

**FraudLens** — a medical coding fraud detection demo for the **Corti Hack for Health**
hackathon. It surfaces AI-investigated claims with grounded evidence: upcoding,
unbundling, phantom billing, diagnosis inflation, and cloning.

The app is a Next.js 16 + React 19 + TypeScript + Tailwind v4 + Recharts SPA with an
in-memory synthetic dataset (no real DB, no real PII). A retrospective-investigator
persona is primary; provider and relator are a light role toggle.

## Architecture (one-screen entry point)

```
app/
  src/
    lib/
      types.ts        # THE typed contract — Case, CaseResult, Finding, AgentCard, ProviderAggregate
      codes.ts        # real CPT/ICD-10/HCPCS refs + hand-built NCCI edit pairs
      data.ts         # deterministic synthetic generator (6 providers, 140 cases) + in-memory repo
      pipeline.ts     # live-vs-replay adapter — Pipeline interface + CodingExpert seam (env-gated)
      fraud-meta.ts   # per-fraud-type icon/color/label metadata
      utils.ts        # cn(), formatUSD, formatPct, formatDate
    components/
      app-shell.tsx   # nav + role toggle (client)
      ui.tsx          # Card, RiskBadge, FraudChip, IntentBadge
    app/
      layout.tsx              # root layout + AppShell
      page.tsx                # Case Queue (KPI strip + worklist table) — LANDING
      case/[id]/page.tsx      # Case Detail (note + codes + streaming agent cards + findings + $)
      tour/page.tsx           # Guided Tour — animated two-column "transcript vs truth" walkthrough
      providers/page.tsx      # provider list
      providers/[id]/page.tsx # Provider Pattern Dashboard (3 charts + KPI strip)
  .env.example          # coding-expert live-path keys (CORTI_API_KEY, ANTHROPIC_API_KEY) — gitignored when copied
docs/
  research-synthesis.md   # findings from the 5 research agents
  grilling-decisions.md   # the decision tree (Q1–Q18)
  eval-cases.md           # curated registry of ground-truth fraud eval cases
  eval-cases.json         # canonical eval-case JSON (note-detectable, real codes)
  eval-cases-research.md  # research subagent's expanded case set (when present)
```

## Key design decisions (see docs/grilling-decisions.md)

- **Replay-first pipeline**: agent cards stream a pre-baked trace with simulated
  timing; a `--live` path (real Corti coding/textgen + Claude reasoning) drops in
  behind the same `Pipeline` interface if API keys exist. The demo never depends on
  network.
- **Self-contained synthetic data**: `data.ts` generates 140 cases with planted fraud
  (villain "Dr. Elias Mercer", P-001, 45 cases). The `Case` schema is the seam for a
  teammate's richer data.
- **Deterministic $ impact**: `dollar_impact = (submitted − expected) × frequency ×
  penalty_multiplier` (2.5× fraud, 1× error). No LLM computes money.
- **Evidence spans**: `Case.evidence_spans` + `Finding.evidence_spans` carry char
  offsets into the clinical note so the UI highlights exact sentences per code.

## Run

```
cd app && npm run dev    # http://localhost:3000
```

## Conventions

- Keep docs agent-readable; this file is the entry point — update it when the
  project's shape changes.
- Commit secrets-free — `.env` is gitignored.
- The Matt Pocock skills plugin is enabled (code-review, tdd, grilling, etc.).
