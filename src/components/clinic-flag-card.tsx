"use client";

import React, { useEffect, useState } from "react";
import { BROAD_AREA_LABELS, type BroadAreaKey } from "@/lib/constants";
import { SimulatedBadge } from "@/components/simulated-badge";
import type { ClinicFlagFacts } from "@/server/api/clinic-flags";
import type { ExpressivityRangeResult } from "@/domain/camera";

export interface RequestedCallInfo {
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly status?: string;
  readonly outcomeTier?: string | null;
  readonly actionTaken?: string | null;
}

const OUTCOME_TIER_LABELS: Record<string, string> = {
  rough_patch: "Rough patch",
  sustained_decline: "Sustained decline",
  full_relapse: "Full relapse",
  crisis: "Crisis",
  false_alarm: "False alarm",
};

const ACTION_TAKEN_LABELS: Record<string, string> = {
  advice_and_medication_check: "Advice & medication check",
  booster_tms_cluster: "Booster TMS cluster",
  new_tms_course_referral: "New TMS course referral",
  urgent_care: "Urgent care",
  none: "None",
};

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
  expressivityShowcase?: ExpressivityRangeResult | null;
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

function ExpressivityShowcasePanel({
  showcase,
  isSamplePatient,
}: {
  showcase: ExpressivityRangeResult;
  isSamplePatient: boolean;
}) {
  let factText = "";
  if (showcase.status === "insufficient_history") {
    factText = `Not enough camera checks yet (${showcase.count} of 5).`;
  } else {
    const positionWord =
      showcase.position === "within_usual_range"
        ? "inside"
        : showcase.position === "below_usual_range"
          ? "below"
          : "above";
    factText = `Latest camera check: ${positionWord} this person's usual range (${showcase.sampleCount} readings).`;
  }

  return (
    <div
      data-testid="clinic-expressivity-showcase-panel"
      className="mt-6 rounded-2xl border border-accent-sage-border bg-surface-card p-5 sm:p-6 space-y-3.5"
    >
      <h3 className="font-display text-base font-semibold text-ink-primary">
        Facial movement, against this person&apos;s own usual range (optional module, research potential)
      </h3>

      <p className="text-sm font-medium text-ink-primary">
        {factText}
      </p>

      {isSamplePatient ? (
        <div>
          <SimulatedBadge subtitle="" />
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-secondary">
        Review of 12 studies (389 people) found response goes with more expressivity (source: Facial expression and treatment response, systematic review (Karger supplementary record)).
      </p>

      <p className="text-xs leading-relaxed text-ink-muted">
        This is not a reading of mood and not a judgement. No study shows that it warns of relapse. The clinician decides.
      </p>

      <p className="text-xs leading-relaxed text-ink-muted">
        Whether this is worth it is doubtful: it needs a camera in the home, and it adds privacy and data-security cost for an uncertain benefit. It is off by default.
      </p>
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
  expressivityShowcase,
}: ClinicFlagCardProps) {
  const [callInfo, setCallInfo] = useState<RequestedCallInfo | null>(
    initialRequestedCall ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [outcomeTier, setOutcomeTier] = useState<string>("");
  const [actionTaken, setActionTaken] = useState<string>("");
  const [fetchedShowcase, setFetchedShowcase] = useState<
    ExpressivityRangeResult | null | undefined
  >(undefined);

  useEffect(() => {
    if (
      expressivityShowcase !== undefined ||
      facts?.expressivityShowcase !== undefined
    ) {
      return;
    }
    let cancelled = false;
    fetch(
      `/api/clinic/expressivity-showcase?patientId=${encodeURIComponent(
        participantExternalId
      )}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok) {
          setFetchedShowcase(data.showcase ?? null);
        } else if (!cancelled) {
          setFetchedShowcase(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedShowcase(null);
      });
    return () => {
      cancelled = true;
    };
  }, [participantExternalId, expressivityShowcase, facts?.expressivityShowcase]);

  const activeShowcase =
    expressivityShowcase !== undefined
      ? expressivityShowcase
      : facts?.expressivityShowcase !== undefined
        ? facts.expressivityShowcase
        : fetchedShowcase;

  const isSamplePatient =
    participantExternalId.startsWith("P-SIM") ||
    participantLabel.toLowerCase().includes("sample") ||
    participantLabel.toLowerCase().includes("simulated");

  useEffect(() => {
    if (initialRequestedCall) {
      setCallInfo(initialRequestedCall);
    }
  }, [initialRequestedCall]);

  async function handleRecordOutcome(e: React.FormEvent) {
    e.preventDefault();
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
          status: "completed",
          outcomeTier: outcomeTier || null,
          actionTaken: actionTaken || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorText(data?.error ?? "Could not record outcome.");
        return;
      }

      const data = await res.json();
      const info: RequestedCallInfo = {
        requestedBy: data.requestedBy ?? callInfo?.requestedBy ?? "Staff",
        requestedAt: data.requestedAt ?? callInfo?.requestedAt ?? new Date().toISOString(),
        status: "completed",
        outcomeTier: outcomeTier || null,
        actionTaken: actionTaken || null,
      };
      setCallInfo(info);
      onCallRequested?.(info);
    } catch {
      setErrorText("Network error recording outcome.");
    } finally {
      setIsSubmitting(false);
    }
  }

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

      {activeShowcase ? (
        <ExpressivityShowcasePanel
          showcase={activeShowcase}
          isSamplePatient={isSamplePatient}
        />
      ) : null}

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
        <div className="mt-5 space-y-4">
          <div
            role="status"
            data-testid="nurse-call-status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-sage-border bg-accent-sage-soft/70 px-4 py-3.5 text-sm font-medium text-accent-sage-hover"
          >
            <span>
              Nurse call {callInfo.status === "completed" ? "completed" : "requested"} by {callInfo.requestedBy} at{" "}
              <span className="tabular-nums">{formatCallTime(callInfo.requestedAt)}</span>.
            </span>
            <span className="rounded-full bg-surface-card px-2.5 py-0.5 text-xs font-semibold text-accent-sage">
              {callInfo.status === "completed" ? "Call completed" : "Call queued"}
            </span>
          </div>

          {callInfo.status !== "completed" ? (
            <form onSubmit={handleRecordOutcome} className="rounded-xl border border-border-hairline bg-surface-subtle p-5">
              <h3 className="text-sm font-semibold text-ink-primary mb-3">Record call outcome</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Clinical tier</label>
                  <select
                    value={outcomeTier}
                    onChange={(e) => setOutcomeTier(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border-tactile bg-white px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent-sage"
                  >
                    <option value="" disabled>Select tier...</option>
                    {Object.entries(OUTCOME_TIER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Action taken</label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border-tactile bg-white px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent-sage"
                  >
                    <option value="" disabled>Select action...</option>
                    {Object.entries(ACTION_TAKEN_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-10 rounded-lg bg-accent-sage px-4 text-sm font-semibold text-white transition hover:bg-accent-sage-hover disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save outcome"}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-border-hairline bg-surface-subtle p-4 text-sm text-ink-primary">
              <p><strong>Clinical tier:</strong> {OUTCOME_TIER_LABELS[callInfo.outcomeTier ?? ""] ?? "Unknown"}</p>
              <p><strong>Action taken:</strong> {ACTION_TAKEN_LABELS[callInfo.actionTaken ?? ""] ?? "Unknown"}</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
