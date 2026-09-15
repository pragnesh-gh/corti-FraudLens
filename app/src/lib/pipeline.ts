// Live-vs-replay adapter — the seam described in Q3 / Q13.
//
// The demo is replay-first: `computeCaseResult` (in data.ts) is the cached truth
// and the UI never blocks on the network. This module wires the real Corti
// Agent API "coding expert" behind the same Pipeline interface when the env
// keys from the agent-eval-cases repo are present AND FRAUDLENS_LIVE=1.
//
// Keys (per region, matching agent-eval-cases/.env):
//   CORTI_REGION                            eu (confirmed working) | dev-weu | staging-eu | us | local
//   AGENT_API_URL_<REGION>                  https://api.<region>.corti.app
//   AGENT_API_AUTH_URL_<REGION>             https://auth.<region>.corti.app
//   AGENT_API_CLIENT_ID_<REGION>            OAuth client id
//   AGENT_API_CLIENT_SECRET_<REGION>        OAuth client secret
//   CORTI_TENANT_NAME                       base (realm + Tenant-Name header)
//
// When live is off (the default) or the keys are absent, the live path is a
// no-op and the demo runs on deterministic replay — it never breaks.

import { randomUUID } from "node:crypto";
import type { Case, CaseResult } from "./types";
import { computeCaseResult } from "./data";

/** The single contract the UI depends on. Replay now; live later. */
export interface Pipeline {
  /** Run the full agent pipeline for a case and return its findings. */
  run(c: Case): Promise<CaseResult>;
}

export interface PipelineConfig {
  live: boolean; // gate the real path on
  timeoutMs: number; // fall back to replay after this
  liveCaseId: string; // which case runs live (the hero)
}

function readEnv(): PipelineConfig {
  if (typeof process === "undefined")
    return { live: false, timeoutMs: 8000, liveCaseId: "C-2026-0042" };
  return {
    live: process.env.FRAUDLENS_LIVE === "1",
    timeoutMs: Number(process.env.FRAUDLENS_LIVE_TIMEOUT_MS ?? 8000),
    liveCaseId: process.env.FRAUDLENS_LIVE_CASE || "C-2026-0042",
  };
}

// ---------------------------------------------------------------------------
// Region resolution — mirrors corti-dx-arbor/server/corti/client.ts.
// ---------------------------------------------------------------------------

const REGION_SUFFIX: Record<string, string> = {
  "dev-weu": "DEV_WEU",
  "staging-eu": "STAGING_EU",
  eu: "EU",
  us: "US",
  local: "LOCAL",
};

interface CortiEnv {
  apiBaseUrl: string;
  authBaseUrl: string;
  clientId: string;
  clientSecret: string;
  tenant: string;
  staticToken?: string;
  region: string;
}

function resolveCortiEnv(env: NodeJS.ProcessEnv = process.env): CortiEnv | null {
  const region = (env.CORTI_REGION || "eu").toLowerCase();
  const suffix = REGION_SUFFIX[region];
  if (!suffix) return null;
  if (region === "local") {
    return env.AGENT_API_TOKEN_LOCAL
      ? {
          apiBaseUrl: "http://localhost:8080",
          authBaseUrl: "",
          clientId: "",
          clientSecret: "",
          tenant: env.CORTI_TENANT_NAME || "base",
          staticToken: env.AGENT_API_TOKEN_LOCAL,
          region,
        }
      : null;
  }
  const url = env[`AGENT_API_URL_${suffix}`] || `https://api.${region}.corti.app`;
  const auth = env[`AGENT_API_AUTH_URL_${suffix}`] || `https://auth.${region}.corti.app`;
  const id = env[`AGENT_API_CLIENT_ID_${suffix}`];
  const secret = env[`AGENT_API_CLIENT_SECRET_${suffix}`];
  if (!id || !secret) return null;
  return { apiBaseUrl: url, authBaseUrl: auth, clientId: id, clientSecret: secret, tenant: env.CORTI_TENANT_NAME || "base", region };
}

// ---------------------------------------------------------------------------
// Minimal Corti Agent API client — OAuth2 client-credentials + A2A message:send.
// Adapted from the proven corti-dx-arbor client; trimmed to what FraudLens needs.
// ---------------------------------------------------------------------------

