/**
 * Coding-expert route — runs the real Corti coding-expert on a clinical note.
 *
 * POST /api/coding-expert  { note: string }
 * → { source: "live"|"replay", region?, predictedCodes, rawResponse?, error? }
 *
 * The Corti credentials stay server-side (process.env, gitignored .env). The
 * client playground never sees the keys — it just sends a note and gets codes.
 */
import { runCodingExpertOnNote, liveArmed } from "@/lib/pipeline";

export async function POST(request: Request) {
  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const note = (body.note ?? "").trim();
  if (!note) return Response.json({ error: "Missing 'note' field." }, { status: 400 });
  if (note.length > 8000) return Response.json({ error: "Note too long (max 8000 chars)." }, { status: 413 });

  const result = await runCodingExpertOnNote(note);
  return Response.json(result);
}

/** GET reports whether the live path is armed — so the UI can badge "live" vs "replay". */
export async function GET() {
  return Response.json({ live: liveArmed() });
}
