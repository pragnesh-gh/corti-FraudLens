"use client";

/**
 * LegalBriefView — renders the rich multi-section legal brief produced by
 * `buildLegalBrief` (app/src/lib/legal-brief.ts). Splits the plain-text brief on
 * its "## " section-header convention and renders headers distinctly from body
 * paragraphs/bullets, inside the sober/printable legal surface.
 *
 * Pure client component — no server imports. The brief text is computed by the
 * caller (each surface builds it from its case + CaseResult data).
 */

import { useMemo } from "react";

interface Section {
  heading: string;
  body: string[];
}

/** Parse the brief text into ordered {heading, body} sections. */
function parseBrief(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), body: [] };
    } else if (line.startsWith("### ")) {
      // Sub-header — render as a bold body line marker.
      if (current) current.body.push(`### ${line.slice(4).trim()}`);
    } else {
      if (current) current.body.push(line);
      else if (line.trim()) sections.push({ heading: "", body: [line] });
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function LegalBriefView({ brief }: { brief: string }) {
  const sections = useMemo(() => parseBrief(brief), [brief]);
  return (
    <div className="space-y-4">
      {sections.map((s, i) => {
        // The first section is the document title block (no heading, just the
        // HEDGE preamble) — render it as a lead paragraph.
        if (!s.heading && i === 0) {
          return (
            <div key={i} className="space-y-2">
              {s.body.filter((l) => l.trim()).map((l, j) => (
                <p key={j} className="text-[11px] italic leading-relaxed text-[var(--muted)]">{l}</p>
              ))}
            </div>
          );
        }
        return (
          <section key={i} className="space-y-1.5">
            <h4 className="font-display text-[13px] font-bold uppercase tracking-wide text-[var(--surface-sober-ink)]">
              {s.heading}
            </h4>
            <div className="space-y-1">
              {s.body.map((l, j) => {
                const key = `${i}-${j}`;
                if (l.startsWith("### ")) {
                  return (
                    <p key={key} className="pt-1 text-xs font-bold uppercase tracking-wide text-[var(--surface-sober-ink)]">
                      {l.slice(4)}
                    </p>
                  );
                }
                if (l.startsWith("- ")) {
                  return (
                    <p key={key} className="pl-3 text-xs leading-relaxed text-[var(--surface-sober-ink)]">
                      <span className="mr-1.5 text-[var(--accent)]">•</span>
                      {renderInline(l.slice(2))}
                    </p>
                  );
                }
                if (l.trim().startsWith("- ")) {
                  return (
                    <p key={key} className="pl-3 text-xs leading-relaxed text-[var(--surface-sober-ink)]">
                      <span className="mr-1.5 text-[var(--accent)]">•</span>
                      {renderInline(l.trim().slice(2))}
                    </p>
                  );
                }
                if (l.trim() === "") return null;
                return (
                  <p key={key} className="text-xs leading-relaxed text-[var(--surface-sober-ink)]">
                    {renderInline(l)}
                  </p>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Render inline emphasis for quoted excerpts ("...") and code-like tokens. */
function renderInline(text: string): React.ReactNode {
  // Highlight quoted excerpts in italic.
  const parts = text.split(/("[^"]+")/g);
  return parts.map((p, i) => {
    if (p.startsWith('"') && p.endsWith('"') && p.length > 1) {
      return (
        <span key={i} className="italic text-[var(--muted)]">{p}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