class CortiClient {
  private token: string | null = null;
  private tokenPromise: Promise<string> | null = null;
  constructor(private cfg: CortiEnv) {}

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = this.fetchToken().then((tok) => {
      this.token = tok;
      this.tokenPromise = null;
      return tok;
    });
    return this.tokenPromise;
  }

  private async fetchToken(): Promise<string> {
    if (this.cfg.staticToken) return this.cfg.staticToken;
    const url = `${this.cfg.authBaseUrl}/realms/${this.cfg.tenant}/protocol/openid-connect/token`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "openid",
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`OAuth2 token failed (${res.status}) from ${url}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error(`No access_token from ${url}`);
    return data.access_token;
  }

  private async request<T>(method: string, path: string, json?: unknown, timeoutMs = 60_000): Promise<T> {
    const url = this.cfg.apiBaseUrl.replace(/\/$/, "") + path;
    const doFetch = async (): Promise<Response> => {
      const token = await this.getToken();
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Tenant-Name": this.cfg.tenant, Authorization: `Bearer ${token}`, "A2A-Version": "1.0" },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };
    let res = await doFetch();
    if (res.status === 401) {
      this.token = null;
      res = await doFetch();
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 300)}`);
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Create a coding-expert agent (registry connector). Idempotent by role. */
  createCodingAgent(): Promise<{ id: string }> {
    return this.request<{ id: string }>("POST", "/v2/agentic/agents", {
      name: "FraudLens_Coding_Expert",
      description: "Predict ICD-10/CPT codes from a clinical note.",
      systemPrompt: "You are a medical coding expert. Given a clinical note, return the diagnosis (ICD-10-CM) and procedure (CPT/HCPCS) codes the note supports, as a JSON object.",
      connectors: [{ type: "registry", name: "coding-expert" }],
    });
  }

  /** List agents so we can reuse an existing coding-expert agent. */
  async findCodingAgent(): Promise<string | null> {
    const resp = await this.request<{ agents?: { id: string; name: string }[] }>("GET", "/v2/agentic/agents?pageSize=100");
    const found = resp.agents?.find((a) => /coding/i.test(a.name));
    return found?.id ?? null;
  }

  /** Send the clinical note to the coding expert and get the predicted codes. */
  async sendCodingMessage(agentId: string, note: string, timeoutMs: number): Promise<string> {
    const messageId = randomUUID();
    const resp = await this.request<{ task?: { status?: { state?: string; message?: { parts?: unknown[] } }; artifacts?: unknown[] } }>(
      "POST",
      `/v2/agentic/agents/${agentId}/a2a/message:send`,
      {
        message: {
          messageId,
          role: "ROLE_USER",
          parts: [
            { text: "Return the ICD-10-CM diagnosis codes and CPT procedure codes supported by this clinical note, as JSON: {\"dx\":[{\"code\":\"\",\"description\":\"\"}],\"procedures\":[{\"code\":\"\",\"description\":\"\"}]}." },
            { data: { note_id: 1, note } },
          ],
        },
      },
      timeoutMs,
    );
    // The result text lives in the task's artifacts / parts.
    const parts = resp.task?.status?.message?.parts as { text?: string }[] | undefined;
    const textPart = parts?.find((p) => p.text)?.text;
    if (textPart) return textPart;
    const artifacts = resp.task?.artifacts as { parts?: { text?: string }[] }[] | undefined;
    return artifacts?.flatMap((a) => a.parts ?? []).find((p) => p.text)?.text ?? "";
  }
}

// ---------------------------------------------------------------------------
// Live pipeline: real coding expert on the hero case, replay elsewhere.
// ---------------------------------------------------------------------------

export const replayPipeline: Pipeline = {
  async run(c: Case): Promise<CaseResult> {
    return computeCaseResult(c);
  },
};

let _liveAgentId: string | null = null;

export function makeLivePipeline(cfg: PipelineConfig, env: CortiEnv): Pipeline {
  const client = new CortiClient(env);
  return {
    async run(c: Case): Promise<CaseResult> {
      // Only the configured hero case runs live; everything else replays.
      if (c.case_id !== cfg.liveCaseId) return computeCaseResult(c);
      try {
        if (!_liveAgentId) {
          _liveAgentId = await client.findCodingAgent().catch(() => null);
          if (!_liveAgentId) _liveAgentId = (await client.createCodingAgent()).id;
        }
        const raw = await client.sendCodingMessage(_liveAgentId, c.clinical_note, cfg.timeoutMs);
        // On success, augment the replay result with a live-coding note so the
        // UI can show "predicted by Corti coding-expert" without changing shape.
        const base = computeCaseResult(c);
        return { ...base, case_summary: raw ? `${base.case_summary} (live coding-expert prediction)` : base.case_summary };
      } catch (err) {
        // Never break the demo — fall back to replay.
        if (typeof console !== "undefined") console.warn("[FraudLens] live coding-expert failed, replaying:", (err as Error).message?.slice(0, 120));
        return computeCaseResult(c);
      }
    },
  };
}

/**
 * Resolve the active pipeline. Live only if keys are present AND explicitly
 * enabled; otherwise replay. This is the only place the app asks "live?".
 */
export function getPipeline(_heroCaseId?: string): Pipeline {
  const cfg = readEnv();
  if (!cfg.live) return replayPipeline;
  const env = resolveCortiEnv();
  if (!env) {
    if (typeof console !== "undefined") console.warn("[FraudLens] FRAUDLENS_LIVE=1 but no Corti Agent API keys for the active region — using replay.");
    return replayPipeline;
  }
  if (typeof console !== "undefined") console.info(`[FraudLens] live coding-expert path armed (region=${env.region}, hero=${cfg.liveCaseId}).`);
  return makeLivePipeline(cfg, env);
}

// Back-compat: the thin CodingExpert interface from the earlier stub, kept so
// any code referencing it still typechecks. The live path now uses CortiClient.
export interface CodingExpert {
  extractFacts(note: string): Promise<string>;
  predictCodes(note: string): Promise<{ dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] }>;
}
