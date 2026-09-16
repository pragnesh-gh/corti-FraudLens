// One-off diagnostic: probe Corti capabilities that the FraudLens rebuild depends on.
// Reuses the proven OAuth2 + A2A flow from src/lib/pipeline.ts.
//   1. getRegistryExperts()  — what experts exist beyond coding-expert?
//   2. Envoy LLM gateway      — is the generic-LLM JWT still valid (for the Judgement agent)?
//   3. Textgen path           — can we use facts.extract and/or documents.create as a textgen showcase?
//
// Run: node --env-file=.env scripts/probe-capabilities.mjs
// Safe to re-run; creates one ephemeral agent + cleans it up.

import { randomUUID } from "node:crypto";

const region = (process.env.CORTI_REGION || "eu").toLowerCase();
const REGION_SUFFIX = { "dev-weu": "DEV_WEU", "staging-eu": "STAGING_EU", eu: "EU", us: "US", local: "LOCAL" };
const suffix = REGION_SUFFIX[region];

function resolveCortiEnv() {
  if (region === "local") {
    return process.env.AGENT_API_TOKEN_LOCAL
      ? { apiBaseUrl: "http://localhost:8080", authBaseUrl: "", clientId: "", clientSecret: "", tenant: process.env.CORTI_TENANT_NAME || "base", staticToken: process.env.AGENT_API_TOKEN_LOCAL, region }
      : null;
  }
  const url = process.env[`AGENT_API_URL_${suffix}`] || `https://api.${region}.corti.app`;
  const auth = process.env[`AGENT_API_AUTH_URL_${suffix}`] || `https://auth.${region}.corti.app`;
  const id = process.env[`AGENT_API_CLIENT_ID_${suffix}`];
  const secret = process.env[`AGENT_API_CLIENT_SECRET_${suffix}`];
  if (!id || !secret) return null;
  return { apiBaseUrl: url, authBaseUrl: auth, clientId: id, clientSecret: secret, tenant: process.env.CORTI_TENANT_NAME || "base", region };
}

const cfg = resolveCortiEnv();
const out = (label, ok, data) => console.log(`\n===== ${label} =====\nstatus: ${ok ? "OK" : "FAIL"}\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`);

if (!cfg) {
  out("CONFIG", false, `No Corti creds for region=${region} (suffix=${suffix}). Set AGENT_API_CLIENT_ID_${suffix} / _SECRET_${suffix}, or CORTI_REGION.`);
  process.exit(0);
}

let token = null;
async function getToken() {
  if (token) return token;
  if (cfg.staticToken) { token = cfg.staticToken; return token; }
  const url = `${cfg.authBaseUrl}/realms/${cfg.tenant}/protocol/openid-connect/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "openid", client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OAuth2 failed ${res.status} from ${url}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token from ${url}`);
  token = data.access_token;
  return token;
}

