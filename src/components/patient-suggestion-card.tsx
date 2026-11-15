"use client";

import { useState } from "react";
import type { SuggestionStatus } from "@/usecases/ports";
import { GuidedActivityWidget } from "./guided-activity-widget";

export interface PatientSuggestionView {
  readonly id: string;
  readonly actionKey?: string;
  readonly actionTitle: string;
  readonly actionDetail: string | null;
  readonly status: SuggestionStatus;
  readonly respondedAt?: string | null;
}

export type AnsweredStatus = "accepted" | "completed" | "skipped";

export function isAnsweredStatus(
  status: SuggestionStatus | undefined | null
): status is AnsweredStatus {
  return status !== undefined && status !== null && status !== "shown";
}

interface PatientSuggestionCardProps {
  suggestion: PatientSuggestionView | null;
  actionKey?: string;
}

export function PatientSuggestionCard({
  suggestion,
  actionKey,
}: PatientSuggestionCardProps) {
  const activeActionKey = actionKey ?? suggestion?.actionKey;
  const initialChoice: AnsweredStatus | null = isAnsweredStatus(suggestion?.status)
    ? suggestion.status
    : null;

  const [choice, setChoice] = useState<AnsweredStatus | null>(initialChoice);
  const [submitting, setSubmitting] = useState(false);

  if (!suggestion) {
    return (
      <section
        aria-label="Today's low-effort step"
        data-testid="patient-suggestion-card"
        className="rounded-2xl border border-accent-sage-border bg-surface-card p-7 sm:p-10"
      >
        <h2
          data-testid="patient-suggestion-empty"
          className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl"
        >
          No suggestion for you today.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-secondary">
          Take it at your own pace and rest. Skipping or having no suggestion is completely fine, and nothing is counted against you.
        </p>
      </section>
    );
  }

  async function handleChoice(selectedChoice: "accepted" | "skipped") {
    if (choice !== null || submitting || !suggestion) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/patient/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          choice: selectedChoice,
        }),
      });

      if (res.ok) {
        setChoice(selectedChoice);
      } else if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        const stored = isAnsweredStatus(data?.status as SuggestionStatus)
          ? (data!.status as AnsweredStatus)
          : isAnsweredStatus(suggestion.status)
            ? suggestion.status
            : selectedChoice;
        setChoice(stored);
      }
    } catch {
      // In case of network failure, do not falsely confirm
    } finally {
      setSubmitting(false);
    }
  }

  const isAnswered = choice !== null;

  return (
    <section
      aria-label="Today's low-effort step"
      data-testid="patient-suggestion-card"
      className="rounded-2xl border border-accent-sage-border bg-surface-card p-7 sm:p-10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          data-testid="patient-suggestion-title"
          className="font-display text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl"
        >
          {suggestion.actionTitle}
        </h2>
        <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-3.5 py-1 text-xs font-medium text-accent-sage-hover">
          Gentle option · ~10 min
        </span>
      </div>

      {suggestion.actionDetail ? (
        <p className="mt-3.5 text-base leading-relaxed text-ink-secondary">
          {suggestion.actionDetail}
        </p>
      ) : null}

      {!isAnswered ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="patient-suggestion-accept"
            disabled={submitting}
            onClick={() => handleChoice("accepted")}
            className="min-h-12 rounded-xl bg-accent-sage px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:cursor-default"
          >
            I&apos;ll try this today
          </button>
          <button
            type="button"
            data-testid="patient-suggestion-skip"
            disabled={submitting}
            onClick={() => handleChoice("skipped")}
            className="min-h-12 rounded-xl border border-border-tactile bg-surface-subtle px-6 py-3 text-sm font-medium text-ink-secondary transition hover:bg-surface-muted hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:cursor-default"
          >
            Not today
          </button>
        </div>
      ) : null}

      {choice === "accepted" || choice === "completed" ? (
        <div className="mt-6 space-y-4">
          <div
            role="status"
            data-testid="patient-suggestion-accepted-status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3.5 text-sm font-medium text-accent-sage-hover"
          >
            <span>
              {choice === "completed"
                ? "You completed this step today. Take it at your own pace."
                : "You\u2019ve chosen to try this today. Take it at your own pace. Even stepping outside for a couple of minutes is enough."}
            </span>
          </div>
          <GuidedActivityWidget actionKey={activeActionKey} />
        </div>
      ) : null}

      {choice === "skipped" ? (
        <div
          role="status"
          data-testid="patient-suggestion-skipped-status"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary"
        >
          <span>
            You&apos;ve chosen not today. Rest up, and nothing is counted against you.
          </span>
        </div>
      ) : null}
    </section>
  );
}
