"use client";

import { useState } from "react";

export interface CheckInPromptItem {
  key: string;
  label: string;
  prompt: string;
  lowAnchor: string;
  highAnchor: string;
}

interface CheckInInteractiveProps {
  items: readonly CheckInPromptItem[];
}

type CheckInMode = "four_prompts" | "single_overall";

const SINGLE_OVERALL_PROMPT: CheckInPromptItem = {
  key: "single-overall",
  label: "Overall check-in",
  prompt: "Overall, how has your wellbeing felt over the past few days?",
  lowAnchor: "Much heavier than usual",
  highAnchor: "Steady & well",
};

interface ScaleButtonsProps {
  promptId: string;
  selected: number | undefined;
  skippedToday: boolean;
  lowAnchor: string;
  highAnchor: string;
  onSelect: (choice: number) => void;
}

function ScaleButtons({
  promptId,
  selected,
  skippedToday,
  lowAnchor,
  highAnchor,
  onSelect,
}: ScaleButtonsProps) {
  return (
    <div>
      <div
        role="group"
        aria-labelledby={promptId}
        className="mt-3.5 flex flex-wrap items-center gap-2.5"
      >
        {[1, 2, 3, 4, 5].map((choice) => {
          const isChosen = !skippedToday && selected === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={isChosen}
              onClick={() => onSelect(choice)}
              className={`tabular-nums inline-flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
                isChosen
                  ? "border-accent-sage bg-accent-sage text-white shadow-2xs"
                  : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage/50 hover:bg-accent-sage-soft/50"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>1 = {lowAnchor}</span>
        <span>5 = {highAnchor}</span>
      </div>
    </div>
  );
}

interface PromptCardProps {
  item: CheckInPromptItem;
  indexLabel: string;
  selected: number | undefined;
  skippedToday: boolean;
  onSelect: (choice: number) => void;
}

function PromptCard({
  item,
  indexLabel,
  selected,
  skippedToday,
  onSelect,
}: PromptCardProps) {
  const promptId = `checkin-prompt-${item.key}`;
  return (
    <div className="rounded-xl border border-border-hairline bg-surface-subtle/75 p-4.5 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {indexLabel} · {item.label}
        </span>
        <span className="text-xs text-ink-muted">
          {item.lowAnchor} &rarr; {item.highAnchor}
        </span>
      </div>
      <p id={promptId} className="mt-2 text-sm font-semibold text-ink-primary">
        {item.prompt}
      </p>
      <ScaleButtons
        promptId={promptId}
        selected={selected}
        skippedToday={skippedToday}
        lowAnchor={item.lowAnchor}
        highAnchor={item.highAnchor}
        onSelect={onSelect}
      />
    </div>
  );
}

export function CheckInInteractive({ items }: CheckInInteractiveProps) {
  const [mode, setMode] = useState<CheckInMode>("four_prompts");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [singleAnswer, setSingleAnswer] = useState<number | undefined>(
    undefined
  );
  const [skippedToday, setSkippedToday] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const isComplete =
    mode === "single_overall"
      ? singleAnswer !== undefined
      : answeredCount === items.length;

  function handleSelectFour(key: string, choice: number) {
    setSkippedToday(false);
    setAnswers((prev) => ({ ...prev, [key]: choice }));
  }

  function handleSelectSingle(choice: number) {
    setSkippedToday(false);
    setSingleAnswer(choice);
  }

  function handleSkip() {
    setSkippedToday(true);
  }

  function handleToggleMode() {
    setMode((prev) =>
      prev === "four_prompts" ? "single_overall" : "four_prompts"
    );
  }

  return (
    <section
      aria-label="Twice-weekly check-in prompts"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-sage">
              Twice-Weekly Check-In
            </span>
            {mode === "four_prompts" ? (
              <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-2.5 py-0.5 text-xs font-medium text-accent-sage-hover">
                {answeredCount} of {items.length} answered
              </span>
            ) : null}
          </div>
          <h2 className="font-display mt-1 text-xl font-semibold text-ink-primary">
            Twice-weekly check-in prompts (4 quick taps)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            If 4 taps feel like too much today, you can answer a single overall
            check-in question or choose &ldquo;Not today&rdquo;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="single-question-mode-button"
            onClick={handleToggleMode}
            className="min-h-11 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            {mode === "four_prompts"
              ? "Just 1 overall question today"
              : "Show all 4 prompts"}
          </button>
          <button
            type="button"
            data-testid="not-today-button"
            onClick={handleSkip}
            className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
              skippedToday
                ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover"
                : "border-border-tactile bg-surface-subtle text-ink-primary hover:bg-surface-muted"
            }`}
          >
            Not today (skip without penalty)
          </button>
        </div>
      </div>

      {skippedToday ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">
            Recorded as missed — no score, no penalty.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Taking a day off from check-ins is completely fine. If you change
            your mind later, you can tap any option below.
          </p>
        </div>
      ) : null}

      {!skippedToday && isComplete ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">Check-in noted — thank you.</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {mode === "single_overall"
              ? "Your single overall check-in is recorded for this simulated round."
              : `All ${items.length} quick taps recorded for this simulated round.`}
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {mode === "single_overall" ? (
          <PromptCard
            item={SINGLE_OVERALL_PROMPT}
            indexLabel="1 question"
            selected={singleAnswer}
            skippedToday={skippedToday}
            onSelect={handleSelectSingle}
          />
        ) : (
          items.map((item, idx) => (
            <PromptCard
              key={item.key}
              item={item}
              indexLabel={`Prompt ${idx + 1}`}
              selected={answers[item.key]}
              skippedToday={skippedToday}
              onSelect={(choice) => handleSelectFour(item.key, choice)}
            />
          ))
        )}
      </div>
    </section>
  );
}
