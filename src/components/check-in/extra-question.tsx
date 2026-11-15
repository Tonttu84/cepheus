"use client";

import { useState } from "react";

export interface ExtraItemData {
  readonly id: string;
  readonly topicKey: string;
  readonly topic: string;
  readonly question: string;
  readonly min: number;
  readonly max: number;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly isExperimental: boolean;
  readonly validatedInstrument: boolean;
  readonly wording: string;
  readonly isSelfHarm: boolean;
}

export interface ExtraQuestionProps {
  readonly extraItem: ExtraItemData | null;
  readonly disabled?: boolean;
}

export async function submitExtraAnswerClient(input: {
  itemId: string;
  value: number;
}): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/check-in/extra-answer", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP_${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, saved: data.saved ?? true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

export function ExtraQuestion({ extraItem, disabled = false }: ExtraQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isSkipped, setIsSkipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!extraItem) {
    return null;
  }

  const handleSelect = async (choice: number) => {
    if (disabled || isSubmitting) return;
    setIsSkipped(false);
    setSelected(choice);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await submitExtraAnswerClient({ itemId: extraItem.id, value: choice });
      if (!res.ok) {
        setErrorMessage("Answer could not be saved right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (disabled || isSubmitting) return;
    setIsSkipped(true);
    setSelected(null);
    setErrorMessage(null);
  };

  const choices = [];
  for (let i = extraItem.min; i <= extraItem.max; i++) {
    choices.push(i);
  }

  return (
    <div
      data-testid="extra-question-section"
      className="mt-8 border-t border-border-hairline pt-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border-hairline bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Optional rotating question
            </span>
          </div>
          <p
            id={`extra-prompt-${extraItem.id}`}
            className="font-display text-lg font-medium leading-snug text-ink-primary sm:text-xl"
          >
            {extraItem.question}
          </p>
        </div>

        <button
          type="button"
          data-testid="extra-question-skip"
          disabled={disabled || isSubmitting}
          onClick={handleSkip}
          className={`min-h-11 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
            disabled || isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          } ${
            isSkipped
              ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover"
              : "border-border-tactile bg-surface-subtle text-ink-primary hover:bg-surface-muted"
          }`}
        >
          Skip question
        </button>
      </div>

      {isSkipped ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-border-hairline bg-surface-subtle p-3 text-xs text-ink-secondary"
        >
          Question skipped without saving an answer.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-amber-300/80 bg-amber-50/70 p-3 text-xs font-medium text-amber-950"
        >
          {errorMessage}
        </div>
      ) : null}

      {!isSkipped ? (
        <div className="mt-4">
          <div
            role="group"
            aria-labelledby={`extra-prompt-${extraItem.id}`}
            className="grid grid-cols-5 gap-2.5 sm:max-w-md sm:gap-3"
          >
            {choices.map((choice) => {
              const isChosen = selected === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  data-testid={`extra-question-choice-${choice}`}
                  disabled={disabled || isSubmitting}
                  aria-label={`${extraItem.question}: ${choice} of ${extraItem.max}`}
                  aria-pressed={isChosen}
                  onClick={() => handleSelect(choice)}
                  className={`tabular-nums inline-flex h-12 w-full items-center justify-center rounded-xl border text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                    disabled || isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
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
              <span className="tabular-nums font-semibold text-ink-primary">{extraItem.min}</span>{" "}
              — {extraItem.minLabel}
            </span>
            <span className="text-right">
              <span className="tabular-nums font-semibold text-ink-primary">{extraItem.max}</span>{" "}
              — {extraItem.maxLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
