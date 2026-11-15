"use client";

import { useEffect, useRef, useState } from "react";
import { CheckInVoiceInput } from "@/components/check-in-voice-input";
import { CRISIS_RESOURCES, PHQ9_ITEMS } from "@/lib/constants";
import {
  fetchCheckInState,
  submitCheckInCrisisAlert,
  submitCheckInGad7,
  submitCheckInNotToday,
  submitCheckInPhq9,
  submitCheckInTaps,
} from "@/lib/check-in-client";
import { GAD7_TEXT_EN } from "@/domain/instruments";
import type { VoiceChoiceMode } from "@/domain/arduino/voice";
import { ExtraQuestion, type ExtraItemData } from "./check-in/extra-question";

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

const WORD_LABELS_BY_KEY: Record<
  string,
  readonly [string, string, string, string, string]
> = {
  moodScore: ["Very low", "Low", "Okay", "Good", "Very good"],
  mood: ["Very low", "Low", "Okay", "Good", "Very good"],
  tap_mood: ["Very low", "Low", "Okay", "Good", "Very good"],
  interestScore: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
  interest: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
  tap_interest: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
};

const PHQ9_CHOICE_LABELS = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
] as const;

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
  disabled: boolean;
  onSelect: (choice: number) => void;
}

function ScaleButtons({
  promptId,
  item,
  selected,
  skippedToday,
  disabled,
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
              disabled={disabled}
              aria-label={`${item.label}: ${choice} of 4`}
              aria-pressed={isChosen}
              onClick={() => onSelect(choice)}
              className={`inline-flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
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
  disabled: boolean;
  onSelect: (choice: number) => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

function PromptRow({
  item,
  selected,
  skippedToday,
  disabled,
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
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  );
}

function CrisisPathBanner() {
  return (
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
        Emergency help and support are available right now. You do not need to
        finish this check-in to reach out.
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
  );
}

interface Phq9SectionProps {
  phq9Answers: Record<string, number>;
  isSubmitting: boolean;
  onSelect: (itemNumber: number, choiceIndex: number) => void;
}

function Phq9Section({
  phq9Answers,
  isSubmitting,
  onSelect,
}: Phq9SectionProps) {
  return (
    <div className="mt-10 border-t border-border-hairline pt-8" data-testid="phq9-section">
      <div className="mb-6 space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink-primary sm:text-xl">
          Fortnightly PHQ-9 questions
        </h3>
        <p className="text-xs text-ink-secondary">
          Over the last 2 weeks, how often have you been bothered by any of the
          following problems?
        </p>
      </div>

      <div className="divide-y divide-border-hairline">
        {PHQ9_ITEMS.map((item) => (
          <div key={item.number} className="py-5 first:pt-0 last:pb-0" data-testid={`phq9-question-${item.number}`}>
            <p className="font-display text-base font-medium leading-snug text-ink-primary">
              <span className="font-semibold">{item.number}.</span>{" "}
              {item.prompt}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PHQ9_CHOICE_LABELS.map((label, choiceIndex) => {
                const isChosen =
                  phq9Answers[String(item.number)] === choiceIndex;
                return (
                  <button
                    key={choiceIndex}
                    type="button"
                    disabled={isSubmitting}
                    aria-label={`Question ${item.number}: ${choiceIndex} of 3`}
                    aria-pressed={isChosen}
                    onClick={() => onSelect(item.number, choiceIndex)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage ${
                      isSubmitting
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    } ${
                      isChosen
                        ? "border-accent-sage bg-accent-sage text-white font-semibold"
                        : "border-border-tactile bg-surface-card text-ink-primary hover:border-accent-sage hover:bg-accent-sage-soft/60"
                    }`}
                  >
                    <span className="tabular-nums font-semibold">
                      {choiceIndex}
                    </span>{" "}
                    — {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Gad7SectionProps {
  gad7Answers: Record<string, number>;
  isSubmitting: boolean;
  onSelect: (itemId: string, choiceIndex: number) => void;
}

function Gad7Section({
  gad7Answers,
  isSubmitting,
  onSelect,
}: Gad7SectionProps) {
  return (
    <div className="mt-10 border-t border-border-hairline pt-8" data-testid="gad7-section">
      <div className="mb-6 space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink-primary sm:text-xl">
          Fortnightly GAD-7 anxiety questions
        </h3>
        <p className="text-xs text-ink-secondary">
          Over the last 2 weeks, how often have you been bothered by the following problems?
        </p>
      </div>

      <div className="divide-y divide-border-hairline">
        {GAD7_TEXT_EN.items.map((item) => (
          <div key={item.id} className="py-5 first:pt-0 last:pb-0" data-testid={`gad7-question-${item.id}`}>
            <p className="font-display text-base font-medium leading-snug text-ink-primary">
              <span className="font-semibold">{item.id}.</span> {item.text}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PHQ9_CHOICE_LABELS.map((label, choiceIndex) => {
                const isChosen = gad7Answers[item.id] === choiceIndex;
                return (
                  <button
                    key={choiceIndex}
                    type="button"
                    disabled={isSubmitting}
                    aria-label={`GAD-7 Question ${item.id}: ${choiceIndex} of 3`}
                    aria-pressed={isChosen}
                    onClick={() => onSelect(item.id, choiceIndex)}
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
  );
}

interface CheckInStatusBannersProps {
  authRequired: boolean;
  errorMessage: string | null;
  showCrisisPath: boolean;
  skippedToday: boolean;
  isComplete: boolean;
  itemCount: number;
}

function CheckInStatusBanners({
  authRequired,
  errorMessage,
  showCrisisPath,
  skippedToday,
  isComplete,
  itemCount,
}: CheckInStatusBannersProps) {
  return (
    <>
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
          className="mt-6 rounded-xl border border-amber-300/80 bg-amber-50/70 p-4 text-sm font-medium text-amber-950"
        >
          {errorMessage}
        </div>
      ) : null}

      {showCrisisPath ? <CrisisPathBanner /> : null}

      {skippedToday ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 p-4 text-sm text-accent-sage-hover"
        >
          <p className="font-semibold">
            The answers of this round are saved. A round left unanswered is
            recorded as not answered and never scored as zero, and data for
            sample patients is simulated.
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
            The answers of this round are saved. A round left unanswered is
            recorded as not answered and never scored as zero, and data for
            sample patients is simulated.
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            All {itemCount} answers selected.
          </p>
        </div>
      ) : null}
    </>
  );
}

interface CheckInHeaderProps {
  answeredCount: number;
  totalCount: number;
  isSubmitting: boolean;
  skippedToday: boolean;
  onSkip: () => void;
}

function CheckInHeader({
  answeredCount,
  totalCount,
  isSubmitting,
  skippedToday,
  onSkip,
}: CheckInHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-hairline pb-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-ink-primary sm:text-2xl">
            Two quick taps
          </h2>
          <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-3 py-0.5 text-xs font-medium text-accent-sage-hover">
            {answeredCount} of {totalCount}
          </span>
        </div>
        <p className="max-w-xl text-sm text-ink-secondary">
          Tap the word that fits right now, or choose &ldquo;Not today&rdquo;.
        </p>
      </div>

      <button
        type="button"
        data-testid="not-today-button"
        disabled={isSubmitting}
        onClick={onSkip}
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
  );
}

function scrollNextPromptRow(
  rows: Array<HTMLDivElement | null>,
  idx: number
) {
  const nextRow = rows[idx + 1];
  if (nextRow && typeof nextRow.scrollIntoView === "function") {
    nextRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

const SAVE_FAILED_COPY = "Your answers were not saved and nothing was lost.";

export function CheckInInteractive({ items }: CheckInInteractiveProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skippedToday, setSkippedToday] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPhq9Due, setIsPhq9Due] = useState(false);
  const [phq9Answers, setPhq9Answers] = useState<Record<string, number>>({});
  const [isGad7Due, setIsGad7Due] = useState(false);
  const [gad7Answers, setGad7Answers] = useState<Record<string, number>>({});
  const [showCrisisPath, setShowCrisisPath] = useState(false);
  const [extraItem, setExtraItem] = useState<ExtraItemData | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let mounted = true;
    fetchCheckInState().then((res) => {
      if (!mounted) return;
      if (res.ok) {
        if (res.taps === "not_today") setSkippedToday(true);
        setIsPhq9Due(res.isPhq9Due);
        setIsGad7Due(Boolean(res.isGad7Due));
        if (res.extraItem) {
          setExtraItem(res.extraItem as ExtraItemData);
        }
      } else if (res.status === 401) {
        setAuthRequired(true);
      } else if (res.status === 503 || res.saved === false) {
        setErrorMessage(SAVE_FAILED_COPY);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === items.length;

  const nextUnansweredTapIndex = items.findIndex(
    (item) => answers[item.key] === undefined
  );
  const nextUnansweredTap =
    nextUnansweredTapIndex >= 0 ? items[nextUnansweredTapIndex] : null;

  const nextUnansweredPhq9Item =
    isPhq9Due && !skippedToday
      ? PHQ9_ITEMS.find((item) => phq9Answers[String(item.number)] === undefined)
      : null;

  const nextUnansweredGad7Item =
    isGad7Due && !skippedToday && !nextUnansweredPhq9Item
      ? GAD7_TEXT_EN.items.find((item) => gad7Answers[item.id] === undefined)
      : null;

  let activeItemLabel: string | null = null;
  let activeItemId: string | undefined = undefined;
  let activeItemChoices: readonly string[] | undefined = undefined;
  let activeMode: VoiceChoiceMode = "tap";

  if (nextUnansweredTap) {
    activeItemLabel = nextUnansweredTap.label;
    activeItemId = nextUnansweredTap.key;
    activeItemChoices = resolveChoiceLabels(nextUnansweredTap);
    activeMode = "tap";
  } else if (nextUnansweredPhq9Item) {
    activeItemLabel = `Question ${nextUnansweredPhq9Item.number}`;
    activeItemId = String(nextUnansweredPhq9Item.number);
    activeItemChoices = PHQ9_CHOICE_LABELS;
    activeMode = "phq9";
  } else if (nextUnansweredGad7Item) {
    activeItemLabel = `GAD-7 Question ${nextUnansweredGad7Item.id}`;
    activeItemId = nextUnansweredGad7Item.id;
    activeItemChoices = PHQ9_CHOICE_LABELS;
    activeMode = "gad7";
  }

  function handleCrisisHelp() {
    setShowCrisisPath(true);
    void submitCheckInCrisisAlert();
  }

  function handleApiFailure(res: { ok: boolean; status: number; saved?: boolean }) {
    if (res.status === 401) setAuthRequired(true);
    else if (res.status === 503 || res.saved === false) setErrorMessage(SAVE_FAILED_COPY);
  }

  function handleSelectFour(idx: number, key: string, choice: number) {
    if (isSubmitting) return;
    setSkippedToday(false);
    setErrorMessage(null);
    const next = { ...answers, [key]: choice };
    setAnswers(next);
    scrollNextPromptRow(rowRefs.current, idx);

    if ("moodScore" in next && "interestScore" in next) {
      setIsSubmitting(true);
      submitCheckInTaps({ mood: next.moodScore, interest: next.interestScore })
        .then((res) => (res.ok ? setIsPhq9Due(true) : handleApiFailure(res)))
        .finally(() => setIsSubmitting(false));
    }
  }

  function handleSkip() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    submitCheckInNotToday()
      .then((res) => {
        if (res.ok) {
          setSkippedToday(true);
          setIsPhq9Due(false);
          setIsGad7Due(false);
        } else {
          handleApiFailure(res);
        }
      })
      .finally(() => setIsSubmitting(false));
  }

  function handlePhq9Select(itemNumber: number, choice: number) {
    if (isSubmitting) return;
    if (itemNumber === 9 && choice > 0) handleCrisisHelp();
    setErrorMessage(null);
    setPhq9Answers((prev) => ({ ...prev, [String(itemNumber)]: choice }));
    setIsSubmitting(true);
    submitCheckInPhq9({ itemId: String(itemNumber), value: choice })
      .then((res) => {
        if (res.showCrisisPath) setShowCrisisPath(true);
        if (!res.ok) handleApiFailure(res);
      })
      .finally(() => setIsSubmitting(false));
  }

  function handleGad7Select(itemId: string, choice: number) {
    if (isSubmitting) return;
    setErrorMessage(null);
    setGad7Answers((prev) => ({ ...prev, [itemId]: choice }));
    setIsSubmitting(true);
    submitCheckInGad7({ itemId, value: choice })
      .then((res) => {
        if (!res.ok) handleApiFailure(res);
      })
      .finally(() => setIsSubmitting(false));
  }

  function handleVoiceOrTextScore(choice: number) {
    if (nextUnansweredTap && nextUnansweredTapIndex >= 0) {
      handleSelectFour(nextUnansweredTapIndex, nextUnansweredTap.key, choice);
    } else if (nextUnansweredPhq9Item) {
      handlePhq9Select(nextUnansweredPhq9Item.number, choice);
    } else if (nextUnansweredGad7Item) {
      handleGad7Select(nextUnansweredGad7Item.id, choice);
    }
  }

  return (
    <section
      aria-label="Twice-weekly check-in prompts"
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-10"
    >
      <CheckInHeader
        answeredCount={answeredCount}
        totalCount={items.length}
        isSubmitting={isSubmitting}
        skippedToday={skippedToday}
        onSkip={handleSkip}
      />

      <CheckInStatusBanners
        authRequired={authRequired}
        errorMessage={errorMessage}
        showCrisisPath={showCrisisPath}
        skippedToday={skippedToday}
        isComplete={isComplete}
        itemCount={items.length}
      />

      <CheckInVoiceInput
        activeItemLabel={activeItemLabel}
        activeItemId={activeItemId}
        activeItemChoices={activeItemChoices}
        disabled={isSubmitting}
        mode={activeMode}
        onSelectScore={handleVoiceOrTextScore}
        onNotToday={handleSkip}
        onCrisisHelp={handleCrisisHelp}
      />

      <div className="mt-7 divide-y divide-border-hairline">
        {items.map((item, idx) => (
          <PromptRow
            key={item.key}
            item={item}
            selected={answers[item.key]}
            skippedToday={skippedToday}
            disabled={isSubmitting}
            rowRef={(el) => {
              rowRefs.current[idx] = el;
            }}
            onSelect={(choice) => handleSelectFour(idx, item.key, choice)}
          />
        ))}
      </div>

      <ExtraQuestion extraItem={extraItem} disabled={isSubmitting || skippedToday} />

      {isPhq9Due && !skippedToday ? (
        <Phq9Section
          phq9Answers={phq9Answers}
          isSubmitting={isSubmitting}
          onSelect={handlePhq9Select}
        />
      ) : null}

      {isGad7Due && !skippedToday ? (
        <Gad7Section
          gad7Answers={gad7Answers}
          isSubmitting={isSubmitting}
          onSelect={handleGad7Select}
        />
      ) : null}
    </section>
  );
}
