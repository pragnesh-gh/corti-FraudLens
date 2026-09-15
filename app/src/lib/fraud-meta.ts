import {
  ArrowUp,
  Scissors,
  Ghost,
  TrendingUp,
  Copy,
  type LucideIcon,
} from "lucide-react";
import type { FraudType } from "./types";

/** Display metadata for each fraud category: icon, colors, labels. */
export const FRAUD_META: Record<
  FraudType,
  {
    label: string;
    short: string;
    icon: LucideIcon;
    color: string; // hex accent
    soft: string; // soft bg hex
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
    soft: "#fff7ed",
    description: "Billing components separately that should be bundled.",
  },
  phantom: {
    label: "Phantom Billing",
    short: "PH",
    icon: Ghost,
    color: "var(--fraud-phantom)",
    soft: "var(--risk-high-soft)",
    description: "Services billed but not rendered.",
  },
  dx_inflation: {
    label: "Diagnosis Inflation",
    short: "DX",
    icon: TrendingUp,
    color: "var(--fraud-dx-inflation)",
    soft: "var(--risk-med-soft)",
    description: "Severity diagnoses unsupported by the chart.",
  },
  cloning: {
    label: "Cloning",
    short: "CL",
    icon: Copy,
    color: "var(--fraud-cloning)",
    soft: "#f5f3ff",
    description: "Identical notes across encounters or patients.",
  },
};

export const ALL_FRAUD_TYPES: FraudType[] = [
  "upcoding",
  "unbundling",
  "phantom",
  "dx_inflation",
  "cloning",
];
