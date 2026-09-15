"use client";

/**
 * Shared tour widgets — extracted from the original single-case tour so every
 * tour case reuses the same visual language. Pure React/CSS/SVG, no libs.
 */

import { useEffect, useState } from "react";
import { cn, formatPct } from "@/lib/utils";
import { AlertTriangle, Check, FileText } from "lucide-react";
import type { TourCode } from "./tour-types";

/** A code row in either the billed or truth column. */
export function CodeCard({
  code,
  column,
  index,
  matched,
}: {
  code: TourCode;
  column: "billed" | "truth";
  index: number;
  matched?: boolean;
}) {
  const isFraud = code.fraudulent;
  const isBilled = column === "billed";
  const accent = isFraud
    ? "var(--risk-high)"
    : matched
      ? "var(--risk-low)"
      : isBilled
        ? "var(--foreground)"
        : "var(--accent)";
  return (
    <div
      className={cn(
        "animate-fade-rise flex items-start gap-3 rounded-lg border px-3 py-2.5",
        isFraud
          ? "border-[var(--risk-high)]/30 bg-[var(--risk-high-soft)]/40"
          : "border-[var(--border)] bg-[var(--surface)]",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md"
        style={{ background: isFraud ? "var(--risk-high-soft)" : "var(--surface-2)", color: accent }}
      >
        {isFraud ? (
          <AlertTriangle className="h-4 w-4" />
        ) : matched ? (
          <Check className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold" style={{ color: accent }}>
            {code.code}
          </span>
          {isFraud && (
            <span className="rounded bg-[var(--risk-high)] px-1 py-0.5 text-[10px] font-semibold uppercase text-white">
              flagged
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted)] line-clamp-2">{code.description}</div>
      </div>
    </div>
  );
}

/** Horizontal severity bar that fills to a % with a colored, animated width. */
export function SeverityMeter({
  value,
  tone,
  label,
  invert,
  caption,
}: {
  value: number;
  tone: "high" | "med" | "low";
  label: string;
  /** When true, low value is BAD (rendered in risk-high). Default false. */
  invert?: boolean;
  /** Override caption under the meter. Falls back to a sensible default. */
  caption?: string;
}) {
  // Mount at width 0, then sweep to the real width so the bar feels alive.
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.round(value * 100)), 120);
    return () => clearTimeout(t);
  }, [value]);

  const pct = Math.round(value * 100);
  const colorVar = invert
    ? "var(--risk-high)"
    : tone === "high"
      ? "var(--risk-high)"
      : tone === "med"
        ? "var(--risk-med)"
        : "var(--risk-low)";
  const softVar = invert
    ? "var(--risk-high-soft)"
    : tone === "high"
      ? "var(--risk-high-soft)"
      : tone === "med"
        ? "var(--risk-med-soft)"
        : "var(--risk-low-soft)";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: colorVar }}>
          {formatPct(value)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: softVar }}>
        <div
          className="tour-meter-fill h-full rounded-full"
          style={{ width: `${w}%`, background: colorVar }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--muted)]">
        {caption ??
          (invert
            ? `Only ${pct}% of the note grounds this code — near zero.`
            : `${pct}% confidence this is intentional fraud.`)}
      </div>
    </div>
  );
}

/** Billed vs correct delta chip with arrow + color. */
export function DeltaChip({
  billed,
  correct,
  tone,
}: {
  billed: string;
  correct: string;
  tone: "high" | "med" | "low";
}) {
  const colorVar =
    tone === "high" ? "var(--risk-high)" : tone === "med" ? "var(--risk-med)" : "var(--risk-low)";
  const softVar =
    tone === "high"
      ? "var(--risk-high-soft)"
      : tone === "med"
        ? "var(--risk-med-soft)"
        : "var(--risk-low-soft)";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
      style={{ borderColor: `${colorVar}33`, background: softVar }}
    >
      <span className="font-mono text-sm font-bold" style={{ color: colorVar }}>
        {billed}
      </span>
      <span style={{ color: colorVar }}>→</span>
      <span className="font-mono text-sm font-bold text-[var(--muted)]">{correct}</span>
    </div>
  );
}

/** SVG arc gauge that fills to a value — no libs. */
export function ConfidenceGauge({ value }: { value: number }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  // Semi-circular arc, radius 34, viewBox 80x46.
  const r = 34;
  const cx = 40;
  const cy = 42;
  const circ = Math.PI * r; // half circle length
  const dash = circ * p;
  const color = "var(--risk-high)";

  return (
    <div className="mt-3 flex items-center gap-3">
      <svg width="80" height="46" viewBox="0 0 80 46" className="flex-none">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div>
        <div className="text-sm font-bold tabular-nums" style={{ color }}>
          {formatPct(p)}
        </div>
        <div className="text-[11px] text-[var(--muted)]">fraud likelihood</div>
      </div>
    </div>
  );
}
