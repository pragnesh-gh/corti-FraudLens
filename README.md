# Corticon Hackathon

Bare-bones scaffold for a Corticon hackathon project. Gets converted into a
real codebase as we build.

## Claude Code setup

This repo enables the **Matt Pocock skills** plugin (grilling, TDD,
code review, domain modeling, docs-for-agents, etc.) via project-level
settings in `.claude/settings.json`.

First-time setup on a fresh machine — add the marketplace and install
the plugin once (user-scoped):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install mattpocock-skills@claude-plugins-official
```

After that, opening this repo automatically enables the skills.

## Status

FraudLens app is built and runs — Case Queue, Case Detail (streaming agent
cards + note-highlighted findings), Provider Pattern Dashboard, and a Guided
Tour. See `AGENTS.md` for the architecture and `docs/` for research + decisions.

```
cd app && npm run dev    # http://localhost:3000
```
