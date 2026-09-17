# corti-FraudLens

AI-driven medical-coding fraud detection, built on [Corti](https://corti.ai)'s
platform for the Corti Hack for Health. Feed it a clinical note and the codes a
provider billed — a coding-expert agent predicts the codes the note actually
supports, compares them against the bill, and investigates every discrepancy:
citing the note, rating defensibility, and drafting a legal brief.

**Replay-first**: runs end-to-end with zero credentials using precomputed
results. Add Corti API keys and flip one env flag to run the real agents live —
the UI is identical either way.

Full documentation lives in [`app/README.md`](app/README.md). See `AGENTS.md`
for the architecture and `docs/` for research + decisions.

## Quick start

```
cd app
cp .env.example .env      # leave keys blank for replay mode (works offline)
npm install
npm run dev               # → http://localhost:3000
```

## Claude Code setup

This repo enables the **Matt Pocock skills** plugin (grilling, TDD,
code review, domain modeling, docs-for-agents, etc.) via project-level
settings in `.claude/settings.json`.

First-time setup on a fresh machine — add the marketplace and install the
plugin once (user-scoped):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install mattpocock-skills@claude-plugins-official
```

After that, opening this repo automatically enables the skills.
