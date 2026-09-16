import { cn } from "@/lib/utils";
import { FRAUD_META } from "@/lib/fraud-meta";
import type { FraudType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { Check, AlertTriangle, Loader2 } from "lucide-react";

/* ============================================================================
   FraudLens UI primitives — flat Obsidian-Sunset glass.
   Depth comes from opaque surface tiers + a 1px inset top-edge specularity
   highlight, not colored glow. Badges and chips stay flat (no colored drop
   shadows); colored glow is rationed to ≤1 hero accent per view. Risk badges
   and chips use the reconciled Obsidian-Sunset palette. ScoreGauge /
   PipelineStepper / CodeComparisonTable are portable components the method-demo
   consumes.
   ========================================================================= */

/** Severity / risk pill. */
export function RiskBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const level = score >= 70 ? "high" : score >= 40 ? "med" : "low";
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  const styles: Record<string, string> = {
    high: "bg-[var(--risk-high-soft)] text-[var(--risk-high)] border-[var(--risk-high)]/40",
    med: "bg-[var(--risk-med-soft)] text-[var(--risk-med)] border-[var(--risk-med)]/40",
    low: "bg-[var(--risk-low-soft)] text-[var(--risk-low)] border-[var(--risk-low)]/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        styles[level],
        className,
      )}
    >
      {level === "high" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk-high)] neon-dot" />
      )}
      {label} · {score}
    </span>
  );
}

/** Fraud-type chip with icon + accent color. */
export function FraudChip({
  type,
  className,
}: {
  type: FraudType;
  className?: string;
}) {
  const m = FRAUD_META[type];
  const Icon: LucideIcon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        className,
      )}
      style={{
        color: m.color,
        backgroundColor: m.soft,
        borderColor: `${m.color}55`,
      }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

/** Intent badge: solid fuchsia for fraud, hollow amber for error, muted for clean. */
export function IntentBadge({
  intent,
  className,
}: {
  intent: "fraud" | "error" | "clean";
  className?: string;
}) {
  if (intent === "clean") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]",
          className,
        )}
      >
        Clean
      </span>
    );
  }
  if (intent === "fraud") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-white",
          className,
        )}
        style={{
          background: "var(--risk-high)",
          borderColor: "var(--risk-high)",
        }}
      >
        Likely Fraud
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold bg-transparent text-[var(--risk-med)]",
        className,
      )}
      style={{ borderColor: "var(--risk-med)" }}
    >
      Possible Error
    </span>
  );
}

