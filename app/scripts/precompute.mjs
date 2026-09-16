// Precompute: run the real Corti pipeline over all eval cases and persist
// PipelineResult JSON. The tour + case-detail replay this; "Try it yourself"
// stays live. Run: node --env-file=.env scripts/precompute.mjs
//
// Maps docs/eval-cases.json → Case → live pipeline → app/data/precomputed/*.json.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // app/scripts → worktree root (docs/ lives here)

// --- minimal env + client bootstrapping (mirrors pipeline.ts) -------------
const region = (process.env.CORTI_REGION || "eu").toLowerCase();
const SUFFIX = { "dev-weu": "DEV_WEU", "staging-eu": "STAGING_EU", eu: "EU", us: "US" };
const suffix = SUFFIX[region];

function resolveEnv() {
  const url = process.env[`AGENT_API_URL_${suffix}`] || `https://api.${region}.corti.app`;
  const auth = process.env[`AGENT_API_AUTH_URL_${suffix}`] || `https://auth.${region}.corti.app`;
  const id = process.env[`AGENT_API_CLIENT_ID_${suffix}`];
  const secret = process.env[`AGENT_API_CLIENT_SECRET_${suffix}`];
  if (!id || !secret) return null;
  return { apiBaseUrl: url, authBaseUrl: auth, clientId: id, clientSecret: secret, tenant: process.env.CORTI_TENANT_NAME || "base", region };
}

let token = null;
async function getToken(cfg) {
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
  token = data.access_token;
  return token;
}

async function api(cfg, method, path, json, timeoutMs = 90_000) {
  const url = cfg.apiBaseUrl.replace(/\/$/, "") + path;
  const t = await getToken(cfg);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Tenant-Name": cfg.tenant, Authorization: `Bearer ${t}`, "A2A-Version": "1.0" },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 401) { token = null; return api(cfg, method, path, json, timeoutMs); }
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}

let agentCounter = 0;
async function createAgent(cfg, name, desc, systemPrompt) {
  const r = await api(cfg, "POST", "/v2/agentic/agents", { name: `${name}_${++agentCounter}`, description: desc, systemPrompt, connectors: [{ type: "registry", name: "coding-expert" }], lifecycle: "ephemeral" });
  return r.id;
}
async function sendMessage(cfg, agentId, prompt, note) {
  const { randomUUID } = await import("node:crypto");
  const r = await api(cfg, "POST", `/v2/agentic/agents/${agentId}/a2a/message:send`, {
    message: { messageId: randomUUID(), role: "ROLE_USER", parts: [{ text: prompt }, { data: { note_id: 1, note } }] },
  }, 120_000);
  const artText = (r.task?.artifacts ?? []).flatMap((a) => a.parts ?? []).find((p) => p.text)?.text ?? "";
  if (artText) return artText;
  return (r.task?.status?.message?.parts ?? []).find((p) => p.text)?.text ?? "";
}
async function deleteAgent(cfg, id) { try { await api(cfg, "DELETE", `/v2/agentic/agents/${id}`); } catch {} }

// --- pipeline steps --------------------------------------------------------
function tryParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

async function predictCodes(cfg, note) {
  const r = await api(cfg, "POST", "/v2/tools/coding", { system: ["icd10cm-outpatient", "cpt"], context: [{ type: "text", text: note }] });
  const proc = (r.codes ?? []).filter((x) => x.system === "cpt").map((x) => x.code);
  const dx = (r.codes ?? []).filter((x) => x.system === "icd10cm-outpatient").map((x) => x.code);
  return { procedures: proc, dx };
}

async function retrace(cfg, note, code, description) {
  const prompt = `Billed code: ${code} (${description}). The coding model did NOT predict this code. Assess defensibility from the clinical note. Return JSON only: {"agreeability":0-100,"grounding":"supported|weakly_supported|unsupported|contradicted","reasoning":"...","noteExcerpts":["..."]}`;
  const id = await createAgent(cfg, "FraudLens_retrace", "Assess defensibility of a billed code.", "You are a medical coding auditor. Assess whether a billed code is defensible from the clinical note. Reply ONLY with JSON.");
  try {
    const raw = await sendMessage(cfg, id, prompt, note);
    const p = tryParse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (p) return { code, description, predicted: false, match: "extra", agreeability: clamp(p.agreeability ?? 20), grounding: p.grounding ?? "unsupported", noteExcerpts: p.noteExcerpts ?? [], confidence: 0.7, rationale: p.reasoning ?? "" };
  } catch (e) { console.warn(`  retrace ${code} failed: ${e.message.slice(0, 80)}`); }
  finally { await deleteAgent(cfg, id); }
  return { code, description, predicted: false, match: "extra", agreeability: 20, grounding: "unsupported", noteExcerpts: [], confidence: 0.4, rationale: "retrace failed" };
}

