// Sanity check: import the pure legal-brief module (Node 26 strips TS types) and
// print one sample brief to confirm it's a rich multi-section brief.
import { buildLegalBrief, findingFromResult } from "../app/src/lib/legal-brief.ts";

const out = buildLegalBrief({
  caseId: "case_padding_002",
  provider: { name: "Dr. Test", npi: "1234567890", specialty: "Internal Medicine", state: "FL" },
  encounterDate: "2026-01-15",
  clinicalNote: "CC: Annual wellness visit. 68yo male, well-controlled HTN. No renal findings.",
  billedCodes: [
    { code: "I10", description: "Essential hypertension", charge: 0 },
    { code: "N18.3", description: "CKD stage 3", charge: 0 },
  ],
  finding: {
    fraudType: "dx_inflation",
    verdict: "fraud",
    confidence: 0.94,
    summary: "Two unsupported/contradicted diagnoses billed — diagnosis inflation.",
    rationale: "N18.3 has no renal grounding.",
  },
  analyses: [
    { code: "I10", description: "Essential hypertension", match: "exact", agreeability: 100, grounding: "supported", noteExcerpts: [], confidence: 0.95 },
    { code: "N18.3", description: "CKD stage 3", match: "extra", agreeability: 0, grounding: "unsupported", noteExcerpts: ["No renal labs.", "Denies urinary symptoms."], confidence: 0.7, rationale: "No CKD history or labs in the note." },
  ],
  totalImpact: 10125,
  detected: true,
  liveNarrative: "Live narrative paragraph from Guided Docs.",
});

console.log("=== LENGTH ===", out.length);
console.log("=== SECTION COUNT (## ) ===", (out.match(/^## /gm) || []).length);
console.log("=== FIRST 600 CHARS ===");
console.log(out.slice(0, 600));
console.log("...");
console.log("=== LAST 200 CHARS ===");
console.log(out.slice(-200));

// Confirm it's rich, not 291 chars
if (out.length < 1500) {
  console.error("FAIL: brief too short — expected a rich multi-section brief");
  process.exit(1);
}
console.log("\nPASS: rich multi-section brief generated.");
