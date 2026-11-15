"use client";

import { useEffect, useState } from "react";

type ToolMode = "timer" | "breathing";

const WALK_SECONDS = 10 * 60;
const BREATHE_SECONDS = 3 * 60;

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getBreathPhase(elapsedSec: number): {
  label: string;
  scaleClass: string;
} {
  const pos = elapsedSec % 12;
  if (pos < 4) return { label: "Breathe in gently...", scaleClass: "scale-125" };
  if (pos < 6) return { label: "Pause softly...", scaleClass: "scale-125" };
  return { label: "Breathe out slowly...", scaleClass: "scale-95" };
}

function BreathingView({
  remainingSec,
  running,
  finished,
  breath,
}: {
  remainingSec: number;
  running: boolean;
  finished: boolean;
  breath: { label: string; scaleClass: string };
}) {
  const subtitle = finished
    ? "Pause complete — take your time."
    : running
      ? breath.label
      : "Press start whenever you feel ready.";

  return (
    <div className="flex flex-col items-center gap-4 py-3 text-center">
      <div
        data-testid="breathing-circle"
        className={`flex h-28 w-28 items-center justify-center rounded-full border-2 border-accent-sage bg-accent-sage-soft/80 text-xs font-semibold text-accent-sage-hover transition-transform duration-1000 ease-in-out ${
          running ? breath.scaleClass : "scale-100"
        }`}
      >
        <span className="tabular-nums text-base font-semibold">
          {formatClock(remainingSec)}
        </span>
      </div>
      <p className="text-sm font-medium text-ink-primary">{subtitle}</p>
    </div>
  );
}

function TimerView({
  remainingSec,
  finished,
}: {
  remainingSec: number;
  finished: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-hairline bg-surface-card px-4 py-3.5">
      <div>
        <p className="tabular-nums font-display text-2xl font-semibold text-ink-primary">
          {formatClock(remainingSec)}
        </p>
        <p className="text-xs text-ink-secondary">
          {finished
            ? "Pause complete — even a couple of minutes outside helps."
            : "Easy pace, stop anytime you like."}
        </p>
      </div>
    </div>
  );
}

export function GuidedActivityWidget({ actionKey }: { actionKey?: string }) {
  const defaultMode: ToolMode =
    actionKey === "breathing_space" ? "breathing" : "timer";
  const [mode, setMode] = useState<ToolMode>(defaultMode);
  const [running, setRunning] = useState(false);
  const [completedEarly, setCompletedEarly] = useState(false);
  const [remainingSec, setRemainingSec] = useState(
    defaultMode === "breathing" ? BREATHE_SECONDS : WALK_SECONDS
  );

  const totalSec = mode === "breathing" ? BREATHE_SECONDS : WALK_SECONDS;
  const finished = completedEarly || remainingSec === 0;
  const timerTabLabel =
    actionKey === "bright_light" ? "10-min daylight timer" : "10-min walk timer";
  const startLabel = mode === "breathing" ? "Start breathing" : "Start timer";

  useEffect(() => {
    if (!running || remainingSec <= 0) return;
    const id = setInterval(() => {
      setRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running, remainingSec]);

  useEffect(() => {
    if (remainingSec === 0 && running) {
      setRunning(false);
    }
  }, [remainingSec, running]);

  function switchMode(nextMode: ToolMode) {
    setMode(nextMode);
    setRunning(false);
    setCompletedEarly(false);
    setRemainingSec(nextMode === "breathing" ? BREATHE_SECONDS : WALK_SECONDS);
  }

  return (
    <div
      data-testid="guided-activity-widget"
      className="mt-5 rounded-xl border border-border-hairline bg-surface-subtle/80 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Optional guided pause
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            data-testid="guided-mode-timer"
            onClick={() => switchMode("timer")}
            className={`min-h-11 rounded-lg border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
              mode === "timer"
                ? "border-accent-sage bg-accent-sage text-white"
                : "border-border-tactile bg-surface-card text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {timerTabLabel}
          </button>
          <button
            type="button"
            data-testid="guided-mode-breathing"
            onClick={() => switchMode("breathing")}
            className={`min-h-11 rounded-lg border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
              mode === "breathing"
                ? "border-accent-sage bg-accent-sage text-white"
                : "border-border-tactile bg-surface-card text-ink-secondary hover:text-ink-primary"
            }`}
          >
            3-min breathing
          </button>
        </div>
      </div>

      {mode === "breathing" ? (
        <BreathingView
          remainingSec={remainingSec}
          running={running}
          finished={finished}
          breath={getBreathPhase(totalSec - remainingSec)}
        />
      ) : (
        <TimerView remainingSec={remainingSec} finished={finished} />
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {!finished ? (
          <>
            <button
              type="button"
              data-testid="guided-start-pause"
              onClick={() => setRunning((r) => !r)}
              className="min-h-11 rounded-xl bg-accent-sage px-4 py-2 text-xs font-semibold text-white hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
            >
              {running ? "Pause" : startLabel}
            </button>
            <button
              type="button"
              data-testid="guided-done-btn"
              onClick={() => {
                setRunning(false);
                setCompletedEarly(true);
              }}
              className="min-h-11 rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
            >
              I&apos;m done
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="guided-reset-btn"
            onClick={() => switchMode(mode)}
            className="min-h-11 rounded-xl border border-border-tactile bg-surface-card px-4 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            Start again
          </button>
        )}
      </div>
    </div>
  );
}
