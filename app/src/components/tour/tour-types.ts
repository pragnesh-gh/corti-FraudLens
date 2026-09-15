/**
 * Shared types for the multi-case guided tour.
 *
 * A TourCase bundles everything a single tour needs: the case identity, the
 * verbatim clinical note, the billed vs correct codes, the fraud signals, and
 * the seven-step script that drives the TourEngine. Each tour renders the same
 * intro → note → billed → truth → mismatch → impact → verdict arc, adapted to
 * its fraud type via the fields below.
 */

import type { FraudType } from "@/lib/types";

/** One code row in either the "billed" or "truth" column. */
export interface TourCode {
  code: string;
  description: string;
  /** True when this is the fraudulent / unsupported line. */
  fraudulent: boolean;
  /** Why it was flagged — shown on the mismatch step. */
  flagReason?: string;
}

/** One beat in the deterministic step cascade. */
export interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  /** ms the tour waits before auto-advancing (0 = stop at the end). */
  duration: number;
}

/** The payer / billing model framing for the intro and impact steps. */
export type BillingModel = "risk_adjustment" | "fee_for_service";

/** A node in the impact-step flow diagram (dx → mechanism → $). */
export interface ImpactNode {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  /** CSS color var, e.g. "var(--fraud-upcoding)". */
  color: string;
  /** CSS soft-bg var, e.g. "var(--risk-high-soft)". */
  soft: string;
}

/** Summary row for the verdict step. */
export interface VerdictFact {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Render the value in the risk-high color (used for the $ impact row). */
  money?: boolean;
}

/**
 * A complete tour. Authored once per case in src/lib/tour-cases.ts and consumed
 * by the TourEngine + step renderers.
 */
export interface TourCase {
  /** URL-safe case id, e.g. "case_padding_002". */
  caseId: string;
  /** Maps to FRAUD_META for icon/color/label. */
  fraudType: FraudType;
  /** Payer model — drives the intro framing and impact mechanism. */
  billingModel: BillingModel;
  /** Short label for the payer-model badge, e.g. "Medicare Advantage · risk-adjusted". */
  billingModelLabel: string;
  /** One-line hub teaser. */
  teaser: string;
  /** Verbatim clinical note text (from docs/eval-cases.json). */
  noteText: string;
  /** Codes the note actually supports. */
  correctCodes: TourCode[];
  /** Codes the provider submitted. At least one is fraudulent. */
  billedCodes: TourCode[];
  /** The fraudulent code, surfaced for the mismatch + impact steps. */
  fraudCode: string;
  /** Agent fraud confidence (0-1), matched to src/lib/data.ts per pattern. */
  fraudConfidence: number;
  /** Note grounding for the fraud code (0-1); near-zero = unsupported. */
  fraudGrounding: number;
  /** Verbatim note spans that prove the missing evidence. */
  missingEvidenceSpans: string[];
  /** Headline of the proof callout under the note, e.g. "no cardiac findings". */
  proofHeadline: string;
  /** Body of the proof callout under the note. */
  proofBody: string;
  /** The seven-step script (intro … verdict). */
  steps: TourStep[];
  /** Intro-step "what we're looking at" facts. */
  introFacts: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[];
  /** Intro-step mechanism paragraphs (first is emphasized). */
  introMechanism: { body: React.ReactNode }[];
  /** The mismatch-step headline, e.g. "The mismatch: I11.9". */
  mismatchTitle: string;
  /** The mismatch-step subtitle. */
  mismatchSubtitle: string;
  /** The billed-side label on the mismatch card (default "Billed (transcript)"). */
  mismatchBilledLabel?: string;
  /** The truth-side value on the mismatch card, e.g. "Nothing" or "I10 only". */
  mismatchTruthValue: string;
  /** The truth-side caption under the mismatch-truth value. */
  mismatchTruthCaption: string;
  /** Impact-step title, e.g. "Why a diagnosis pays" or "Why an upcode pays". */
  impactTitle: string;
  /** Impact-step subtitle. */
  impactSubtitle: string;
  /** The 3-node flow diagram. */
  impactNodes: ImpactNode[];
  /** Impact KPI tiles. */
  impactStats: { label: string; value: string; danger?: boolean }[];
  /** Impact-step "key insight" paragraph. */
  impactInsight: React.ReactNode;
  /** Verdict-step summary facts. */
  verdictFacts: VerdictFact[];
  /** Verdict-step conclusion callout body. */
  verdictConclusion: React.ReactNode;
  /** CSS color var for the verdict/conclusion accent, e.g. "var(--fraud-dx-inflation)". */
  accentColor: string;
  /** CSS soft-bg var for the verdict/conclusion accent. */
  accentSoft: string;
}
