"use client";

/**
 * Guided Demo — presenter-driven 90-second app walk-through
 * --------------------------------------------------------
 * A single `/demo` page that renders the app's real screens inside a
 * full-viewport iframe and a fixed presenter overlay on top. The overlay
 * steps through the canonical 90s demo flow (Q18 of grilling-decisions.md):
 *
 *   Worklist → open hero Case Detail → agent pipeline streams →
 *   flag drilldown → $ impact → Provider Pattern Dashboard → closer.
 *
 * Navigation across screens is simulated by changing the iframe `src` so the
 * real (interactive) screens stay live while the overlay persists.
 *
 * Timing is a fixed setTimeout cascade with manual controls — the same
 * deterministic pattern as the guided tour. Pure React/CSS, no new deps.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  MapPin,
  Clock,
  Maximize2,
  MessageSquareText,
  Sparkles,
  DollarSign,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

// Same-origin app base: the dev server origin in the browser, localhost:3000
// during build/SSR.
const APP_BASE =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

// ---------------------------------------------------------------------------
// Step model — the canonical 90s demo flow from Q18
// ---------------------------------------------------------------------------

interface DemoStep {
  id: string;
  title: string;
  /** Where the app should be (iframe src). */
  route: string;
  /** ms before auto-advancing (0 = terminal, stays put). */
  duration: number;
  /** What the presenter says at this beat. */
  script: string;
  /** Short callout pointing at the thing to draw the eye to. */
  callout?: string;
  /** Icon for the step badge. */
  icon: typeof Play;
}

const STEPS: DemoStep[] = [
  {
    id: "worklist",
    title: "The Worklist",
    route: "/",
    duration: 12000,
    script:
      "This is the investigator's worklist — every submitted claim, ranked by risk and dollar impact. Dr. Elias Mercer tops the list with 45 flagged cases and $756K in projected overpayment.",
    callout: "The villain's row sits at the top.",
    icon: AlertTriangle,
  },
  {
    id: "open-case",
    title: "Open the hero case",
    route: "/case/C-2026-0042",
    duration: 4000,
    script: "Let's open the flagship case — a routine visit billed at the highest complexity.",
    callout: "Case C-2026-0042",
    icon: ArrowRight,
  },
  {
    id: "agent-pipeline",
    title: "Agent pipeline streams",
    route: "/case/C-2026-0042",
    duration: 24000,
    script:
      "Six agents run in sequence — extract facts, predict codes, ground each code in the note, verify the chart, judge fraud vs error, assess dollar impact.",
    callout: "Watch the agent cards stream in.",
    icon: Sparkles,
  },
  {
    id: "flag-drilldown",
    title: "Flag drilldown",
    route: "/case/C-2026-0042",
    duration: 15000,
    script:
      "Each finding is grounded in the exact sentences of the clinical note. Click a flag and the note highlights the evidence — or the absence of it.",
    callout: "Click a finding — the note lights up.",
    icon: MessageSquareText,
  },
  {
    id: "dollar-impact",
    title: "Dollar impact",
    route: "/case/C-2026-0042",
    duration: 11000,
    script:
      "The dollar impact is deterministic — overpayment times frequency times penalty. No LLM computes money.",
    callout: "Economic impact card.",
    icon: DollarSign,
  },
  {
    id: "provider-dashboard",
    title: "Provider Pattern Dashboard",
    route: "/providers/P-001",
    duration: 22000,
    script:
      "Zoom out to the provider. Three charts show Mercer's code mix against his peer group, his E/M level distribution, and 18 months of flagged dollars — this is a sustained pattern, not a one-off.",
    callout: "Three charts animate.",
    icon: MapPin,
  },
  {
    id: "closer",
    title: "The closer",
    route: "/providers/P-001",
    duration: 0,
    script: "Remove Corti, and this is a dead map.",
    callout: "End of demo — replay?",
    icon: MonitorPlay,
  },
];

const TOTAL_STEPS = STEPS.length;

