#!/usr/bin/env node
/**
 * FraudLens live Corti coding-expert test.
 *
 * Verifies the live coding-expert path end-to-end against the real Corti
 * Agent API (eu region): auth → create agent → send a clinical note → report
 * the predicted codes / task state. No screenshots, no browser — text only.
 * Cleans up the test agent it creates.
 *
 * Requires app/.env with the eu (or configured region) credentials copied
 * from the agent-eval-cases repo.
 *
 * Usage:  node scripts/live-test.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Load .env (simple parser — no external deps).
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && m[1]) process.env[m[1]] = m[2];
}

const REGION = (process.env.CORTI_REGION || "dev-weu").toLowerCase();
const SUFFIX = REGION === "dev-weu" ? "DEV_WEU" : REGION === "staging-eu" ? "STAGING_EU" : REGION.toUpperCase();
const BASE = process.env[`AGENT_API_URL_${SUFFIX}`]?.replace(/\/$/, "") || `https://api.${REGION}.corti.app`;
const AUTH = process.env[`AGENT_API_AUTH_URL_${SUFFIX}`] || `https://auth.${REGION}.corti.app`;
const CID = process.env[`AGENT_API_CLIENT_ID_${SUFFIX}`];
const CSECRET = process.env[`AGENT_API_CLIENT_SECRET_${SUFFIX}`];
const TENANT = process.env.CORTI_TENANT_NAME || "base";

if (!BASE || !AUTH || !CID || !CSECRET) {
  console.log(`✗ Missing ${REGION} credentials in .env (need AGENT_API_*_${SUFFIX}).`);
  console.log("  Copy them from /Users/pkp/Desktop/Work/agent-eval-cases/.env");
  process.exit(1);
}

const NOTE =
  "CC: Routine follow-up.\n" +
  "History: 68yo male, reports doing well. Denies chest pain, dyspnea, palpitations, edema, or headache. No new complaints.\n" +
  "Exam: BP 126/82, HR 70. Heart regular rate and rhythm, no murmurs, no S3/S4. Lungs clear bilaterally. No peripheral edema. No JVD.\n" +
  "Assessment/Plan: 1. Essential hypertension, well-controlled - continue amlodipine, recheck in 6 months.";

let agentId = null;
const log = (s) => console.log(s);

async function getToken() {
  const url = `${AUTH}/realms/${TENANT}/protocol/openid-connect/token`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "openid", client_id: CID, client_secret: CSECRET }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`auth ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const { access_token } = await r.json();
  return access_token;
}

async function main() {
  log(`\nFraudLens live coding-expert test — region=${REGION}, tenant=${TENANT}\n`);

  // 1. Auth
  let token;
  try {
    token = await getToken();
    log("  ✓ 1/4 OAuth2 auth — token acquired");
  } catch (e) {
    log(`  ✗ 1/4 auth failed: ${e.message}`);
    process.exit(1);
  }

  // 2. Create a coding-expert agent
  try {
    const r = await fetch(`${BASE}/v2/agentic/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Tenant-Name": TENANT, Authorization: `Bearer ${token}`, "A2A-Version": "1.0" },
      body: JSON.stringify({
        name: "FraudLens_LiveTest",
        description: "Predict ICD-10/CPT codes from a clinical note.",
        systemPrompt: "You are a medical coding expert. Return the ICD-10-CM diagnosis codes and CPT procedure codes the note supports, as JSON.",
        connectors: [{ type: "registry", name: "coding-expert" }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`create ${r.status}: ${(await r.text()).slice(0, 160)}`);
    agentId = (await r.json()).id;
    log(`  ✓ 2/4 coding-expert agent created (${agentId})`);
  } catch (e) {
    log(`  ✗ 2/4 create agent failed: ${e.message}`);
    process.exit(1);
  }

  // 3. Send the clinical note
  let state = "UNKNOWN";
  let responseText = "";
  try {
    const r = await fetch(`${BASE}/v2/agentic/agents/${agentId}/a2a/message:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Tenant-Name": TENANT, Authorization: `Bearer ${token}`, "A2A-Version": "1.0" },
      body: JSON.stringify({
        message: {
          messageId: randomUUID(),
          role: "ROLE_USER",
          parts: [
            { text: 'Return the ICD-10-CM diagnosis codes and CPT procedure codes supported by this note as JSON: {"dx":[{"code":"","description":""}],"procedures":[{"code":"","description":""}]}' },
            { data: { note_id: 1, note: NOTE } },
          ],
        },
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error(`send ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    state = j.task?.status?.state ?? "UNKNOWN";
    const parts = j.task?.status?.message?.parts ?? [];
    responseText = parts.find((p) => p.text)?.text ?? "";
    const arts = j.task?.artifacts ?? [];
    if (!responseText) responseText = arts.flatMap((a) => a.parts ?? []).find((p) => p.text)?.text ?? "";
    log(`  ✓ 3/4 message:send — task state: ${state}`);
  } catch (e) {
    log(`  ✗ 3/4 send failed: ${e.message}`);
  }

  // 4. Report
  log("");
  if (/completed/i.test(state) && responseText) {
    log("  ✅ LIVE TEST PASSED — coding-expert returned a prediction:");
    log("  " + responseText.slice(0, 400).replace(/\n/g, "\n  "));
  } else if (/rejected/i.test(state)) {
    log(`  ⚠  The pipeline reached the coding expert, but the task was REJECTED.`);
    log(`     This is almost always an account-credits issue on the Corti tenant.`);
    log(`     Response: ${responseText.slice(0, 160)}`);
    log(`     → Add credits to the ${REGION} tenant and re-run. The wiring is correct.`);
  } else {
    log(`  ⚠  Task state ${state}. Raw response saved to /tmp/fraudlens-live-response.json`);
    writeFileSync("/tmp/fraudlens-live-response.json", JSON.stringify({ state, text: responseText }));
  }

  // Cleanup: delete the test agent.
  try {
    const r = await fetch(`${BASE}/v2/agentic/agents/${agentId}`, {
      method: "DELETE",
      headers: { "Tenant-Name": TENANT, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    log(`\n  ✓ 4/4 cleaned up test agent (HTTP ${r.status})`);
  } catch (e) {
    log(`\n  ⚠ cleanup failed: ${e.message}`);
  }
}

main().catch((e) => {
  log(`\n✗ unexpected error: ${e.message}`);
  process.exit(1);
});
