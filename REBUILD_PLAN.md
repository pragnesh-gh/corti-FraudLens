# FraudLens Rebuild Plan — dark-luminous + honest detector

Grounded in: three sibling-repo explorations, a grilling brief, Corti capability probes (live, staging-eu), docs/thoughts.md. All three Corti capabilities (textgen, medical coding, agentic) are proven live on staging-eu. See `memory/corti-api-surfaces.md` for endpoint/auth details.

## Product (the crux)
Clinical note + billing company's codes → our coding expert predicts codes → set-intersection comparison (common = fine; billed-not-predicted = investigate) → per-uncommon-code retrace agent rates agreeability + grounding → judgement agent classifies category + fraud-vs-error → legal brief + economic impact. Planted fraud is ANSWER-KEY ONLY (validates the detector); the pipeline must independently arrive at findings. Mismatch = the demo's honesty signal ("detector caught N/M injected schemes").

## Locked topology — 3 agents + tools, all on staging-eu (credited)
- Tool: `POST /v2/tools/extract-facts` — structured facts (textgen/structuring).
- Tool: `POST /v2/tools/coding` — predicted codes + candidates + evidences (with char offsets). Richer than the agent path.
- Agent 1 (exists): Coding Expert — `coding-expert` registry agent, predicts codes.
- Agent 2 (crux, NEW): Retrace/Grounding — for each billed-not-predicted code, `coding-expert` agent reasons → `{agreeability(0-100), grounding(supported|weakly_supported|unsupported|contradicted), noteExcerpts[], historyContradiction?}`. Patient history (from Guided-Docs chart summary) is passed in to catch history-contradiction (amputation) cases.
- Agent 3 (NEW): Judgement — `coding-expert` agent (Envoy/Models both blocked) → `CaseFinding {verdict, fraudType, fraudVsError, confidence, summary, details[]}`. Agreeability is an INPUT to judgement; category+verdict is the OUTPUT (two axes, not one).
- Tool: `POST /v2/documents` (Guided Docs, dynamicTemplate Path 4) — chart summary (feeds Agent 2 history check) + legal-brief draft (13-section, LLM-filled from Agent 3). The headline textgen showcase.
- Tool: deterministic economic impact + findings persistence.

BLOCKED (do not use): Envoy gateway (JWT expired), Corti Models chat/completions (402 eu out of credits), `/v2/agentic/registry/experts` (403), `/v2/tools/documents` (wrong path; real one is `/v2/documents`).

## Two parallel tracks (gated)

### Track A — visual foundation (dark luminous)
Hackathon's DESIGN.md palette + glassmorphism. Dark ink-violet canvas `#0B081E`, Radiant Fuchsia `#FF2A8D` (critical), Solar Amber `#FF8A00` (warnings), Electric Violet `#7B2CBF` (AI), Emerald `#00F5A0` (clean). Fonts: Plus Jakarta Sans (headlines), Inter (body), JetBrains Mono (codes/$). Reconcile the dual fraud palette → pick the neon DESIGN.md set for chrome. Serious surfaces (legal brief, evidence tables) get a restrained printable variant inside the dark shell (print stylesheet flips to white).
Files: `app/src/app/globals.css`, `app/src/components/ui.tsx` (new primitives: glass Card, score gauge, pipeline stepper, code-comparison table), `app/src/components/app-shell.tsx`, `app/src/lib/fraud-meta.ts` (colors). Disjoint from Track B.
Keep: the tour engine + 7-step CSS/SVG animations (survive palette swap), the presenter `/demo` (iframe-driven, theme-agnostic), evidence-span highlighting. Rewrite the tour STEP CONTENT later (Track B gated).

### Track B — detector core (honest pipeline)
1. **Rip the cheat** (FIRST code change): `computeCaseResult`/`computeFindings`/`predictEmFromNote` in `app/src/lib/data.ts` stop reading `planted_fraud` for outputs. `planted_fraud` becomes answer-key only. The pipeline produces findings from real comparison + reasoning.
2. **`codes.predict`**: replace the planted-reading prediction with a real `POST /v2/tools/coding` call (live) + a deterministic mock fallback for offline/replay. Capture candidates + evidences.
3. **Set-intersection comparison**: common / billed-not-predicted / predicted-not-billed. Port team_fraud's `CodeAnalysis` shape, ADAPT to add `agreeability`, `grounding`, `category`, `verdict` per code (it lacks these).
4. **Agent 2 retrace**: per uncommon code, `coding-expert` agent → agreeability+grounding+noteExcerpts. For history cases, call Guided Docs chart summary first, pass into Agent 2 context.
5. **Agent 3 judgement**: `coding-expert` agent → `CaseFinding` (category + fraud-vs-error + confidence).
6. **Legal brief**: Guided Docs `POST /v2/documents` (dynamicTemplate legal sections) + deterministic 13-section skeleton from hackathon's `build_legal_brief` (FCA §3729/§1347/§1320a-7, qui-tam, hedged microcopy). First-class.
7. **Persist**: build script runs the real pipeline over all eval cases → `PipelineResult` JSON. Tour + case-detail replay that. "Try it yourself" is the live path. Live is supported but not the only thing on stage.

Files: `app/src/lib/pipeline.ts`, `app/src/lib/data.ts`, `app/src/lib/types.ts` (new/extended), `app/src/lib/agents/` (new retrace + judgement), `app/src/lib/textgen.ts` (new Guided Docs client), `app/scripts/precompute.mjs` (new).

### Gated after A+B
- Tour rewire: steps become prediction → compare → retrace → agreeability (not truth-reveal). Consumes persisted JSON.
- Legal brief UI (gated on B-6).
- Architecture diagram view (after agent list settled — now settled).
- Pattern analysis (LAST — needs findings DB + real baseline; team_fraud's magic-0.02 is a toy, defer).
- DefinitionsModal (cheap, theme-agnostic — can come in Track A or after).

## Decisions locked
- Theme: dark luminous.
- Agent scope: 3 agents + tools (not 6; stages ≠ agents). Chart verification folded into Agent 2 + Guided Docs chart summary.
- Demo: both live AND precomputed-from-real (precomputed tours + live "try it yourself").
- Legal brief: first-class, right after pipeline.
- Execution: two parallel tracks, gated.
- Agent 3 backing: coding-expert agent (Envoy/Models blocked).