/** Glass card surface. */
export function Card({
  children,
  className,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Add a neon glow border for critical-insight cards. */
  glow?: boolean;
}) {
  return (
    <div
      className={cn("glass rounded-xl transition-colors", className)}
      style={glow ? { borderColor: "rgba(255, 122, 80, 0.35)" } : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5",
        className,
      )}
    >
      <div>
        <h3 className="font-display text-sm font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h3>
        {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---- New portable primitives for the method-demo ---- */

/** Circular SVG score gauge, color-thresholded (green ≥80, amber ≥50, red <50).
 *  Pure SVG, animated fill via stroke-dashoffset. */
export function ScoreGauge({
  value,
  max = 100,
  label,
  size = 140,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  const color = pct >= 0.8 ? "var(--risk-low)" : pct >= 0.5 ? "var(--risk-med)" : "var(--risk-high)";
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-extrabold text-[var(--foreground)]">
          {Math.round(value)}
        </span>
        {label && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** Vertical pipeline stepper with running / completed / error / pending states.
 *  Each step animates its icon (spinning amber ring → green check → red alert). */
export type StepState = "pending" | "running" | "completed" | "error";

export interface StepperStep {
  id: string;
  label: string;
  status: StepState;
  detail?: string;
}

export function PipelineStepper({
  steps,
  className,
}: {
  steps: StepperStep[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className="flex items-start gap-4 py-3">
            {/* connector line */}
            {!isLast && (
              <span
                className="absolute left-[19px] mt-10 w-0.5 bg-[var(--border)]"
                style={{ height: "calc(100% - 40px)" }}
              />
            )}
            {/* icon */}
            <span
              className={cn(
                "relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                step.status === "pending" && "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
                step.status === "running" && "border-[var(--risk-med)] text-[var(--risk-med)]",
                step.status === "completed" && "border-[var(--risk-low)] bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
                step.status === "error" && "border-[var(--risk-high)] text-[var(--risk-high)]",
              )}
            >
              {step.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-[spin_1s_linear_infinite]" />
              ) : step.status === "completed" ? (
                <Check className="h-5 w-5" strokeWidth={3} />
              ) : step.status === "error" ? (
                <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <span className="text-xs font-bold">{i + 1}</span>
              )}
            </span>
            {/* content */}
            <div className="flex-1 pt-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.status === "pending" ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                )}
              >
                {step.label}
              </p>
              {step.detail && (
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    step.status === "running"
                      ? "text-[var(--risk-med)]"
                      : step.status === "completed"
                        ? "text-[var(--risk-low)]"
                        : step.status === "error"
                          ? "text-[var(--risk-high)]"
                          : "text-[var(--muted)]",
                  )}
                >
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A row in the code-comparison table. */
export interface CodeComparisonRow {
  code: string;
  description: string;
  /** "matched" (common), "over-billed" (company billed, we didn't predict),
   *  "under-billed" (we predicted, company didn't bill). */
  match: "matched" | "over-billed" | "under-billed";
  charge?: number;
  agreeability?: number; // 0-100, for over-billed codes
  evidence?: "supported" | "weakly_supported" | "unsupported" | "contradicted";
}

const MATCH_STYLE: Record<
  CodeComparisonRow["match"],
  { chip: string; pill: string; label: string }
> = {
  matched: {
    chip: "bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
    pill: "bg-[var(--risk-low-soft)] text-[var(--risk-low)]",
    label: "Matched",
  },
  "over-billed": {
    chip: "bg-[var(--risk-high-soft)] text-[var(--risk-high)]",
    pill: "bg-[var(--risk-high-soft)] text-[var(--risk-high)]",
    label: "Over-billed",
  },
  "under-billed": {
    chip: "bg-[var(--fraud-cloning-soft)] text-[var(--fraud-cloning)]",
    pill: "bg-[var(--fraud-cloning-soft)] text-[var(--fraud-cloning)]",
    label: "Under-billed",
  },
};

const EVIDENCE_LABEL: Record<NonNullable<CodeComparisonRow["evidence"]>, string> = {
  supported: "Supported",
  weakly_supported: "Weak",
  unsupported: "Unsupported",
  contradicted: "Contradicted",
};

/** Code-comparison table: billed vs predicted, with monospace code chips and
 *  color-coded status pills. Row hover = fuchsia wash + left accent bar. */
export function CodeComparisonTable({
  rows,
  className,
}: {
  rows: CodeComparisonRow[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Code", "Description", "Match", "Evidence", "Charge"].map((h) => (
              <th
                key={h}
                className="border-b border-[var(--border)] px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const s = MATCH_STYLE[r.match];
            return (
              <tr
                key={`${r.code}-${i}`}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-soft-2)]"
                style={{ boxShadow: "inset 2px 0 0 transparent" }}
              >
                <td className="px-3.5 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-md px-2.5 py-1 font-mono text-xs font-bold",
                      s.chip,
                    )}
                  >
                    {r.code}
                  </span>
                </td>
                <td className="px-3.5 py-3 text-sm text-[var(--foreground)]">{r.description}</td>
                <td className="px-3.5 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      s.pill,
                    )}
                  >
                    {s.label}
                    {r.match === "over-billed" && r.agreeability != null
                      ? ` · ${Math.round(r.agreeability)}%`
                      : ""}
                  </span>
                </td>
                <td className="px-3.5 py-3 text-xs text-[var(--muted)]">
                  {r.evidence ? EVIDENCE_LABEL[r.evidence] : "—"}
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs text-[var(--foreground)]">
                  {r.charge != null ? `$${r.charge.toLocaleString()}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
