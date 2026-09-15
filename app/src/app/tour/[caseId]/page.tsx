"use client";

/**
 * Dynamic tour route — /tour/[caseId]
 *
 * Looks up the case by id in the tour registry and runs the TourEngine with
 * that case's content. Uses React's use() to unwrap the Promise params
 * (Next.js 16 — params is a Promise; client pages use use(params)).
 */

import { use } from "react";
import Link from "next/link";
import { getTourCase } from "@/lib/tour-cases";
import { TourEngine } from "@/components/tour/tour-engine";
import { ChevronLeft } from "lucide-react";

export default function TourCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const tc = getTourCase(caseId);

  if (!tc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
            <ChevronLeft className="h-3.5 w-3.5" /> All tours
          </Link>
        </div>
        <div className="py-20 text-center text-[var(--muted)]">
          Tour <span className="font-mono">{caseId}</span> not found.{" "}
          <Link href="/tour" className="text-[var(--accent)] underline">
            Back to tours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/tour" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
          <ChevronLeft className="h-3.5 w-3.5" /> All tours
        </Link>
      </div>
      <TourEngine tc={tc} />
    </div>
  );
}
