"use client";

import { useRef, useState } from "react";

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

const WORD_LABELS_BY_KEY: Record<string, readonly [string, string, string, string, string]> = {
  mood: ["Very low", "Low", "Okay", "Good", "Very good"],
  tap_mood: ["Very low", "Low", "Okay", "Good", "Very good"],
  interest: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
  tap_interest: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
};

function resolveChoiceLabels(
  item: CheckInPromptItem
): readonly [string, string, string, string, string] {
  return (
    WORD_LABELS_BY_KEY[item.key] ??
    WORD_LABELS_BY_KEY[item.label.toLowerCase()] ?? [
      item.lowAnchor,
      "Low",
      "Moderate",
      "Good",
      item.highAnchor,
    ]
  );
}

interface ScaleButtonsProps {
  promptId: string;
  item: CheckInPromptItem;
  selected: number | undefined;
  skippedToday: boolean;
  onSelect: (choice: number) => void;
}

function ScaleButtons({
  promptId,
  item,
  selected,
  skippedToday,
  onSelect,
}: ScaleButtonsProps) {
  const labels = resolveChoiceLabels(item);

  return (
    <div className="mt-4">
      <div
        role="group"
        aria-labelledby={promptId}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3"
      >
        {[0, 1, 2, 3, 4].map((choice) => {
          const isChosen = !skippedToday && selected === choice;
          const wordLabel = labels[choice];
          return (
            <button
              key={choice}
              type="button"
              aria-label={`${item.label}: ${choice} of 4`}
              aria-pressed={isChosen}
              onClick={() => onSelect(choice)}
              className={`inline-flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
                isChosen
                  ? "border-accent-sage bg-accent-sage text-white shadow-xs"
                  : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
              }`}
            >
              <span className="text-sm font-semibold leading-tight">
                {wordLabel}
              </span>
              <span
                aria-hidden="true"
                className={`tabular-nums text-[11px] font-medium ${
                  isChosen ? "text-white/85" : "text-ink-muted"
                }`}
              >
                {choice}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PromptRowProps {
  item: CheckInPromptItem;
  selected: number | undefined;
  skippedToday: boolean;
  onSelect: (choice: number) => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

function PromptRow({
  item,
  selected,
  skippedToday,
  onSelect,
  rowRef,
}: PromptRowProps) {
  const promptId = `checkin-prompt-${item.key}`;
  return (
    <div ref={rowRef} className="py-7 first:pt-0 last:pb-0">
      <p
        id={promptId}
        className="font-display text-lg font-medium leading-snug text-ink-primary sm:text-xl"
      >
        {item.prompt}
      </p>
      <ScaleButtons
        promptId={promptId}
        item={item}
        selected={selected}
        skippedToday={skippedToday}
        onSelect={onSelect}
      />
    </div>
  );
}

export function CheckInInteractive({ items }: CheckInInteractiveProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skippedToday, setSkippedToday] = useState(false);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === items.length;

  function handleSelectChoice(idx: number, key: string, choice: number) {
    setSkippedToday(false);
    setAnswers((prev) => ({ ...prev, [key]: choice }));
    const nextRow = rowRefs.current[idx + 1];
    if (nextRow && typeof nextRow.scrollIntoView === "function") {
      nextRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <section
      aria-label="Twice-weekly check-in prompts"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-hairline pb-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-ink-primary sm:text-2xl">
              Two quick taps
            </h2>
            <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-0.5 text-xs font-medium text-accent-sage-hover">
              {answeredCount} of {items.length}
            </span>
          </div>
          <p className="max-w-xl text-sm text-ink-secondary">
            Tap the word that fits right now, or choose &ldquo;Not today&rdquo;.
          </p>
        </div>

        <button
          type="button"
          data-testid="not-today-button"
          onClick={() => setSkippedToday(true)}
          className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
            skippedToday
              ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover"
              : "border-border-tactile bg-surface-subtle text-ink-primary hover:bg-surface-muted"
          }`}
        >
          Not today (skip without penalty)
        </button>
      </div>

      {skippedToday ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">
            This is a preview of a simulated round and nothing is sent yet.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Taking a day off from check-ins is completely fine.
          </p>
        </div>
      ) : null}

      {!skippedToday && isComplete ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">
            This is a preview of a simulated round and nothing is sent yet.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            All {items.length} answers selected. Nothing else needed right now.
          </p>
        </div>
      ) : null}

      <div className="mt-7 divide-y divide-border-hairline">
        {items.map((item, idx) => (
          <PromptRow
            key={item.key}
            item={item}
            selected={answers[item.key]}
            skippedToday={skippedToday}
            rowRef={(el) => {
              rowRefs.current[idx] = el;
            }}
            onSelect={(choice) => handleSelectChoice(idx, item.key, choice)}
          />
        ))}
      </div>
    </section>
  );
}
