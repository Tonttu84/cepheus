"use client";

import { useState } from "react";
import { BROAD_AREA_LABELS, type BroadAreaKey } from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";

interface ClinicFlagCardProps {
  participantLabel: string;
  participantExternalId: string;
  tmsCompletedDate: string;
  sinceDate: string;
  broadAreas: BroadAreaKey[];
  ringActiveDuringSilence: boolean;
}

export function ClinicFlagCard({
  participantLabel,
  participantExternalId,
  tmsCompletedDate,
  sinceDate,
  broadAreas,
  ringActiveDuringSilence,
}: ClinicFlagCardProps) {
  const [actionTaken, setActionTaken] = useState<
    "nurse_call" | "booster" | null
  >(null);

  return (
    <section
      aria-label="Broad-area clinic flag"
      data-testid="clinic-flag-card"
      className="rounded-2xl border border-[#e4ddd2] bg-white p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1ece4] pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-0.5 text-xs font-semibold text-amber-950">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-700"
            />
            Open follow-up flag · Since{" "}
            <span className="tabular-nums">{sinceDate}</span>
          </span>
          <h2 className="font-display mt-2.5 text-xl font-semibold text-[#1a2421]">
            {participantLabel}{" "}
            <span className="font-mono text-sm font-normal text-[#697570]">
              ({participantExternalId})
            </span>
          </h2>
          <p className="mt-1 text-xs text-[#515d58]">
            TMS course completed:{" "}
            <span className="tabular-nums font-medium text-[#1a2421]">
              {tmsCompletedDate}
            </span>{" "}
            · Current follow-up point:{" "}
            <span className="font-medium text-[#1a2421]">Day 56 (Week 8)</span>
          </p>
        </div>
        <SimulatedBadge subtitle="Broad-area summary only" />
      </div>

      {/* Broad Life Areas */}
      <div className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#697570]">
          Broad areas shifted since{" "}
          <span className="tabular-nums">{sinceDate}</span>
        </h3>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {broadAreas.map((area: BroadAreaKey) => (
            <span
              key={area}
              data-testid={`clinic-broad-area-${area}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e4ddd2] bg-[#faf8f5] px-3.5 py-2 text-sm font-medium text-[#1a2421]"
            >
              <span>{BROAD_AREA_LABELS[area] ?? area}</span>
              <span className="rounded-md bg-[#eae4da] px-1.5 py-0.5 font-mono text-[11px] text-[#515d58]">
                {area}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Silence + Ring Active Signal */}
      <div className="mt-5 rounded-xl border border-amber-200/90 bg-amber-50/70 p-4.5">
        <p className="text-sm font-semibold text-amber-950">
          Check-in silence with active wearable contact
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90">
          Two consecutive lowered twice-weekly check-ins were followed by
          unanswered rounds in Week 8 while the smart ring remained actively
          worn (
          {ringActiveDuringSilence
            ? "ring active during missed rounds"
            : "ring inactive"}
          ). Missed check-ins are treated as an outreach signal, never scored as
          zero.
        </p>
      </div>

      {/* Clinician / Nurse Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="clinic-action-nurse-call"
          onClick={() => setActionTaken("nurse_call")}
          className="rounded-xl bg-[#255748] px-4.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c4438] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer"
        >
          Request nurse call
        </button>
        <button
          type="button"
          data-testid="clinic-action-booster"
          onClick={() => setActionTaken("booster")}
          className="rounded-xl border border-[#d6cfc4] bg-white px-4.5 py-2.5 text-sm font-semibold text-[#1a2421] transition hover:bg-[#faf8f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#255748] cursor-pointer"
        >
          Offer 5-session booster cluster
        </button>
      </div>

      {actionTaken === "nurse_call" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 px-4 py-3 text-xs font-medium text-[#1c4438]"
        >
          Nurse outreach call queued for {participantLabel} (simulated clinic
          action).
        </p>
      ) : null}

      {actionTaken === "booster" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[#d6e4de] bg-[#eaf2ef]/70 px-4 py-3 text-xs font-medium text-[#1c4438]"
        >
          5-session TMS booster cluster offer prepared for clinician review
          (simulated clinic action).
        </p>
      ) : null}
    </section>
  );
}
