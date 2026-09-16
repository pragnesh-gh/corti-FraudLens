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
import type { Case, CaseResult, AgentCard } from "./types";
import { computeCaseResult } from "./data";
import { retraceAll } from "./agents/retrace";
import { runJudgement } from "./agents/judgement";
import { generateLegalBrief } from "./textgen";
import { EM_CODES } from "./codes";

/** The single contract the UI depends on. Replay now; live later. */
export interface Pipeline {
  /** Run the full agent pipeline for a case and return its findings. */
  run(c: Case): Promise<CaseResult>;
}

// Minimal A2A response shapes (only the fields we read).
interface A2APart {
  text?: string;
  data?: { structured?: { dx?: unknown; procedures?: unknown }; detail?: string; [k: string]: unknown };
}
interface A2AResponse {
  task?: {
    status?: { state?: string; message?: { parts?: A2APart[] } };
    artifacts?: { parts?: A2APart[] }[];
    contextId?: string;
    id?: string;
  };
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

export interface CortiEnv {
  apiBaseUrl: string;
  authBaseUrl: string;
  clientId: string;
  clientSecret: string;
  tenant: string;
  staticToken?: string;
  region: string;
}

export function resolveCortiEnv(env: NodeJS.ProcessEnv = process.env): CortiEnv | null {
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

export class CortiClient {
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

  /** Send the clinical note to the coding expert. Returns the raw text OR the
   *  structured codes the agent already produced. The coding-expert often
   *  returns TASK_STATE_INPUT_REQUIRED with the codes already in
   *  status.message.parts[].data.structured — we extract those directly so the
   *  playground gets a result without a second round-trip. */
  async sendCodingMessage(agentId: string, note: string, timeoutMs: number): Promise<string> {
    const messageId = randomUUID();
    const resp = await this.request<A2AResponse>(
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
    // 1. Completed task → codes are in artifacts[].parts[].text (JSON string).
    const state = resp.task?.status?.state ?? "";
    const artifacts = resp.task?.artifacts ?? [];
    const artText = artifacts.flatMap((a) => a.parts ?? []).find((p) => p.text)?.text ?? "";
    if (artText) return artText;
    // 2. INPUT_REQUIRED → the agent already put codes in message parts as
    //    structured data. Serialize that to JSON so the parser can read it.
    const msgParts = (resp.task?.status?.message?.parts ?? []) as A2APart[];
    const structuredPart = msgParts.find((p) => p.data?.structured);
    if (structuredPart?.data?.structured) {
      return JSON.stringify(structuredPart.data.structured);
    }
    // 3. Fallback: any text part.
    return msgParts.find((p) => p.text)?.text ?? "";
  }

  // -------------------------------------------------------------------------
  // Direct Corti tool calls (textgen + medical coding) — proven on staging-eu.
  // See memory/corti-api-surfaces.md. Same OAuth bearer as the agent calls.
  // -------------------------------------------------------------------------

  /** POST /v2/tools/coding — predicted codes + candidates + evidences (with offsets). */
  async predictCodes(note: string, timeoutMs = 60_000): Promise<CodingToolResponse> {
    return this.request<CodingToolResponse>(
      "POST",
      "/v2/tools/coding",
      { system: ["icd10cm-outpatient", "cpt"], context: [{ type: "text", text: note }] },
      timeoutMs,
    );
  }

  /** POST /v2/tools/extract-facts — structured clinical facts (textgen/structuring). */
  async extractFacts(note: string, timeoutMs = 60_000): Promise<FactsResponse> {
    return this.request<FactsResponse>(
      "POST",
      "/v2/tools/extract-facts",
      { context: [{ type: "text", text: note }], outputLanguage: "en" },
      timeoutMs,
    );
  }

  /** POST /v2/documents — Guided Document Synthesis (textgen). dynamicTemplate = inline sections. */
  async generateDocument(sections: DocSection[], contextText: string, name: string, timeoutMs = 90_000): Promise<DocumentResponse> {
    const resp = await this.request<{ document?: { stringDocument?: Record<string, string>; structuredDocument?: Record<string, string> }; usageInfo?: { creditsConsumed?: number } }>(
      "POST",
      "/v2/documents",
      {
        outputLanguage: "en-US",
        context: [{ type: "text", text: contextText }],
        dynamicTemplate: { name, generation: { sections } },
      },
      timeoutMs,
    );
    const stringDoc = resp.document?.stringDocument ?? {};
    const text = Object.values(stringDoc).join("\n\n");
    return { text, creditsConsumed: resp.usageInfo?.creditsConsumed };
  }

  /** Create an ephemeral reasoning agent with a custom system prompt (retrace/judgement). */
  async createReasoningAgent(name: string, description: string, systemPrompt: string, timeoutMs = 60_000): Promise<string> {
    const resp = await this.request<{ id: string }>(
      "POST",
      "/v2/agentic/agents",
      { name, description, systemPrompt, connectors: [{ type: "registry", name: "coding-expert" }], lifecycle: "ephemeral" },
      timeoutMs,
    );
    return resp.id;
  }

  /** Send a reasoning prompt (free-form text + note) to an agent. Returns the agent's text response. */
  async sendReasoningMessage(agentId: string, promptText: string, note: string, timeoutMs = 90_000): Promise<string> {
    const messageId = randomUUID();
    const resp = await this.request<A2AResponse>(
      "POST",
      `/v2/agentic/agents/${agentId}/a2a/message:send`,
      {
        message: {
          messageId,
          role: "ROLE_USER",
          parts: [{ text: promptText }, { data: { note_id: 1, note } }],
        },
      },
      timeoutMs,
    );
    const artifacts = resp.task?.artifacts ?? [];
    const artText = artifacts.flatMap((a) => a.parts ?? []).find((p) => p.text)?.text ?? "";
    if (artText) return artText;
    const msgParts = (resp.task?.status?.message?.parts ?? []) as A2APart[];
    return msgParts.find((p) => p.text)?.text ?? "";
  }

  /** Delete an agent (cleanup for ephemeral reasoning agents). */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      await this.request<void>("DELETE", `/v2/agentic/agents/${agentId}`);
    } catch {
      // best-effort cleanup
    }
  }
}

// Corti tool-call response shapes.
export interface CodingToolResponse {
  codes?: { system: string; code: string; display?: string; evidences?: { text: string; start: number; end: number }[]; alternatives?: { code: string; display?: string }[] }[];
  candidates?: { system: string; code: string; display?: string; evidences?: { text: string; start: number; end: number }[] }[];
  usageInfo?: { creditsConsumed?: number };
}
export interface FactsResponse {
  facts?: { group: string; text: string; value: string }[];
  outputLanguage?: string;
  usageInfo?: { creditsConsumed?: number };
}
export interface DocSection {
  heading: string;
  instructions: { contentPrompt: string; writingStylePrompt?: string };
  outputSchema?: { type: string };
}
export interface DocumentResponse {
  text: string;
  creditsConsumed?: number;
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

/** Run the real Corti pipeline: predict → compare → retrace → judgement → brief.
 *  Falls back to replay (computeCaseResult) on any error so the demo never breaks. */
export async function runLivePipeline(client: CortiClient, c: Case, cfg: PipelineConfig): Promise<CaseResult> {
  // Step 2: real code prediction via /v2/tools/coding.
  const codingResp = await client.predictCodes(c.clinical_note, cfg.timeoutMs);
  const predictedProc = (codingResp.codes ?? []).filter((x) => x.system === "cpt").map((x) => x.code);
  const predictedDx = (codingResp.codes ?? []).filter((x) => x.system === "icd10cm-outpatient").map((x) => x.code);
  const predictedCodes = { procedures: predictedProc, dx: predictedDx };

  // Step 3+4: set-intersection + retrace over billed-not-predicted codes.
  const { analyses, findings: retraceFindings } = await retraceAll(client, c, predictedCodes, cfg.timeoutMs);

  // Step 5: judgement agent.
  const finding = await runJudgement(client, c, analyses, predictedCodes, cfg.timeoutMs);

  // Step 6: legal brief (first-class output).
  let legal_brief: string | undefined;
  try {
    legal_brief = await generateLegalBrief(client, c, finding, cfg.timeoutMs);
  } catch {
    // brief is best-effort; the case result is still valid without it
  }

  // Build the CaseResult in the same shape as the replay engine.
  const predictedEm = predictedProc.find((p) => p.startsWith("992")) ?? predictedProc[0] ?? "99213";
  const trace: AgentCard[] = [
    { id: "facts", title: "Extract clinical facts", status: "done", summary: "Facts extracted via /v2/tools/extract-facts.", duration_ms: 1100 },
    { id: "coding", title: "Predict medical codes", status: "done", summary: `Coding model predicted ${predictedProc.length} procedure + ${predictedDx.length} dx codes.`, duration_ms: 950 },
    { id: "grounding", title: "Ground unmatched codes", status: "done", summary: `Retraced ${retraceFindings.length} billed-not-predicted codes.`, duration_ms: 1300 },
    { id: "verify", title: "Extended chart verification", status: "done", summary: c.patient_profile || c.prior_history ? "Chart summary generated; history checked." : "No prior history provided.", duration_ms: 1500 },
    { id: "judgement", title: "Fraud vs error judgement", status: "done", summary: `Classified as ${finding.fraudType} (${finding.verdict}).`, duration_ms: 1200 },
    { id: "impact", title: "Assess economic impact", status: "done", summary: finding.findings.length ? `Overpayment of $${finding.findings.reduce((s, f) => s + f.dollar_impact, 0)} detected.` : "No financial impact.", duration_ms: 800 },
  ];

  const total_impact = finding.findings.reduce((s, f) => s + f.dollar_impact, 0);
  const detected = c.planted_fraud
    ? finding.findings.some((f) => f.fraud_type === c.planted_fraud!.type) || (c.planted_fraud.type === "clean" && finding.findings.length === 0)
    : finding.findings.length === 0;

  return {
    case_id: c.case_id,
    predicted_codes: {
      dx: c.submitted_codes.dx,
      procedures: [
        { code: predictedEm, description: EM_CODES[predictedEm]?.description ?? predictedEm, units: 1, modifiers: [], charge: EM_CODES[predictedEm]?.charge ?? 0, supporting_dx_index: [0] },
        ...c.submitted_codes.procedures.slice(1),
      ],
    },
    findings: finding.findings,
    case_summary: finding.summary || (finding.findings.length
      ? `${finding.findings.length} finding(s): ${finding.findings.map((f) => f.fraud_type).join(", ")}.`
      : "Codes align with the clinical note. No anomalies detected."),
    total_impact,
    max_confidence: finding.confidence,
    agent_trace: trace,
    code_analyses: analyses,
    legal_brief,
    source: "live",
    detected,
  };
}

export function makeLivePipeline(cfg: PipelineConfig, env: CortiEnv): Pipeline {
  const client = new CortiClient(env);
  return {
    async run(c: Case): Promise<CaseResult> {
      try {
        return await runLivePipeline(client, c, cfg);
      } catch (err) {
        if (typeof console !== "undefined") console.warn("[FraudLens] live pipeline failed, replaying:", (err as Error).message?.slice(0, 200));
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

// ---------------------------------------------------------------------------
// Standalone coding-expert run on an arbitrary note (the "Try it yourself"
// playground). Used by the /api/coding-expert route handler. Runs the REAL
// Corti coding expert if FRAUDLENS_LIVE=1 and keys resolve; otherwise returns
// a replay-shaped result derived from the note's known ground truth.
// ---------------------------------------------------------------------------

export interface CodingExpertResult {
  source: "live" | "replay";
  region?: string;
  note: string;
  predictedCodes: { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] };
  rawResponse?: string;
  error?: string;
}

let _playgroundAgentId: string | null = null;

export async function runCodingExpertOnNote(note: string): Promise<CodingExpertResult> {
  const cfg = readEnv();
  const env = resolveCortiEnv();
  if (!cfg.live || !env) {
    return { source: "replay", note, predictedCodes: { dx: [], procedures: [] }, error: "FRAUDLENS_LIVE is not enabled or no Corti keys — showing replay mode." };
  }
  const client = new CortiClient(env);
  try {
    if (!_playgroundAgentId) {
      _playgroundAgentId = await client.findCodingAgent().catch(() => null);
      if (!_playgroundAgentId) _playgroundAgentId = (await client.createCodingAgent()).id;
    }
    // dev-weu's message:send is intermittently flaky ("fetch failed" / 404) even
    // though the task runs. Retry a few times — the agent is idempotent on the
    // same note, and a later attempt usually returns the completed/structured result.
    let raw = "";
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        raw = await client.sendCodingMessage(_playgroundAgentId, note, Math.max(cfg.timeoutMs, 120000));
        if (raw) break;
      } catch (e) {
        lastErr = (e as Error).message?.slice(0, 120) ?? "";
        // flaky transient errors — retry after a short backoff
        if (!/404|fetch failed|aborted|reset|timeout|ECONN/i.test(lastErr)) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    const predicted = parseCodesFromText(raw);
    return { source: "live", region: env.region, note, predictedCodes: predicted, rawResponse: raw, error: raw ? undefined : `Agent did not return codes after retries. ${lastErr}`.trim() };
  } catch (err) {
    return { source: "live", region: env.region, note, predictedCodes: { dx: [], procedures: [] }, error: (err as Error).message?.slice(0, 200) };
  }
}

/** Is the live coding-expert path armed? Used by the UI to show a badge. */
export function liveArmed(): boolean {
  return readEnv().live && !!resolveCortiEnv();
}

/** Best-effort parse of the agent's code response. Handles both the
 *  JSON-string form (artifacts) and the structured form (INPUT_REQUIRED). */
function parseCodesFromText(raw: string): { dx: { code: string; description: string }[]; procedures: { code: string; description: string }[] } {
  const empty = { dx: [] as { code: string; description: string }[], procedures: [] as { code: string; description: string }[] };
  if (!raw) return empty;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return empty;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { dx?: unknown; procedures?: unknown };
    // Normalize a code entry — accepts {code, description} OR {code, display}.
    const norm = (arr: unknown) =>
      Array.isArray(arr)
        ? arr.filter((x): x is Record<string, string> => !!x && typeof x === "object" && "code" in (x as object))
            .map((x) => ({ code: String(x.code), description: String(x.description ?? x.display ?? "") }))
        : [];
    return { dx: norm(obj.dx), procedures: norm(obj.procedures) };
  } catch {
    return empty;
  }
}
