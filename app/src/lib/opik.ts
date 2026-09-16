/**
 * Opik dev-tracing for the FraudLens agentic pipeline.
 *
 * Wraps each pipeline step (fact extraction, code prediction, set comparison,
 * retrace agent, chart verification, judgement, legal brief) as a span so we
 * can watch what the agents actually do in the Opik UI.
 *
 * Gated behind FRAUDLENS_TRACING=1 (default off) so the demo critical path is
 * unaffected. When off, `startCaseTrace` returns a no-op handle — the `traced()`
 * wrapper adds only a function-call's overhead, and enabling tracing can never
 * break the demo even if Opik is unreachable (construction is wrapped in
 * try/catch and falls back to no-op on failure).
 *
 * Env (see app/.env / .env.example):
 *   FRAUDLENS_TRACING=1         — opt in
 *   OPIK_URL_DEV_WEU            — Corti-internal Opik host (already in .env)
 *   OPIK_PROJECT_ID_DEV_WEU     — project id (already in .env)
 *   OPIK_API_KEY                — optional (the dev tunnel usually needs none)
 *   OPIK_PROJECT_NAME           — default "FraudLens"
 *   OPIK_WORKSPACE               — default "default"
 *   OPIK_URL_OVERRIDE           — optional: point at a different Opik
 */

import { Opik, type SpanType, type Trace, type Span } from "opik";

let _client: Opik | null = null;
let _clientFailed = false;

/** Tracing is on only when explicitly opted in AND an Opik URL is configured. */
export function isTracingEnabled(): boolean {
  return process.env.FRAUDLENS_TRACING === "1" && !!process.env.OPIK_URL_DEV_WEU;
}

/** Lazily construct the Opik client. Returns null if tracing is off or the
 *  client can't be built (so callers always get a usable handle). */
function client(): Opik | null {
  if (!isTracingEnabled() || _clientFailed) return null;
  if (_client) return _client;
  try {
    _client = new Opik({
      apiUrl: process.env.OPIK_URL_OVERRIDE ?? process.env.OPIK_URL_DEV_WEU,
      apiKey: process.env.OPIK_API_KEY, // may be empty for the in-network tunnel
      projectName: process.env.OPIK_PROJECT_NAME ?? "FraudLens",
      workspaceName: process.env.OPIK_WORKSPACE ?? "default",
    });
    return _client;
  } catch (e) {
    // Never let tracing construction break the pipeline.
    _clientFailed = true;
    console.warn("[opik] tracing disabled — client construction failed:", (e as Error).message);
    return null;
  }
}

/** A handle on a case trace. `span()` opens a child span; `end()` closes the
 *  trace and flushes. The no-op variant (when tracing is off) has the same
 *  shape, so call sites need no branching. */
export interface CaseTrace {
  span: (name: string, type: SpanType, input: unknown) => SpanHandle;
  end: (output?: unknown) => Promise<void>;
}

export interface SpanHandle {
  end: (output?: unknown, error?: string) => void;
}

/** Coerce an arbitrary value into the SDK's JsonListString (object | array | string). */
function toSpanValue(v: unknown): Record<string, unknown> | Record<string, unknown>[] | string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return String(v);
}

/** Open a trace for a case, named by case id so the Opik UI groups a full run. */
export function startCaseTrace(caseId: string, note: string): CaseTrace {
  const c = client();
  if (!c) return noOpTrace();
  try {
    const trace = c.trace({
      name: `case-${caseId}`,
      input: toSpanValue({ case_id: caseId, note_preview: note.slice(0, 500) }),
    });
    return {
      span: (name: string, type: SpanType, input: unknown) => {
        const s = trace.span({ name, type, input: toSpanValue(input) });
        return {
          end: (output?: unknown, error?: string) => {
            s.end();
            const out = toSpanValue(error ? { error } : output);
            if (out !== undefined) {
              s.update({ output: out });
            }
          },
        };
      },
      end: async (output?: unknown) => {
        const out = toSpanValue(output);
        if (out !== undefined) trace.update({ output: out });
        trace.end();
        await c.flush();
      },
    };
  } catch (e) {
    console.warn("[opik] startCaseTrace failed, falling back to no-op:", (e as Error).message);
    return noOpTrace();
  }
}

/** Time + record any async step as a span. The span is closed when `fn`
 *  resolves (or rejects); on error the message is captured as the span output. */
export async function traced<T>(
  t: CaseTrace,
  name: string,
  type: SpanType,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const s = t.span(name, type, input);
  try {
    const out = await fn();
    s.end(out);
    return out;
  } catch (e) {
    s.end(undefined, (e as Error).message?.slice(0, 300));
    throw e;
  }
}

function noOpTrace(): CaseTrace {
  const span = () => ({ end: () => {} });
  return { span, end: async () => {} };
}

/** Flush any buffered traces on graceful shutdown (best-effort). */
export async function flushTracing(): Promise<void> {
  if (_client) {
    try {
      await _client.flush();
    } catch {
      // ignore — best-effort
    }
  }
}
