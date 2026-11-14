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
      className="rounded-2xl border border-[#d6e4de] bg-white p-6 shadow-xs sm:p-8"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e4de] bg-[#eaf2ef] px-3 py-1 text-xs font-semibold text-[#1c4438]">
        Gentle option · ~10 minutes
      </span>

      <h2
        data-testid="patient-suggestion-title"
        className="font-display mt-4 text-2xl font-semibold tracking-tight text-[#1a2421]"
      >
        {actionTitle}
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-[#515d58]">
        {actionDetail}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="patient-suggestion-accept"
          onClick={() => setChoice("accepted")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer ${
            choice === "accepted"
              ? "bg-[#1c4438] text-white ring-2 ring-[#255748]/30"
              : "bg-[#255748] text-white hover:bg-[#1c4438]"
          }`}
        >
          I&apos;ll try this today
        </button>
        <button
          type="button"
          data-testid="patient-suggestion-skip"
          onClick={() => setChoice("skipped")}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer ${
            choice === "skipped"
              ? "border-[#255748] bg-[#eaf2ef] text-[#1c4438]"
              : "border-[#d6cfc4] bg-white text-[#515d58] hover:bg-[#faf8f5] hover:text-[#1a2421]"
          }`}
        >
          Not today
        </button>
      </div>

      {choice === "accepted" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 px-4 py-3 text-xs font-medium text-[#1c4438]"
        >
          Sounds good — take it at your own pace, even a few minutes outdoors
          counts.
        </p>
      ) : null}

      {choice === "skipped" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[#e4ddd2] bg-[#faf8f5] px-4 py-3 text-xs font-medium text-[#515d58]"
        >
          No problem at all. Nothing is tracked against you when you rest.
        </p>
      ) : null}
    </section>
  );
}