async function apiRequest(method, path, json, timeoutMs = 60_000) {
  const url = cfg.apiBaseUrl.replace(/\/$/, "") + path;
  const doFetch = async () => {
    const t = await getToken();
    return fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Tenant-Name": cfg.tenant, Authorization: `Bearer ${t}`, "A2A-Version": "1.0" },
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  };
  let res = await doFetch();
  if (res.status === 401) { token = null; res = await doFetch(); }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function tryParse(text) { try { return JSON.parse(text); } catch { return text?.slice(0, 500); } }

// A short, safe clinical note for any textgen/coding probes.
const SAMPLE_NOTE =
  "Patient seen for routine follow-up of hypertension. BP 128/82, no edema, no chest pain. " +
  "Assessment: essential hypertension, well controlled. Plan: continue lisinopril, recheck in 6 months. " +
  "No acute complaints. Counseling provided on low-sodium diet for 15 minutes.";

async function main() {
  out("CONFIG", true, { region, apiBaseUrl: cfg.apiBaseUrl, tenant: cfg.tenant, static: !!cfg.staticToken });

  // ----- 1. Registry experts -------------------------------------------------
  try {
    // Try a couple of likely endpoint shapes; the SDK's getRegistryExperts maps to one of these.
    let r = await apiRequest("GET", "/v2/agentic/registry/experts");
    if (!r.ok) r = await apiRequest("GET", "/v2/agentic/experts");
    if (!r.ok) r = await apiRequest("GET", "/v2/agentic/registry");
    out("REGISTRY EXPERTS", r.ok, { status: r.status, body: tryParse(r.text) });
  } catch (e) { out("REGISTRY EXPERTS", false, String(e)); }

  // ----- 2. Envoy LLM gateway ------------------------------------------------
  // A simple chat-completion-style call against the Envoy proxy. Validates the JWT.
  const envoyBase = process.env.ENVOY_API_BASE;
  const envoyKey = process.env.ENVOY_API_KEY;
  const llmModel = process.env.LLM_MODEL_NAME;
  if (!envoyBase || !envoyKey || !llmModel) {
    out("ENVOY LLM", false, `Missing env: ${[!envoyBase && "ENVOY_API_BASE", !envoyKey && "ENVOY_API_KEY", !llmModel && "LLM_MODEL_NAME"].filter(Boolean).join(", ")}`);
  } else {
    try {
      const res = await fetch(`${envoyBase.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${envoyKey}` },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          max_tokens: 5,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      // If the JWT is expired the proxy usually returns 401/403.
      out("ENVOY LLM", res.ok, { status: res.status, endpoint: `${envoyBase}/chat/completions`, model: llmModel, body: tryParse(text) });
    } catch (e) { out("ENVOY LLM", false, String(e)); }
  }

  // ----- 3a. Textgen: facts.extract -----------------------------------------
  // facts.extract is the cleanest standalone textgen capability (structuring).
  try {
    const r = await apiRequest("POST", "/v2/tools/extract-facts", { context: [{ type: "text", text: SAMPLE_NOTE }], outputLanguage: "en" });
    out("FACTS.EXTRACT (textgen)", r.ok, { status: r.status, body: tryParse(r.text) });
  } catch (e) { out("FACTS.EXTRACT (textgen)", false, String(e)); }

  // ----- 3b. Textgen: documents.create --------------------------------------
  // documents.create generates a document from facts via a templateKey. It may
  // require an interactionId — we probe whether it works without one.
  try {
    const r = await apiRequest("POST", "/v2/tools/documents", {
      context: [{ type: "facts", data: { reason_for_visit: "hypertension follow-up", assessment: "essential hypertension, well controlled" } }],
      templateKey: "chart-summary",
      outputLanguage: "en",
    });
    out("DOCUMENTS.CREATE (textgen)", r.ok, { status: r.status, body: tryParse(r.text) });
  } catch (e) { out("DOCUMENTS.CREATE (textgen)", false, String(e)); }

  // ----- 4. Coding tool (codes.predict) — richer than the agent path? -------
  // Returns codes + candidates + evidences with offsets — better grounding data.
  try {
    const r = await apiRequest("POST", "/v2/tools/coding", {
      system: ["icd10cm-outpatient", "cpt"],
      context: [{ type: "text", text: SAMPLE_NOTE }],
    });
    out("CODES.PREDICT (medical coding)", r.ok, { status: r.status, body: tryParse(r.text) });
  } catch (e) { out("CODES.PREDICT (medical coding)", false, String(e)); }

  // ----- 5. Agentic: prove multi-turn reasoning is reachable -----------------
  // Create an ephemeral agent whose job is REASONING (not coding) and send it a
  // single uncommon-code question. Validates the A2A path for the retrace agent.
  let createdId = null;
  try {
    const createRes = await apiRequest("POST", "/v2/agentic/agents", {
      name: `FraudLens_probe_${randomUUID().slice(0, 8)}`,
      description: "Probe: reasons about whether a single billed code is defensible.",
      systemPrompt: "You are a medical coding auditor. Given a clinical note and ONE billed code the model did not predict, assess whether the code is defensible. Reply ONLY with JSON: {\"agreeability\": <0-100>, \"grounding\": \"supported|weakly_supported|unsupported|contradicted\", \"reasoning\": \"...\", \"noteExcerpts\": [\"...\"]}.",
      connectors: [{ type: "registry", name: "coding-expert" }],
      lifecycle: "ephemeral",
    });
    const created = tryParse(createRes.text);
    createdId = created?.id ?? null;
    out("AGENTIC: create reasoning agent", createRes.ok, { status: createRes.status, id: createdId, body: created });

    if (createdId) {
      const msgRes = await apiRequest("POST", `/v2/agentic/agents/${createdId}/a2a/message:send`, {
        message: {
          messageId: randomUUID(),
          role: "ROLE_USER",
          parts: [
            { text: "Billed code: CPT 99214 (25-min established-patient visit, moderate MDM). The note above describes a 15-min routine hypertension follow-up. Is 99214 defensible? Return JSON only." },
            { data: { note_id: 1, note: SAMPLE_NOTE } },
          ],
        },
      }, 90_000);
      out("AGENTIC: retrace message:send", msgRes.ok, { status: msgRes.status, body: tryParse(msgRes.text) });
    }
  } catch (e) {
    out("AGENTIC: reasoning probe", false, String(e));
  } finally {
    if (createdId) {
      try { await apiRequest("DELETE", `/v2/agentic/agents/${createdId}`); console.log("\n[cleanup] deleted probe agent"); }
      catch { console.log("\n[cleanup] failed to delete probe agent (ok to ignore)"); }
    }
  }

  console.log("\n===== PROBE COMPLETE =====");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
