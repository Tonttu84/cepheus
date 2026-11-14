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
      className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-muted pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-0.5 text-xs font-semibold text-amber-950">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-700"
            />
            Open follow-up flag · Since{" "}
            <span className="tabular-nums">{sinceDate}</span>
          </span>
          <h2 className="font-display mt-2.5 text-xl font-semibold text-ink-primary">
            {participantLabel}{" "}
            <span className="font-mono text-sm font-normal text-ink-muted">
              ({participantExternalId})
            </span>
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            TMS course completed:{" "}
            <span className="tabular-nums font-medium text-ink-primary">
              {tmsCompletedDate}
            </span>{" "}
            · Current follow-up point:{" "}
            <span className="font-medium text-ink-primary">Day 56 (Week 8)</span>
          </p>
        </div>
        <SimulatedBadge subtitle="Broad-area summary only" />
      </div>

      {/* Broad Life Areas */}
      <div className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Broad areas shifted since{" "}
          <span className="tabular-nums">{sinceDate}</span>
        </h3>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {broadAreas.map((area: BroadAreaKey) => (
            <span
              key={area}
              data-testid={`clinic-broad-area-${area}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border-hairline bg-surface-subtle px-3.5 py-2 text-sm font-medium text-ink-primary"
            >
              <span>{BROAD_AREA_LABELS[area] ?? area}</span>
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
          className="min-h-11 rounded-xl bg-accent-sage px-4.5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
        >
          Request nurse call
        </button>
        <button
          type="button"
          data-testid="clinic-action-booster"
          onClick={() => setActionTaken("booster")}
          className="min-h-11 rounded-xl border border-border-tactile bg-surface-card px-4.5 py-2.5 text-sm font-semibold text-ink-primary transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
        >
          Offer 5-session booster cluster
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        A nurse phone call is the primary step to talk through what has shifted;
        a 5-session booster cluster is offered when clinician review confirms
        early relapse risk.
      </p>

      {actionTaken === "nurse_call" ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3 text-xs font-medium text-accent-sage-hover"
        >
          <span>
            Nurse outreach call queued for {participantLabel} (simulated clinic
            action).
          </span>
          <button
            type="button"
            onClick={() => setActionTaken(null)}
            className="min-h-9 rounded-lg border border-accent-sage-border bg-surface-card px-3 text-xs font-semibold text-accent-sage-hover transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            Undo
          </button>
        </div>
      ) : null}

      {actionTaken === "booster" ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3 text-xs font-medium text-accent-sage-hover"
        >
          <span>
            5-session TMS booster cluster offer prepared for clinician review
            (simulated clinic action).
          </span>
          <button
            type="button"
            onClick={() => setActionTaken(null)}
            className="min-h-9 rounded-lg border border-accent-sage-border bg-surface-card px-3 text-xs font-semibold text-accent-sage-hover transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer"
          >
            Undo
          </button>
        </div>
      ) : null}
    </section>
  );
}
