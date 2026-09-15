#!/usr/bin/env node
/**
 * FraudLens text-only smoke test.
 * Verifies every route renders (HTTP 200) and contains expected text.
 * No screenshots, no browser, no multimodal — pure HTTP + text assertions.
 *
 * Usage:  node scripts/smoke.mjs [baseURL]
 * Default base URL: http://localhost:3000
 */
import { spawn } from "node:child_process";

const BASE = process.argv[2] || "http://localhost:3000";

let failures = 0;
let checks = 0;

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const status = res.status;
  const html = await res.text();
  // strip scripts/styles/tags
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { status, text, len: text.length };
}

function assert(name, cond, detail = "") {
  checks++;
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

const ROUTES = [
  {
    path: "/",
    name: "Case Queue (landing)",
    expect: ["FraudLens", "Case Queue", "Dr. Elias Mercer", "Total flagged"],
    notExpect: [],
  },
  {
    path: "/providers",
    name: "Providers list",
    expect: ["Provider Pattern Dashboard", "Dr. Elias Mercer"],
    notExpect: [],
  },
  {
    path: "/providers/P-001",
    name: "Villain provider dashboard",
    expect: ["Dr. Elias Mercer", "Top CPT codes", "E/M level", "trend"],
    notExpect: [],
  },
  {
    path: "/tour",
    name: "Guided Tour hub",
    expect: ["tour"], // hub lists available tours
    notExpect: [],
  },
  {
    path: "/tour/case_padding_002",
    name: "Guided Tour (diagnosis padding)",
    expect: ["billed", "Diagnosis"], // billed appears after step 3; Diagnosis label is in SSR
    notExpect: [],
  },
  {
    path: "/demo",
    name: "Guided Demo (presenter)",
    expect: ["demo"], // presenter overlay
    notExpect: [],
  },
];

async function discoverHeroCaseId() {
  // The landing page lists case ids; grab the first villain case id.
  const { text } = await fetchText("/");
  const m = text.match(/C-2026-\d{4}/);
  return m ? m[0] : "C-2026-0042";
}

async function main() {
  console.log(`\nFraudLens smoke test — ${BASE}\n`);

  // 0. server reachable?
  try {
    const r = await fetch(`${BASE}/`, { redirect: "manual" });
    assert("server reachable", r.status === 200, `got ${r.status}`);
  } catch (e) {
    console.log(`\n✗ Server not reachable at ${BASE}: ${e.message}`);
    console.log("  Start it with: cd app && npm run dev");
    process.exit(1);
  }

  // 1. fixed routes
  for (const route of ROUTES) {
    const { status, text } = await fetchText(route.path);
    assert(`${route.name} [${route.path}] → ${status}`, status === 200, `status ${status}`);
    if (status === 200) {
      for (const ex of route.expect) {
        assert(`  contains "${ex}"`, text.toLowerCase().includes(ex.toLowerCase()), `(in ${route.path})`);
      }
    }
  }

  // 2. hero case detail (dynamic route)
  const heroId = await discoverHeroCaseId();
  {
    const { status, text } = await fetchText(`/case/${heroId}`);
    assert(`Hero Case Detail [${heroId}] → ${status}`, status === 200, `status ${status}`);
    if (status === 200) {
      assert("  has Agent pipeline", /agent pipeline/i.test(text));
      assert("  has Clinical note", /clinical note/i.test(text));
      assert("  has a fraud finding (Upcoding or Unbundling)", /upcoding|unbundling/i.test(text));
      assert("  has $ impact", /\$\d|economic impact|projected/i.test(text));
      assert("  submitted code 99215 present", text.includes("99215"));
      assert("  predicted code 99212 present", text.includes("99212"));
    }
  }

  // 3. a clean-control case should show no findings
  {
    const { text: landing } = await fetchText("/");
    // find a row that is "Clean" — scan for a case id after a Clean intent
    const ids = [...landing.matchAll(/C-2026-\d{4}/g)].map((m) => m[0]);
    let cleanId = null;
    for (const id of ids) {
      const { status, text } = await fetchText(`/case/${id}`);
      if (status === 200 && /no anomalies|codes align/i.test(text)) {
        cleanId = id;
        break;
      }
    }
    if (cleanId) {
      assert(`Clean control case ${cleanId} shows no anomalies`, true);
    } else {
      console.log("  (skipped: no clean control case found among first N ids)");
    }
  }

  // 4. eval-cases.json validity (file check)
  console.log("\n--- file checks ---");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const root = pathMod.resolve(import.meta.dirname, "..", ".."); // app/scripts -> repo root
  for (const f of ["docs/eval-cases.json", "docs/eval-cases.md", "app/.env.example", "app/src/lib/pipeline.ts"]) {
    const p = pathMod.resolve(root, f);
    assert(`file exists: ${f}`, fs.existsSync(p));
  }
  // eval-cases.json is valid JSON with cases array
  try {
    const raw = fs.readFileSync(pathMod.resolve(root, "docs/eval-cases.json"), "utf8");
    const j = JSON.parse(raw);
    assert("eval-cases.json parses", Array.isArray(j.cases));
    assert("eval-cases.json has >= 5 cases", j.cases.length >= 5, `got ${j.cases?.length}`);
  } catch (e) {
    assert("eval-cases.json parses", false, e.message);
  }

  // summary
  console.log(`\n${"=".repeat(48)}`);
  console.log(`Smoke test: ${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log(`${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log("ALL PASSED ✅");
  process.exit(0);
}

main();
