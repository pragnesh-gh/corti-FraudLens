/**
 * Full-pipeline live run route — runs the REAL Corti pipeline (predict →
 * compare → retrace → judgement → legal brief) on a note + billed codes.
 *
 * POST /api/run-pipeline
 *   { caseId?: string, note?: string, billedCodes?: {code,description}[] }
 * → CaseResult JSON (codes, code_analyses, finding, legal_brief, source, detected)
 *
 * If `caseId` is given, loads that tour/eval case's note + billed codes. If
 * `note` + `billedCodes` are given, runs on those (custom). Credentials stay
 * server-side (process.env, gitignored .env). GET reports whether live is armed.
 */
import { runLivePipeline, resolveCortiEnv, liveArmed, type PipelineConfig, type CortiClient } from "@/lib/pipeline";
import type { Case, ProcedureCode, DiagnosisCode } from "@/lib/types";
import { getTourCase } from "@/lib/tour-cases";

function defaultConfig(): PipelineConfig {
  return {
    live: process.env.FRAUDLENS_LIVE === "1",
    timeoutMs: Number(process.env.FRAUDLENS_LIVE_TIMEOUT_MS ?? 120000),
    liveCaseId: process.env.FRAUDLENS_LIVE_CASE || "C-2026-0042",
  };
}

/** Synthesize a minimal Case from a note + billed codes for the live pipeline.
 *  No planted_fraud (custom input has no ground truth) — the detector runs blind. */
function synthesizeCase(note: string, billedCodes: { code: string; description: string }[]): Case {
  const procedures: ProcedureCode[] = billedCodes.map((b, i) => ({
    code: b.code,
    description: b.description,
    units: 1,
    modifiers: [],
    charge: 0,
    supporting_dx_index: [],
  }));
  // Heuristic: codes that look like ICD-10 (start with a letter + digits) are dx,
  // CPT/HCPCS (numeric or G/numeric) are procedures. Split so the comparison works.
  const dxCodes: DiagnosisCode[] = billedCodes
    .filter((b) => /^[A-TV-Z]\d/i.test(b.code) && b.code.includes("."))
    .map((b) => ({ code: b.code, description: b.description }));
  const procCodes: ProcedureCode[] = billedCodes
    .filter((b) => !(/^[A-TV-Z]\d/i.test(b.code) && b.code.includes(".")))
    .map((b) => ({ code: b.code, description: b.description, units: 1, modifiers: [], charge: 0, supporting_dx_index: [] }));
  return {
    case_id: `live-${Date.now()}`,
    provider_id: "P-LIVE",
    patient: { mrn: "live", age_band: "40-64", sex: "X" },
    encounter: { date: new Date().toISOString().slice(0, 10), pos: 11, type: "office" },
    submitted_codes: { dx: dxCodes.length ? dxCodes : [], procedures: procCodes.length ? procCodes : procedures },
    clinical_note: note,
    evidence_spans: [],
    billed_total: 0,
    paid_total: 0,
    planted_fraud: null,
  };
}

/** Build a Case from a tour case (noteText + billedCodes). */
function caseFromTour(caseId: string): Case | null {
  const tc = getTourCase(caseId);
  if (!tc) return null;
  const billed = tc.billedCodes.map((b) => ({ code: b.code, description: b.description }));
  const c = synthesizeCase(tc.noteText, billed);
  c.case_id = caseId;
  // Carry the tour case's planted fraud type as ground truth for the honesty signal.
  const plantedType = tc.fraudType;
  c.planted_fraud = { type: plantedType, severity: "fraud", detail: tc.teaser };
  return c;
}

export async function POST(request: Request) {
  let body: { caseId?: string; note?: string; billedCodes?: { code: string; description: string }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const cfg = defaultConfig();
  if (!cfg.live) {
    return Response.json({ error: "Live pipeline not armed (FRAUDLENS_LIVE=0). Set FRAUDLENS_LIVE=1 to run live." }, { status: 503 });
  }
  const env = resolveCortiEnv();
  if (!env) {
    return Response.json({ error: "No Corti credentials for the active region." }, { status: 503 });
  }

  // Resolve the case to run.
  let c: Case | null = null;
  if (body.caseId) {
    c = caseFromTour(body.caseId);
    if (!c) return Response.json({ error: `Unknown caseId: ${body.caseId}` }, { status: 404 });
  } else if (body.note && body.billedCodes) {
    const note = body.note.trim();
    if (!note) return Response.json({ error: "Empty note." }, { status: 400 });
    if (note.length > 8000) return Response.json({ error: "Note too long (max 8000 chars)." }, { status: 413 });
    c = synthesizeCase(note, body.billedCodes);
  } else {
    return Response.json({ error: "Provide either {caseId} or {note, billedCodes}." }, { status: 400 });
  }

  try {
    // Build a fresh client per request (no shared agent state across runs).
    const { CortiClient } = await import("@/lib/pipeline");
    const client: CortiClient = new CortiClient(env);
    const result = await runLivePipeline(client, c, cfg);
    return Response.json(result);
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 300) ?? "Unknown error";
    return Response.json({ error: `Live pipeline failed: ${msg}` }, { status: 502 });
  }
}

/** GET reports whether the live path is armed — so the UI can badge "live". */
export async function GET() {
  return Response.json({ live: liveArmed() });
}
