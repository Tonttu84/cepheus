"use client";

import { useEffect, useState } from "react";
import { SimulatedBadge } from "@/components/simulated-badge";

export interface CrisisAlertItem {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly occurredAt: string;
}

function formatOccurredAt(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Helsinki",
    });
  } catch {
    return dateString;
  }
}

export function ClinicCrisisAlerts() {
  const [alerts, setAlerts] = useState<CrisisAlertItem[] | null>(null);
  const [acknowledgingKey, setAcknowledgingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/clinic/crisis-events", {
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (!mounted) return;
        if (res.status === 401 || res.status === 403) {
          // Auth boundary handled at page level
          return;
        }
        if (!res.ok) {
          setErrorText("Could not check crisis alerts.");
          return;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.crisisEvents)) {
          setAlerts(data.crisisEvents);
        } else {
          setAlerts([]);
        }
      })
      .catch(() => {
        if (mounted) setErrorText("Network error checking crisis alerts.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleAcknowledge(patientId: string, roundNumber: number) {
    const key = `${patientId}-${roundNumber}`;
    setAcknowledgingKey(key);
    setErrorText(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/clinic/crisis-events/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ patientId, roundNumber }),
      });

      // 200 (acknowledged) or 409 (already acknowledged by staff) -> remove from list safely
      if (res.ok || res.status === 409) {
        setAlerts((prev) =>
          prev ? prev.filter((a) => !(a.patientId === patientId && a.roundNumber === roundNumber)) : []
        );
        setFeedback(`Crisis alert for Participant ${patientId} acknowledged.`);
      } else {
        const data = await res.json().catch(() => null);
        setErrorText(data?.error ?? "Unable to acknowledge crisis alert.");
      }
    } catch {
      setErrorText("Network error acknowledging crisis alert.");
    } finally {
      setAcknowledgingKey(null);
    }
  }

  if (!alerts || alerts.length === 0) {
    if (feedback) {
      return (
        <div
          role="status"
          data-testid="crisis-alerts-feedback"
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-950"
        >
          {feedback}
        </div>
      );
    }
    return null;
  }

  return (
    <section
      aria-label="Urgent crisis alerts"
      data-testid="clinic-crisis-alerts"
      className="space-y-4 rounded-2xl border-2 border-rose-400 bg-rose-50/80 p-6 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight text-rose-950 sm:text-xl">
            Urgent Crisis Alerts ({alerts.length})
          </h2>
        </div>
        <SimulatedBadge subtitle="Simulated data" />
      </div>

      <p className="text-xs leading-relaxed text-rose-900">
        Patients below recorded a self-harm or crisis response during check-in.
        Please reach out immediately. Crisis help resources remain visible to the
        patient at all times (Emergency 112 · Crisis line 09 2525 0111).
      </p>

      {errorText ? (
        <p className="text-xs font-medium text-rose-900" role="alert">
          {errorText}
        </p>
      ) : null}

      {feedback ? (
        <p className="text-xs font-medium text-emerald-900" role="status">
          {feedback}
        </p>
      ) : null}

      <div className="space-y-3 pt-1">
        {alerts.map((alert) => {
          const key = `${alert.patientId}-${alert.roundNumber}`;
          const isBusy = acknowledgingKey === key;

          return (
            <article
              key={key}
              data-testid="crisis-alert-item"
              className="flex flex-col justify-between gap-4 rounded-xl border border-rose-300 bg-white p-4 shadow-2xs sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-950 text-sm">
                    Participant {alert.patientId}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                    Round {alert.roundNumber}
                  </span>
                </div>
                <p className="text-xs text-stone-600">
                  Recorded crisis response at{" "}
                  <span className="font-medium text-stone-900 tabular-nums">
                    {formatOccurredAt(alert.occurredAt)}
                  </span>
                </p>
              </div>

              <button
                type="button"
                data-testid="acknowledge-crisis-btn"
                data-testid-specific={`acknowledge-crisis-btn-${key}`}
                disabled={isBusy}
                onClick={() => handleAcknowledge(alert.patientId, alert.roundNumber)}
                className="min-h-11 inline-flex items-center justify-center rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50 cursor-pointer"
              >
                {isBusy ? "Acknowledging..." : "Acknowledge alert"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
