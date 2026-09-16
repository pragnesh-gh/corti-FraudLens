"use client";

/**
 * /tour/[caseId] — the Live Demo case experience.
 *
 * A thin wrapper that resolves the tour case and renders the <TourEngine>,
 * the 7-step runner (intro → note → billed → predicted → retrace → impact →
 * verdict) with full deterministic/auto-advance + manual step-through controls.
 * The engine fires the real Corti pipeline in the background and surfaces
 * "confirmed live" badges when it lands.
 *
 * The history-dependent case (case_history_012) renders the "Pull patient
 * history" mind-change step via TourEngine's HistoryRetraceStep.
 *
 * Pure React/CSS — no screenshots, no multimodal, no new deps.
 */

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTourCase } from "@/lib/tour-cases";
import { TourEngine } from "@/components/tour/tour-engine";

export default function TourCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const tc = getTourCase(caseId);

  if (!tc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
            <ChevronLeft className="h-3.5 w-3.5" /> Live Demos
          </Link>
        </div>
        <div className="py-20 text-center text-[var(--muted)]">
          Case <span className="font-mono">{caseId}</span> not found.{" "}
          <Link href="/tour" className="text-[var(--accent)] underline">
            Back to demos
          </Link>
        </div>
      </div>
    );
  }

  return <TourEngine tc={tc} />;
}
