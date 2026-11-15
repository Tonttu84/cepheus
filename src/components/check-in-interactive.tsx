"use client";

import { useEffect, useState } from "react";
import { CRISIS_RESOURCES, PHQ9_ITEMS } from "@/lib/constants";
import {
  fetchCheckInState,
  submitCheckInNotToday,
  submitCheckInPhq9,
  submitCheckInTaps,
} from "@/lib/check-in-client";

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
  disabled: boolean;
  onSelect: (choice: number) => void;
}

function ScaleButtons({
  promptId,
  itemLabel,
  selected,
  skippedToday,
  lowAnchor,
  highAnchor,
  disabled,
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
              disabled={disabled}
              aria-label={`${itemLabel}: ${choice} of 4`}
              aria-pressed={isChosen}
              onClick={() => onSelect(choice)}
              className={`tabular-nums inline-flex h-12 w-full items-center justify-center rounded-xl border text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
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
  disabled: boolean;
  onSelect: (choice: number) => void;
}

function PromptRow({
  item,
  selected,
  skippedToday,
  disabled,
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
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  );
}

const PHQ9_CHOICE_LABELS = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
] as const;

export function CheckInInteractive({ items }: CheckInInteractiveProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skippedToday, setSkippedToday] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPhq9Due, setIsPhq9Due] = useState(false);
  const [phq9Answers, setPhq9Answers] = useState<Record<string, number>>({});
  const [showCrisisPath, setShowCrisisPath] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCheckInState().then((res) => {
      if (!mounted) return;
      if (res.ok) {
        if (res.taps === "not_today") {
          setSkippedToday(true);
        }
        setIsPhq9Due(res.isPhq9Due);
      } else if (res.status === 401) {
        setAuthRequired(true);
      } else if (res.status === 503 || res.saved === false) {
        setErrorMessage("Your answers were not saved and nothing was lost.");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === items.length;

  function handleSelectFour(key: string, choice: number) {
    if (isSubmitting) return;
    setSkippedToday(false);
    setErrorMessage(null);
    const next = { ...answers, [key]: choice };
    setAnswers(next);

    const hasMood = "moodScore" in next;
    const hasInterest = "interestScore" in next;
    if (hasMood && hasInterest) {
      setIsSubmitting(true);
      submitCheckInTaps({
        mood: next.moodScore,
        interest: next.interestScore,
      })
        .then((res) => {
          if (!res.ok) {
            if (res.status === 401) {
              setAuthRequired(true);
            } else if (res.status === 503 || res.saved === false) {
              setErrorMessage("Your answers were not saved and nothing was lost.");
            }
          } else {
            setIsPhq9Due(true);
          }
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }
  }

  function handleSkip() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    submitCheckInNotToday()
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setAuthRequired(true);
          } else if (res.status === 503 || res.saved === false) {
            setErrorMessage("Your answers were not saved and nothing was lost.");
          }
        } else {
          setSkippedToday(true);
          setIsPhq9Due(false);
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  function handlePhq9Select(itemNumber: number, choice: number) {
    if (isSubmitting) return;
    if (itemNumber === 9 && choice > 0) {
      setShowCrisisPath(true);
    }
    setErrorMessage(null);
    setPhq9Answers((prev) => ({ ...prev, [String(itemNumber)]: choice }));
    setIsSubmitting(true);
    submitCheckInPhq9({ itemId: String(itemNumber), value: choice })
      .then((res) => {
        if (res.showCrisisPath) {
          setShowCrisisPath(true);
        }
        if (!res.ok) {
          if (res.status === 401) {
            setAuthRequired(true);
          } else if (res.status === 503 || res.saved === false) {
            setErrorMessage("Your answers were not saved and nothing was lost.");
          }
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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
            disabled={isSubmitting}
            onClick={handleSkip}
            className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
              isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            } ${
              skippedToday
                ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover"
                : "border-border-tactile bg-surface-subtle text-ink-primary hover:bg-surface-muted"
            }`}
          >
            Not today (skip without penalty)
          </button>
        </div>
      </div>

      {authRequired ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-border-hairline bg-surface-subtle p-4 text-sm text-ink-secondary"
        >
          Please{" "}
          <a
            href="/sign-in"
            className="font-semibold text-ink-primary underline hover:text-accent-sage"
          >
            sign in
          </a>{" "}
          to continue.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-amber-300/80 bg-amber-50/70 p-4 text-sm text-amber-950 font-medium"
        >
          {errorMessage}
        </div>
      ) : null}

      {showCrisisPath ? (
        <div
          role="region"
          aria-label="Immediate support and emergency help"
          data-testid="crisis-path"
          className="mt-6 rounded-2xl border border-rose-300 bg-rose-50/90 p-6 sm:p-8"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-rose-600"
              aria-hidden="true"
            />
            <h3 className="font-display text-lg font-semibold text-rose-950">
              Direct connection to a person — nothing automated in between
            </h3>
          </div>
          <p className="mt-1 text-xs text-rose-900">
            Emergency help and support are available right now. You do not need
            to finish this check-in to reach out.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CRISIS_RESOURCES.map((resource) => (
              <a
                key={resource.id}
                href={resource.href}
                data-testid={`crisis-resource-${resource.id}`}
                className="flex min-h-12 flex-col justify-between rounded-xl border border-rose-200 bg-white p-3.5 shadow-sm transition hover:border-rose-400"
              >
                <div>
                  <p className="text-xs font-semibold text-rose-900">
                    {resource.label}
                  </p>
                  <p className="tabular-nums mt-0.5 text-base font-bold text-rose-950">
                    {resource.phone}
                  </p>
                </div>
                <p className="mt-1 text-xs text-rose-800">
                  {resource.availability}
                </p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

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

      <div className="mt-7 divide-y divide-border-hairline">
        {items.map((item) => (
          <PromptRow
            key={item.key}
            item={item}
            selected={answers[item.key]}
            skippedToday={skippedToday}
            disabled={isSubmitting}
            onSelect={(choice) => handleSelectFour(item.key, choice)}
          />
        ))}
      </div>

      {isPhq9Due && !skippedToday ? (
        <div className="mt-10 border-t border-border-hairline pt-8">
          <div className="mb-6 space-y-1">
            <h3 className="font-display text-lg font-semibold text-ink-primary sm:text-xl">
              Fortnightly PHQ-9 questions
            </h3>
            <p className="text-xs text-ink-secondary">
              Over the last 2 weeks, how often have you been bothered by any of the following problems?
            </p>
          </div>

          <div className="divide-y divide-border-hairline">
            {PHQ9_ITEMS.map((item) => (
              <div key={item.number} className="py-5 first:pt-0 last:pb-0">
                <p className="font-display text-base font-medium leading-snug text-ink-primary">
                  <span className="font-semibold">{item.number}.</span> {item.prompt}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PHQ9_CHOICE_LABELS.map((label, choiceIndex) => {
                    const isChosen = phq9Answers[String(item.number)] === choiceIndex;
                    return (
                      <button
                        key={choiceIndex}
                        type="button"
                        disabled={isSubmitting}
                        aria-label={`Question ${item.number}: ${choiceIndex} of 3`}
                        aria-pressed={isChosen}
                        onClick={() => handlePhq9Select(item.number, choiceIndex)}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                          isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        } ${
                          isChosen
                            ? "border-accent-sage bg-accent-sage text-white font-semibold"
                            : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
                        }`}
                      >
                        <span className="tabular-nums font-semibold">{choiceIndex}</span> — {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