async function judgement(cfg, note, billedProc, billedDx, predicted, analyses) {
  const retraces = analyses.filter((a) => a.match === "extra").map((a) => `  - ${a.code}: agreeability=${a.agreeability}, grounding=${a.grounding}`).join("\n");
  const prompt = `Billed procedures: ${billedProc}. Billed diagnoses: ${billedDx}. Predicted: ${predicted.procedures.join(",")}. Per-code retrace:\n${retraces || "(none)"}.\nClassify: fraud_type (upcoding|unbundling|phantom|dx_inflation|cloning|none), verdict (fraud|error|clean), confidence 0-1, summary, details[]. JSON only.`;
  const id = await createAgent(cfg, "FraudLens_judgement", "Classify a case.", "You are a medical coding fraud classifier. Reply ONLY with JSON.");
  try {
    const raw = await sendMessage(cfg, id, prompt, note);
    const p = tryParse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (p) return { fraudType: p.fraud_type ?? "none", verdict: p.verdict ?? "clean", confidence: clamp(p.confidence ?? 0), summary: p.summary ?? "", details: p.details ?? [] };
  } catch (e) { console.warn(`  judgement failed: ${e.message.slice(0, 80)}`); }
  finally { await deleteAgent(cfg, id); }
  return { fraudType: "none", verdict: "clean", confidence: 0, summary: "judgement failed", details: [] };
}

async function legalBrief(cfg, note, finding, c) {
  const sections = {
    outputLanguage: "en-US",
    context: [{ type: "text", text: `Case ${c.case_id}. Note: ${note}. Billed: ${c.billed_codes.map((b) => b.code).join(",")}. Fraud type: ${finding.fraudType}. Verdict: ${finding.verdict}. Summary: ${finding.summary}.` }],
    dynamicTemplate: { name: "FraudLens brief", generation: { sections: [
      { heading: "Factual Basis", instructions: { contentPrompt: `Summarize the billing discrepancy. Fraud type: ${finding.fraudType}, verdict: ${finding.verdict}.`, writingStylePrompt: "Clinical, non-conclusory." }, outputSchema: { type: "string" } },
      { heading: "FCA Exposure", instructions: { contentPrompt: "Assess False Claims Act exposure. Coding discrepancies alone do not establish scienter.", writingStylePrompt: "Cautious, hedged." }, outputSchema: { type: "string" } },
    ] } },
  };
  try {
    const r = await api(cfg, "POST", "/v2/documents", sections);
    return Object.values(r.document?.stringDocument ?? {}).join("\n\n");
  } catch (e) { console.warn(`  brief failed: ${e.message.slice(0, 80)}`); return ""; }
}

function clamp(n, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, n)); }

// --- main ------------------------------------------------------------------
async function main() {
  const cfg = resolveEnv();
  if (!cfg) { console.error("No Corti creds. Set AGENT_API_* for region", region); process.exit(1); }
  console.log(`region=${region} tenant=${cfg.tenant}`);

  const evalPath = join(ROOT, "docs", "eval-cases.json");
  const evalData = JSON.parse(readFileSync(evalPath, "utf8"));
  const outDir = join(ROOT, "app", "src", "data", "precomputed");
  mkdirSync(outDir, { recursive: true });

  for (const ec of evalData.cases) {
    console.log(`\n=== ${ec.case_id} (${ec.fraud_type}) ===`);
    const billedProc = ec.billed_codes.filter((b) => !b.code.startsWith("I") && !b.code.startsWith("E") && !b.code.startsWith("J") && !b.code.startsWith("N") && !b.code.startsWith("Z")).map((b) => b.code);
    const billedDx = ec.billed_codes.filter((b) => /^[IEJNZ]/.test(b.code)).map((b) => b.code);

    let predicted;
    try { predicted = await predictCodes(cfg, ec.note_text); console.log(`  predicted: proc=${predicted.procedures.join(",")} dx=${predicted.dx.join(",")}`); }
    catch (e) { console.warn(`  predict failed: ${e.message.slice(0, 100)}`); predicted = { procedures: [], dx: [] }; }

    const analyses = [];
    for (const b of ec.billed_codes) {
      const predP = predicted.procedures.includes(b.code);
      const predD = predicted.dx.includes(b.code);
      if (predP || predD) analyses.push({ code: b.code, description: b.description, predicted: true, match: "exact", agreeability: 100, grounding: "supported", noteExcerpts: [], confidence: 0.95 });
      else analyses.push(await retrace(cfg, ec.note_text, b.code, b.description));
    }

    const finding = await judgement(cfg, ec.note_text, billedProc.join(","), billedDx.join(","), predicted, analyses);
    console.log(`  judgement: ${finding.fraudType} (${finding.verdict}) conf=${finding.confidence.toFixed(2)}`);

    const brief = await legalBrief(cfg, ec.note_text, finding, ec);

    const detected = finding.fraudType !== "none" && finding.fraudType.replace("diagnosis_padding", "dx_inflation").includes(ec.fraud_type === "diagnosis_padding" ? "dx_inflation" : ec.fraud_type) ? true : false;
    const result = {
      case_id: ec.case_id,
      fraud_type: ec.fraud_type,
      predicted_codes: predicted,
      analyses,
      finding,
      legal_brief: brief || undefined,
      source: "live",
      detected,
      precomputed_at: new Date().toISOString(),
    };
    writeFileSync(join(outDir, `${ec.case_id}.json`), JSON.stringify(result, null, 2));
    console.log(`  → saved src/data/precomputed/${ec.case_id}.json (detected=${detected})`);
  }
  console.log("\n=== PRECOMPUTE COMPLETE ===");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
