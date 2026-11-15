"use client";

import { useEffect, useState } from "react";
import { BROAD_AREA_LABELS, type BroadAreaKey } from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";
import type { ClinicFlagFacts } from "@/server/api/clinic-flags";

export interface RequestedCallInfo {
  readonly requestedBy: string;
  readonly requestedAt: string;
}

export interface ClinicFlagCardProps {
  participantLabel: string;
  participantExternalId: string;
  tmsCompletedDate: string;
  sinceDate: string;
  broadAreas: BroadAreaKey[];
  ringActiveDuringSilence?: boolean;
  warningKind?: string;
  facts?: ClinicFlagFacts;
  supportingLines?: readonly string[];
  initialRequestedCall?: RequestedCallInfo | null;
  onCallRequested?: (info: RequestedCallInfo) => void;
}

function formatCallTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Helsinki",
    });
  } catch {
    return isoString;
  }
}

function FlagFactsSection({
  sinceDate,
  broadAreas,
  warningKind,
  facts,
  supportingLines,
}: {
  sinceDate: string;
  broadAreas: BroadAreaKey[];
  warningKind?: string;
  facts?: ClinicFlagFacts;
  supportingLines?: readonly string[];
}) {
  const kind = facts?.warningKind ?? warningKind;
  const factLines: string[] = [];
  let showSilenceSentence = false;

  if (kind === "phq9") {
    if (facts?.latestTotal !== undefined) {
      factLines.push(`PHQ-9 total: ${facts.latestTotal}`);
    }
    if (facts?.isFirstMeasurement) {
      factLines.push("First measurement");
    } else if (facts?.change !== undefined && facts?.change !== null) {
      const sign = facts.change > 0 ? "+" : "";
      factLines.push(`Change from previous total: ${sign}${facts.change}`);
    }
  } else if (kind === "gad7") {
    if (facts?.latestTotal !== undefined) {
      factLines.push(`GAD-7 total: ${facts.latestTotal}`);
    }
    if (facts?.isFirstMeasurement) {
      factLines.push("First measurement");
    } else if (facts?.change !== undefined && facts?.change !== null) {
      const sign = facts.change > 0 ? "+" : "";
      factLines.push(`Change from previous total: ${sign}${facts.change}`);
    }
  } else if (kind === "low_answers" || kind === "sustained_dip") {
    if (facts?.roundsUnderBaseline !== undefined) {
      const plural = facts.roundsUnderBaseline === 1 ? "round" : "rounds";
      factLines.push(`${facts.roundsUnderBaseline} ${plural} under personal baseline`);
    }
  } else if (kind === "silence") {
    if (facts?.missedRoundsCount !== undefined) {
      const plural = facts.missedRoundsCount === 1 ? "round" : "rounds";
      const since = facts.missedSince ?? sinceDate;
      factLines.push(`${facts.missedRoundsCount} ${plural} missed since ${since}`);
    }
    showSilenceSentence = true;
  } else if (kind === "mixed") {
    if (facts?.roundsUnderBaseline !== undefined) {
      const plural = facts.roundsUnderBaseline === 1 ? "round" : "rounds";
      factLines.push(`${facts.roundsUnderBaseline} ${plural} under personal baseline`);
    }
    if (facts?.missedRoundsCount !== undefined) {
      const plural = facts.missedRoundsCount === 1 ? "round" : "rounds";
      const since = facts.missedSince ?? sinceDate;
      factLines.push(`${facts.missedRoundsCount} ${plural} missed since ${since}`);
    }
    showSilenceSentence = true;
  }

  if (facts?.hasOpenCrisisEvent) {
    factLines.push("Open crisis event recorded for this patient");
  }

  const monitoring = facts?.supportingLines ?? supportingLines ?? [];
  const hasFactsBox = factLines.length > 0 || monitoring.length > 0 || showSilenceSentence;

  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="text-sm font-medium text-ink-secondary">
          Broad areas shifted since{" "}
          <span className="tabular-nums font-semibold text-ink-primary">
            {sinceDate}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {broadAreas.map((area: BroadAreaKey) => (
            <span
              key={area}
              data-testid={`clinic-broad-area-${area}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border-hairline bg-surface-subtle px-4 py-2 text-sm font-medium text-ink-primary"
            >
              <span>{BROAD_AREA_LABELS[area] ?? area}</span>
            </span>
          ))}
        </div>
      </div>

      {hasFactsBox ? (
        <div
          data-testid="clinic-flag-facts"
          className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-amber-950">
              Reason to call
            </p>
            {kind ? (
              <span
                data-testid="clinic-flag-kind"
                className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
              >
                {kind}
              </span>
            ) : null}
          </div>

          {factLines.length > 0 ? (
            <ul className="mt-2.5 space-y-1 text-sm text-amber-900">
              {factLines.map((line, idx) => (
                <li
                  key={idx}
                  data-testid="clinic-flag-fact-line"
                  className="flex items-center gap-2"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {monitoring.length > 0 ? (
            <div className="mt-3 border-t border-amber-200/60 pt-2.5">
              <p className="text-xs font-semibold text-amber-950">
                Supporting home-monitoring facts:
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-800">
                {monitoring.map((line, idx) => (
                  <li
                    key={idx}
                    data-testid="clinic-flag-supporting-line"
                    className="flex items-center gap-2"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showSilenceSentence ? (
            <p
              data-testid="clinic-flag-silence-note"
              className="mt-3 border-t border-amber-200/60 pt-2.5 text-xs leading-relaxed text-amber-900"
            >
              Unanswered rounds are treated as a reason to check in by phone,
              never scored as zero.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ClinicFlagCard({
  participantLabel,
  participantExternalId,
  tmsCompletedDate,
  sinceDate,
  broadAreas,
  ringActiveDuringSilence: _ringActiveDuringSilence,
  warningKind,
  facts,
  supportingLines,
  initialRequestedCall,
  onCallRequested,
}: ClinicFlagCardProps) {
  const [callInfo, setCallInfo] = useState<RequestedCallInfo | null>(
    initialRequestedCall ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (initialRequestedCall) {
      setCallInfo(initialRequestedCall);
    }
  }, [initialRequestedCall]);

  async function handleRequestCall() {
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/clinic/nurse-calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          patientId: participantExternalId,
          status: "requested",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorText(data?.error ?? "Could not request nurse call.");
        return;
      }

      const data = await res.json();
      const info: RequestedCallInfo = {
        requestedBy: data.requestedBy ?? "Staff",
        requestedAt: data.requestedAt ?? new Date().toISOString(),
      };
      setCallInfo(info);
      onCallRequested?.(info);
    } catch {
      setErrorText("Network error requesting nurse call.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Broad-area clinic flag"
      data-testid="clinic-flag-card"
      className="rounded-2xl border border-border-hairline bg-surface-card p-7 sm:p-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-hairline pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-ink-primary">
              {participantLabel}{" "}
              <span className="font-mono text-sm font-normal text-ink-muted">
                ({participantExternalId})
              </span>
            </h2>
            <SimulatedBadge subtitle="Simulated flag" />
          </div>
          <p className="mt-1.5 text-sm text-ink-secondary">
            TMS course completed:{" "}
            <span className="tabular-nums font-medium text-ink-primary">
              {tmsCompletedDate}
            </span>{" "}
            <span className="text-xs text-ink-muted">
              (in sustained remission at discharge)
            </span>
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-950">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-amber-700"
          />
          Open follow-up flag · Since{" "}
          <span className="tabular-nums">{sinceDate}</span>
        </span>
      </div>

      <FlagFactsSection
        sinceDate={sinceDate}
        broadAreas={broadAreas}
        warningKind={warningKind}
        facts={facts}
        supportingLines={supportingLines}
      />

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border-hairline pt-6">
        <button
          type="button"
          data-testid="clinic-action-nurse-call"
          disabled={isSubmitting || callInfo !== null}
          onClick={handleRequestCall}
          className="min-h-12 rounded-xl bg-accent-sage px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-sage-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting
            ? "Requesting call..."
            : callInfo
              ? "Nurse call requested"
              : "Request nurse call"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        A nurse phone call is the primary step to talk through what has shifted.
      </p>

      {errorText ? (
        <p className="mt-3 text-xs font-medium text-rose-900" role="alert">
          {errorText}
        </p>
      ) : null}

      {callInfo ? (
        <div
          role="status"
          data-testid="nurse-call-status"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3.5 text-sm font-medium text-accent-sage-hover"
        >
          <span>
            Nurse call requested by {callInfo.requestedBy} at{" "}
            <span className="tabular-nums">{formatCallTime(callInfo.requestedAt)}</span>.
          </span>
          <span className="rounded-full bg-surface-card px-2.5 py-0.5 text-xs font-semibold text-accent-sage">
            Call queued
          </span>
        </div>
      ) : null}
    </section>
  );
}
