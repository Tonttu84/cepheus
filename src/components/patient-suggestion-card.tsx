"use client";

import { useState } from "react";

interface PatientSuggestionCardProps {
  actionTitle: string;
  actionDetail: string;
}

export function PatientSuggestionCard({
  actionTitle,
  actionDetail,
}: PatientSuggestionCardProps) {
  const [choice, setChoice] = useState<"accepted" | "skipped" | null>(null);

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
          {actionTitle}
        </h2>
        <span className="tabular-nums rounded-full border border-accent-sage-border bg-accent-sage-soft px-3.5 py-1 text-xs font-medium text-accent-sage-hover">
          Gentle option · ~10 min
        </span>
      </div>

      <p className="mt-3.5 text-base leading-relaxed text-ink-secondary">
        {actionDetail}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="patient-suggestion-accept"
          onClick={() => setChoice("accepted")}
          className={`min-h-12 rounded-xl px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
            choice === "accepted"
              ? "bg-accent-sage-hover text-white ring-2 ring-accent-sage/30"
              : "bg-accent-sage text-white hover:bg-accent-sage-hover"
          }`}
        >
          I&apos;ll try this today
        </button>
        <button
          type="button"
          data-testid="patient-suggestion-skip"
          onClick={() => setChoice("skipped")}
          className={`min-h-12 rounded-xl border px-6 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer ${
            choice === "skipped"
              ? "border-accent-sage bg-accent-sage-soft text-accent-sage-hover"
              : "border-border-tactile bg-surface-subtle text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
          }`}
        >
          Not today
        </button>
      </div>

      {choice === "accepted" ? (
        <div
          role="status"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3.5 text-sm font-medium text-accent-sage-hover"
        >
          <span>
            This is a preview of a simulated round and nothing is sent yet. Take
            it at your own pace. Even stepping outside for a couple of minutes
            is enough.
          </span>
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="inline-flex min-h-11 items-center px-3 text-xs font-semibold underline underline-offset-2 hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            Change response
          </button>
        </div>
      ) : null}

      {choice === "skipped" ? (
        <div
          role="status"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-hairline bg-surface-subtle px-4 py-3.5 text-sm font-medium text-ink-secondary"
        >
          <span>
            This is a preview of a simulated round and nothing is sent yet. Rest
            up, and nothing is counted against you.
          </span>
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="inline-flex min-h-11 items-center px-3 text-xs font-semibold underline underline-offset-2 hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            Change response
          </button>
        </div>
      ) : null}
    </section>
  );
}
