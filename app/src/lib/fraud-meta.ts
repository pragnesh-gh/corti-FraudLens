import {
  ArrowUp,
  Scissors,
  Ghost,
  TrendingUp,
  Copy,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { FraudType } from "./types";

/** Display metadata for each fraud category: icon, colors, labels.
 *  Colors reference the reconciled neon DESIGN.md palette in globals.css. */
export const FRAUD_META: Record<
  FraudType,
  {
    label: string;
    short: string;
    icon: LucideIcon;
    color: string; // hex accent (CSS var)
    soft: string; // soft bg (CSS var, dark-theme rgba tint)
    description: string;
  }
> = {
  upcoding: {
    label: "Upcoding",
    short: "UP",
    icon: ArrowUp,
    color: "var(--fraud-upcoding)",
    soft: "var(--risk-high-soft)",
    description: "Billing a higher-tier code than the note supports.",
  },
  unbundling: {
    label: "Unbundling",
    short: "UB",
    icon: Scissors,
    color: "var(--fraud-unbundling)",
    soft: "var(--risk-med-soft)",
    description: "Billing components separately that should be bundled.",
  },
  phantom: {
    label: "Phantom Billing",
    short: "PH",
    icon: Ghost,
    color: "var(--fraud-phantom)",
    soft: "var(--fraud-phantom-soft)",
    description: "Services billed but not rendered.",
  },
  dx_inflation: {
    label: "Diagnosis Inflation",
    short: "DX",
    icon: TrendingUp,
    color: "var(--fraud-dx-inflation)",
    soft: "var(--fraud-dx-inflation-soft)",
    description: "Severity diagnoses unsupported by the chart.",
  },
  cloning: {
    label: "Cloning",
    short: "CL",
    icon: Copy,
    color: "var(--fraud-cloning)",
    soft: "var(--fraud-cloning-soft)",
    description: "Identical notes across encounters or patients.",
  },
  clean: {
    label: "Clean Claim",
    short: "OK",
    icon: CheckCircle2,
    color: "var(--risk-low)",
    soft: "var(--risk-low-soft)",
    description: "Codes fully supported by the note — no fraud.",
  },
};

export const ALL_FRAUD_TYPES: FraudType[] = [
  "upcoding",
  "unbundling",
  "phantom",
  "dx_inflation",
  "cloning",
  // Note: "clean" is intentionally NOT in ALL_FRAUD_TYPES — that array drives the
  // Case Queue's fraud-type filter/legend, and "clean" is not a fraud type to
  // filter by. FRAUD_META still has a "clean" entry so the Live Demos hub can
  // render the clean/contrast case card.
];