/** Sum of all step durations (the scripted 90s budget, in ms). */
const TOTAL_DURATION = STEPS.reduce((s, st) => s + st.duration, 0);

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [bigNotes, setBigNotes] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;

  // The iframe target — full URL for same-origin loading.
  const iframeSrc = useMemo(
    () => `${APP_BASE}${current.route}`,
    [current.route],
  );

  // When the step changes to a new route, nudge the iframe to reload so the
  // streaming-agent animation replays on the case detail each time we land.
  const prevRoute = useRef(current.route);
  useEffect(() => {
    if (prevRoute.current !== current.route) {
      prevRoute.current = current.route;
      setIframeKey((k) => k + 1);
    }
  }, [current.route]);

  // Deterministic auto-advance — same pattern as the tour engine.
  useEffect(() => {
    clearTimers();
    if (!playing) return;
    const d = STEPS[step]?.duration ?? 0;
    if (d > 0) {
      const t = setTimeout(
        () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)),
        d,
      );
      timers.current.push(t);
    }
    return clearTimers;
  }, [step, playing, clearTimers]);

  // Controls — any manual interaction pauses auto-advance.
  const next = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);
  const prev = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.max(s - 1, 0));
  }, []);
  const goTo = useCallback((i: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(i, TOTAL_STEPS - 1)));
  }, []);
  const restart = useCallback(() => {
    clearTimers();
    setStep(0);
    setPlaying(true);
    setIframeKey((k) => k + 1);
  }, [clearTimers]);
  const togglePlay = useCallback(() => {
    if (isLast) {
      // On the terminal step, Play means "replay".
      restart();
      return;
    }
    setPlaying((p) => !p);
  }, [isLast, restart]);

  // Elapsed ms up to the start of the current step, for the progress bar.
  const elapsedBefore = useMemo(
    () => STEPS.slice(0, step).reduce((s, st) => s + st.duration, 0),
    [step],
  );
  const progressPct = Math.min(
    100,
    (elapsedBefore / TOTAL_DURATION) * 100,
  );

  return (
    <div className="fixed inset-0 z-50 bg-[var(--surface)]">
      {/* The live app screen */}
      <iframe
        key={iframeKey}
        src={iframeSrc}
        title="FraudLens demo screen"
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* Dim scrim so the overlay reads as a control layer */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

      {/* Presenter overlay */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:px-6 sm:pb-6">
        <div
          className="tour-step-in w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-md"
          style={{ boxShadow: "0 12px 40px -8px rgba(0,0,0,0.6)" }}
        >
          {/* Top row: step badge + step counter + presenter-notes toggle */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <StepBadge step={current} index={step} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {current.title}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{current.route}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-200">
                Step {step + 1} / {TOTAL_STEPS}
              </span>
              <button
                onClick={() => setBigNotes((b) => !b)}
                title="Toggle large presenter notes"
                className={cn(
                  "rounded-md p-1.5 transition",
                  bigNotes
                    ? "bg-[var(--accent)] text-white"
                    : "text-slate-300 hover:bg-white/10",
                )}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-white/10">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Cue card body */}
          <div className="px-5 py-4">
            <p
              className={cn(
                "font-medium leading-relaxed text-slate-50",
                bigNotes ? "text-2xl" : "text-[15px]",
              )}
            >
              {current.script}
            </p>
            {current.callout && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)]/20 px-2.5 py-1 text-xs font-medium text-[var(--accent-soft)]">
                <Sparkles className="h-3 w-3" />
                <span>{current.callout}</span>
              </div>
            )}

            {/* End-of-demo replay banner */}
            {isLast && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300">
                <MonitorPlay className="h-4 w-4" />
                End of demo — press Play to replay.
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3">
            <OverlayButton onClick={prev} disabled={step === 0} title="Previous step">
              <ChevronLeft className="h-4 w-4" />
            </OverlayButton>
            <OverlayButton onClick={togglePlay} primary title={isLast ? "Replay" : playing ? "Pause" : "Play"}>
              {playing && !isLast ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </OverlayButton>
            <OverlayButton onClick={next} disabled={isLast} title="Next step">
              <ChevronRight className="h-4 w-4" />
            </OverlayButton>
            <OverlayButton onClick={restart} title="Restart">
              <RotateCcw className="h-4 w-4" />
            </OverlayButton>

            {/* Step dots */}
            <div className="ml-2 flex items-center gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  title={s.title}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step
                      ? "w-6 bg-[var(--accent)]"
                      : i < step
                        ? "w-1.5 bg-[var(--accent)]/50"
                        : "w-1.5 bg-white/25 hover:bg-white/40",
                  )}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
              <span className="tabular-nums">
                {(TOTAL_DURATION / 1000).toFixed(0)}s total
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function OverlayButton({
  children,
  onClick,
  disabled,
  primary,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
        disabled
          ? "cursor-not-allowed text-slate-600"
          : primary
            ? "bg-[var(--accent)] text-white hover:opacity-90"
            : "text-slate-200 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function StepBadge({ step, index }: { step: DemoStep; index: number }) {
  const Icon = step.icon;
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--accent)]/20 text-[var(--accent-soft)]">
      <Icon className="h-4 w-4" />
    </span>
  );
}
