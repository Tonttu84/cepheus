"use client";

import { useState } from "react";
import { CheckInVoiceInput } from "@/components/check-in-voice-input";

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

interface ScaleButtonsProps {
  promptId: string;
  itemLabel: string;
  selected: number | undefined;
  skippedToday: boolean;
  lowAnchor: string;
  highAnchor: string;
  onSelect: (choice: number) => void;
}

function ScaleButtons({
  promptId,
  itemLabel,
  selected,
  skippedToday,
  lowAnchor,
  highAnchor,
  onSelect,
}: ScaleButtonsProps) {
  return (
    <div className="mt-4">
      <div
        role="group"
        aria-labelledby={promptId}
        className="grid grid-cols-5 gap-2.5 sm:max-w-md sm:gap-3"
      >
        {[0, 1, 2, 3, 4].map((choice) => {
          const isChosen = !skippedToday && selected === choice;
          return (
            <button
              key={choice}
              type="button"
              aria-label={`${itemLabel}: ${choice} of 4`}
              aria-pressed={isChosen}
              onClick={() => onSelect(choice)}
              className={`tabular-nums inline-flex h-12 w-full items-center justify-center rounded-xl border text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
                isChosen
                  ? "border-accent-sage bg-accent-sage text-white"
                  : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-4 text-xs text-ink-secondary sm:max-w-md">
        <span>
          <span className="tabular-nums font-semibold text-ink-primary">0</span>{" "}
          — {lowAnchor}
        </span>
        <span className="text-right">
          <span className="tabular-nums font-semibold text-ink-primary">4</span>{" "}
          — {highAnchor}
        </span>
      </div>
    </div>
  );
}

interface PromptRowProps {
  item: CheckInPromptItem;
  selected: number | undefined;
  skippedToday: boolean;
  onSelect: (choice: number) => void;
}

function PromptRow({
  item,
  selected,
  skippedToday,
  onSelect,
}: PromptRowProps) {
  const promptId = `checkin-prompt-${item.key}`;
  return (
    <div className="py-7 first:pt-0 last:pb-0">
      <p
        id={promptId}
        className="font-display text-lg font-medium leading-snug text-ink-primary sm:text-xl"
      >
        {item.prompt}
      </p>
      <ScaleButtons
        promptId={promptId}
        itemLabel={item.label}
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
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skippedToday, setSkippedToday] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === items.length;
  const nextUnanswered =
    items.find((item) => answers[item.key] === undefined) ??
    items[items.length - 1] ??
    null;

  function handleSelectFour(key: string, choice: number) {
    setSkippedToday(false);
    setAnswers((prev) => ({ ...prev, [key]: choice }));
  }

  function handleVoiceOrTextScore(choice: number) {
    const target = nextUnanswered;
    if (!target) {
      return;
    }
    handleSelectFour(target.key, choice);
  }

  function handleSkip() {
    setSkippedToday(true);
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
              Twice-weekly check-in prompts (2 quick taps)
            </h2>
            <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-0.5 text-xs font-medium text-accent-sage-hover">
              {answeredCount} of {items.length} answered
            </span>
          </div>
          <p className="max-w-xl text-sm text-ink-secondary">
            If two questions feel like too much today, tap &ldquo;Not
            today&rdquo;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
          className="mt-6 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">
            This is a preview of a simulated round and nothing is sent yet.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Taking a day off from check-ins is completely fine. If you change
            your mind later, you can still tap an option below.
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
            All {items.length} answers selected. Thank you for completing the
            preview.
          </p>
        </div>
      ) : null}

      <CheckInVoiceInput
        activeItemLabel={nextUnanswered?.label ?? null}
        mode="tap"
        onSelectScore={handleVoiceOrTextScore}
        onNotToday={handleSkip}
        onCrisisHelp={() => {}}
      />

      <div className="mt-7 divide-y divide-border-hairline">
        {items.map((item) => (
          <PromptRow
            key={item.key}
            item={item}
            selected={answers[item.key]}
            skippedToday={skippedToday}
            onSelect={(choice) => handleSelectFour(item.key, choice)}
          />
        ))}
      </div>
    </section>
  );
}
