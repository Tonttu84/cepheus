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

export function CheckInInteractive({ items }: CheckInInteractiveProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skippedToday, setSkippedToday] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === items.length;

  function handleSelect(key: string, choice: number) {
    setSkippedToday(false);
    setAnswers((prev) => ({ ...prev, [key]: choice }));
  }

  function handleSkip() {
    setSkippedToday(true);
  }

  return (
    <section
      aria-label="Twice-weekly check-in prompts"
      className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#255748]">
            Twice-Weekly Check-In
          </span>
          <h2 className="font-display mt-1 text-xl font-semibold text-[#1a2421]">
            Twice-weekly check-in prompts (4 quick taps)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#515d58]">
            If 4 taps feel like too much today, you can answer a single overall
            check-in question or choose &ldquo;Not today&rdquo;.
          </p>
        </div>
        <button
          type="button"
          data-testid="not-today-button"
          onClick={handleSkip}
          className={`rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer ${
            skippedToday
              ? "border-[#255748] bg-[#eaf2ef] text-[#1c4438]"
              : "border-[#d6cfc4] bg-[#faf8f5] text-[#1a2421] hover:bg-[#f1ece4]"
          }`}
        >
          Not today (skip without penalty)
        </button>
      </div>

      {skippedToday ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 p-4 text-sm text-[#1c4438]"
        >
          <p className="font-semibold">
            Recorded as missed — no score, no penalty.
          </p>
          <p className="mt-1 text-xs text-[#2d4a40]">
            Taking a day off from check-ins is completely fine. If you change
            your mind later, you can tap any option below.
          </p>
        </div>
      ) : null}

      {!skippedToday && allAnswered ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 p-4 text-sm text-[#1c4438]"
        >
          <p className="font-semibold">Check-in noted — thank you.</p>
          <p className="mt-1 text-xs text-[#2d4a40]">
            All {items.length} quick taps recorded for this simulated round.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {items.map((item, idx) => {
          const selected = answers[item.key];
          return (
            <div
              key={item.key}
              className="rounded-xl border border-[#e4ddd2] bg-[#faf8f5]/75 p-4.5 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#697570]">
                  Prompt {idx + 1} · {item.label}
                </span>
                <span className="text-xs text-[#697570]">
                  {item.lowAnchor} &rarr; {item.highAnchor}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#1a2421]">
                {item.prompt}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((choice) => {
                  const isChosen = !skippedToday && selected === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      aria-pressed={isChosen}
                      onClick={() => handleSelect(item.key, choice)}
                      className={`tabular-nums inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer ${
                        isChosen
                          ? "border-[#255748] bg-[#255748] text-white shadow-2xs"
                          : "border-[#d6cfc4] bg-white text-[#1a2421] hover:border-[#255748]/50 hover:bg-[#eaf2ef]/40"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
