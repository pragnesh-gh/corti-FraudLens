// One-off diagnostic: verify the two real Corti textgen surfaces for FraudLens.
//   1. Guided Documents  POST /v2/documents (Path 4 dynamicTemplate) — clinical textgen
//   2. Corti Models      POST ai.eu.corti.app/v1/chat/completions     — general LLM (corti-s1)
// Reuses the proven OAuth2 flow for surface 1; builds the base64 composite bearer for surface 2.
//
// Run: node --env-file=.env scripts/probe-textgen.mjs
// No secrets are printed. Safe to re-run.

import { randomUUID } from "node:crypto";

const region = (process.env.CORTI_REGION || "eu").toLowerCase();
const REGION_SUFFIX = { "dev-weu": "DEV_WEU", "staging-eu": "STAGING_EU", eu: "EU", us: "US", local: "LOCAL" };
const suffix = REGION_SUFFIX[region];

function resolveCortiEnv() {
  if (region === "local") return null;
  const url = process.env[`AGENT_API_URL_${suffix}`] || `https://api.${region}.corti.app`;
  const auth = process.env[`AGENT_API_AUTH_URL_${suffix}`] || `https://auth.${region}.corti.app`;
  const id = process.env[`AGENT_API_CLIENT_ID_${suffix}`];
  const secret = process.env[`AGENT_API_CLIENT_SECRET_${suffix}`];
  if (!id || !secret) return null;
  return { apiBaseUrl: url, authBaseUrl: auth, clientId: id, clientSecret: secret, tenant: process.env.CORTI_TENANT_NAME || process.env.CORTI_TENANT || "base", region };
}

const cfg = resolveCortiEnv();
const out = (label, ok, data) => console.log(`\n===== ${label} =====\nstatus: ${ok ? "OK" : "FAIL"}\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`);

