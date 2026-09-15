// Live-vs-replay adapter — the seam described in Q3 / Q13.
//
// The demo is replay-first: `computeCaseResult` (in data.ts) is the cached truth
// and the UI never blocks on the network. This module is the thin interface a
// real "coding expert" path drops in behind when the environment keys exist:
//
//   CORTI_API_KEY      → Corti Medical Coding + TextGen (clinical backbone)
//   ANTHROPIC_API_KEY  → Claude for the fraud/error judgement step
//
// When both are set AND FRAUDLENS_LIVE=1, the hero case runs against the real
// agents; every other case stays on replay. When they are absent the live path
// is a no-op and `--live` is inert — the safe default.

import type { Case, CaseResult, Finding } from "./types";
import { computeCaseResult } from "./data";

/** The single contract the UI depends on. Replay now; live later. */
export interface Pipeline {
  /** Run the full agent pipeline for a case and return its findings. */
  run(c: Case): Promise<CaseResult>;
}

export interface PipelineConfig {
  live: boolean; // gate the real path on
  timeoutMs: number; // fall back to replay after this
}

function readEnv(): PipelineConfig {
  if (typeof process === "undefined") return { live: false, timeoutMs: 8000 };
  return {
    live: process.env.FRAUDLENS_LIVE === "1",
    timeoutMs: Number(process.env.FRAUDLENS_LIVE_TIMEOUT_MS ?? 8000),
  };
}

function keysPresent(): boolean {
  if (typeof process === "undefined") return false;
  return Boolean(process.env.CORTI_API_KEY && process.env.ANTHROPIC_API_KEY);
}

/**
 * The coding-expert adapter. Corti Medical Coding predicts codes + evidence,
 * Claude judges fraud vs error. Stubbed here so the app builds without the
 * SDK installed; the real implementation drops in behind `predictCodes` /
 * `extractFacts` / `judgeFraud` without changing this signature.
 */
export interface CodingExpert {
  extractFacts(note: string): Promise<string>;
  predictCodes(note: string): Promise<{ dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] }>;
  judgeFraud(c: Case, predicted: { dx: unknown[]; procedures: unknown[] }): Promise<Finding[]>;
}

/** Replay pipeline: deterministic, instant, the cached truth. */
export const replayPipeline: Pipeline = {
  async run(c: Case): Promise<CaseResult> {
    return computeCaseResult(c);
  },
};

/**
 * Resolve the active pipeline. Live only if keys are present AND explicitly
 * enabled; otherwise replay. This is the only place the app asks "live?".
 */
export function getPipeline(_heroCaseId?: string): Pipeline {
  const cfg = readEnv();
  if (!cfg.live || !keysPresent()) return replayPipeline;

  // Live path is intentionally deferred: when the Corti JS SDK is wired in,
  // construct a LivePipeline here that calls the CodingExpert with cfg.timeoutMs
  // and falls back to replayPipeline on timeout. For now the keys gate a
  // console notice only, so the demo never breaks.
  if (typeof console !== "undefined") {
    console.info("[FraudLens] live keys present but live path not yet wired — using replay.");
  }
  return replayPipeline;
}
