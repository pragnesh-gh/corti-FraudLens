import { cn } from "@/lib/utils";
import { FRAUD_META } from "@/lib/fraud-meta";
import type { FraudType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

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
    high: "bg-[var(--risk-high-soft)] text-[var(--risk-high)] border-[var(--risk-high)]/20",
    med: "bg-[var(--risk-med-soft)] text-[var(--risk-med)] border-[var(--risk-med)]/20",
    low: "bg-[var(--risk-low-soft)] text-[var(--risk-low)] border-[var(--risk-low)]/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        styles[level],
        className,
      )}
    >
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
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: m.color,
        backgroundColor: m.soft,
        borderColor: `${m.color}33`,
      }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {m.label}
    </span>
  );
}

/** Intent badge: solid red for fraud, hollow amber for error. */
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
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-[var(--muted)] border-[var(--border)] bg-[var(--surface)]",
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
        style={{ background: "var(--risk-high)", borderColor: "var(--risk-high)" }}
      >
        Likely Fraud
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-[var(--risk-med)] bg-transparent",
        className,
      )}
      style={{ borderColor: "var(--risk-med)" }}
    >
      Possible Error
    </span>
  );
}

/** Card surface. */
export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        className,
      )}
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
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