let token = null;
async function getToken() {
  if (token) return token;
  const url = `${cfg.authBaseUrl}/realms/${cfg.tenant}/protocol/openid-connect/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "openid", client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OAuth2 failed ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token");
  token = data.access_token;
  return token;
}

async function apiPost(path, json, timeoutMs = 90_000) {
  const url = cfg.apiBaseUrl.replace(/\/$/, "") + path;
  const t = await getToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Tenant-Name": cfg.tenant, Authorization: `Bearer ${t}` },
    body: JSON.stringify(json),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function tryParse(text) { try { return JSON.parse(text); } catch { return text?.slice(0, 800); } }
function redact(obj) {
  // Strip any field that looks like a token/secret before printing.
  const s = JSON.stringify(obj);
  return s.replace(/"(?:access_token|api_key|apiKey|bearer|token|client_secret|secret)"\s*:\s*"[^"]*"/gi, '"$1":"<redacted>"');
}

const SAMPLE_NOTE =
  "Patient seen for routine follow-up of hypertension. BP 128/82, no edema, no chest pain. " +
  "Assessment: essential hypertension, well controlled. Plan: continue lisinopril, recheck in 6 months. " +
  "No acute complaints. Counseling provided on low-sodium diet for 15 minutes.";

async function main() {
  if (!cfg) { out("CONFIG", false, `No Agent API creds for region=${region}`); process.exit(0); }
  out("CONFIG", true, { region, apiBaseUrl: cfg.apiBaseUrl, tenant: cfg.tenant });

  // ----- 1. Guided Documents: POST /v2/documents (Path 4 dynamicTemplate) ----
  try {
    const body = {
      outputLanguage: "en-US",
      context: [{ type: "text", text: SAMPLE_NOTE }],
      dynamicTemplate: {
        name: "FraudLens chart summary probe",
        generation: {
          sections: [
            {
              heading: "Chart Summary",
              instructions: {
                contentPrompt: "Summarize the encounter in 2-3 sentences, noting the assessment and plan.",
                writingStylePrompt: "Concise, clinical.",
              },
              outputSchema: { type: "string" },
            },
          ],
        },
      },
    };
    const r = await apiPost("/v2/documents", body);
    out("GUIDED DOCUMENTS (POST /v2/documents, dynamicTemplate)", r.ok, { status: r.status, body: tryParse(r.text) });
  } catch (e) { out("GUIDED DOCUMENTS", false, String(e)); }

  // ----- 2. Corti Models: ai.eu.corti.app/v1 (OpenAI-compatible) -------------
  // Auth: base64 composite bearer from the CORTI_* Console block.
  const cortiTenant = process.env.CORTI_TENANT || process.env.CORTI_TENANT_NAME;
  const cortiClientId = process.env.CORTI_CLIENT_ID;
  const cortiClientSecret = process.env.CORTI_CLIENT_SECRET;
  const cortiBase = (process.env.CORTI_BASE_URL || "https://ai.eu.corti.app/v1").replace(/\/v1$/, "").replace(/\/$/, "");

  if (!cortiTenant || !cortiClientId || !cortiClientSecret) {
    out("CORTI MODELS — CONFIG", false, `Missing CORTI_* Console creds: ${[!cortiTenant && "CORTI_TENANT", !cortiClientId && "CORTI_CLIENT_ID", !cortiClientSecret && "CORTI_CLIENT_SECRET"].filter(Boolean).join(", ")}`);
  } else {
    // Build the composite bearer (do NOT print it).
    const raw = `${cortiTenant}:client_credentials:${cortiClientId}:${cortiClientSecret}`;
    const compositeBearer = Buffer.from(raw).toString("base64");
    const modelsUrl = `${cortiBase}/v1/models`;
    const chatUrl = `${cortiBase}/v1/chat/completions`;

    // Also try the pre-existing CORTI_BEARER if present (to see if it's already valid or stale).
    const existingBearer = process.env.CORTI_BEARER;

    const headers = (bearer) => ({ "Content-Type": "application/json", Authorization: `Bearer ${bearer}` });

    // 2a. GET /v1/models with the fresh composite bearer
    try {
      const res = await fetch(modelsUrl, { method: "GET", headers: headers(compositeBearer), signal: AbortSignal.timeout(30_000) });
      const text = await res.text();
      out("CORTI MODELS — GET /v1/models (composite bearer)", res.ok, { status: res.status, url: modelsUrl, body: tryParse(text) });
    } catch (e) { out("CORTI MODELS — GET /v1/models", false, String(e)); }

    // 2b. POST /v1/chat/completions — a tiny generation call with corti-s1-instant
    try {
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: headers(compositeBearer),
        body: JSON.stringify({
          model: "corti-s1-instant",
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          max_tokens: 5,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      out("CORTI MODELS — POST /v1/chat/completions (composite bearer, corti-s1-instant)", res.ok, { status: res.status, url: chatUrl, body: tryParse(text) });
    } catch (e) { out("CORTI MODELS — chat/completions", false, String(e)); }

    // 2c. If CORTI_BEARER exists and differs from the composite, test it too (diagnose staleness)
    if (existingBearer && existingBearer !== compositeBearer) {
      try {
        const res = await fetch(modelsUrl, { method: "GET", headers: headers(existingBearer), signal: AbortSignal.timeout(30_000) });
        const text = await res.text();
        out("CORTI MODELS — GET /v1/models (existing CORTI_BEARER)", res.ok, { status: res.status, note: "existing CORTI_BEARER differs from composite — testing whether it's a valid alternate token or stale", body: tryParse(text) });
      } catch (e) { out("CORTI MODELS — existing CORTI_BEARER", false, String(e)); }
    } else if (existingBearer) {
      out("CORTI MODELS — CORTI_BEARER", true, "CORTI_BEARER is identical to the computed composite bearer (good — it's the right format).");
    }
  }

  console.log("\n===== TEXTGEN PROBE COMPLETE =====");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
