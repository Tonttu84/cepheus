"use client";

import { useState } from "react";
import type { ConsentState, MeasuringMethod } from "@/domain/consent";

interface PatientConsentSectionProps {
  initialConsent: ConsentState;
}

interface MethodInfo {
  key: MeasuringMethod;
  aliasKey: string;
  title: string;
  detail: string;
}

const METHODS: readonly MethodInfo[] = [
  {
    key: "ring",
    aliasKey: "ring_rhythm",
    title: "Smart ring sleep & daytime rhythm",
    detail:
      "Measures daily sleep timing, sleep regularity, and daytime rhythm to detect early changes. Raw readings remain private on your device.",
  },
  {
    key: "camera",
    aliasKey: "camera_expressivity",
    title: "On-device camera check-in",
    detail:
      "Measures facial expressivity in your browser during twice-weekly check-ins. Video frames never leave your device.",
  },
];

export function PatientConsentSection({ initialConsent }: PatientConsentSectionProps) {
  const [methods, setMethods] = useState<Record<MeasuringMethod, boolean>>({
    ring: initialConsent.methods.ring,
    camera: initialConsent.methods.camera,
  });
  const [facialMovementRange, setFacialMovementRange] = useState<boolean>(
    Boolean(initialConsent.facial_movement_usual_range)
  );
  const [busyMethod, setBusyMethod] = useState<string | null>(null);

  async function handleToggle(methodKey: MeasuringMethod) {
    if (busyMethod) return;
    const nextState = !methods[methodKey];
    setBusyMethod(methodKey);

    try {
      const res = await fetch("/api/patient/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: methodKey,
          enabled: nextState,
        }),
      });

      if (res.ok) {
        setMethods((prev) => ({
          ...prev,
          [methodKey]: nextState,
        }));
      }
    } catch {
      // In case of error, do not toggle locally
    } finally {
      setBusyMethod(null);
    }
  }

  async function handleToggleFacialMovementRange() {
    if (busyMethod) return;
    const nextState = !facialMovementRange;
    setBusyMethod("facial_movement_usual_range");

    try {
      const res = await fetch("/api/patient/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "facial_movement_usual_range",
          enabled: nextState,
        }),
      });

      if (res.ok) {
        setFacialMovementRange(nextState);
      }
    } catch {
      // In case of error, do not toggle locally
    } finally {
      setBusyMethod(null);
    }
  }

  return (
    <section
      aria-label="Measuring method consent switches"
      data-testid="patient-consent-section"
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
          Measuring methods & privacy
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          You are always in control of which methods are active. Pausing a method stops measurement immediately, and a method that is off stays off until you choose to switch it on.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {METHODS.map((m) => {
          const isEnabled = methods[m.key];
          const isBusy = busyMethod === m.key;

          return (
            <div
              key={m.key}
              data-testid={`consent-card-${m.key}`}
              className="flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-7"
            >
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-ink-primary">
                    {m.title}
                  </h3>
                  <span
                    data-testid={`consent-status-${m.key}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isEnabled
                        ? "border border-accent-sage-border bg-accent-sage-soft text-accent-sage-hover"
                        : "border border-border-tactile bg-surface-subtle text-ink-secondary"
                    }`}
                  >
                    {isEnabled ? "Active" : "Paused"}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {m.detail}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid={`toggle-consent-${m.key}`}
                  disabled={isBusy}
                  onClick={() => handleToggle(m.key)}
                  className="min-h-11 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:opacity-50"
                >
                  {isEnabled ? "Pause this method" : "Enable this method"}
                </button>
              </div>
            </div>
          );
        })}

        <div
          data-testid="consent-card-facial-movement-usual-range"
          className="flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-6 sm:p-7 sm:col-span-2"
        >
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-ink-primary">
                Facial movement comparison against usual range
              </h3>
              <span
                data-testid="consent-status-facial-movement-usual-range"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  facialMovementRange
                    ? "border border-accent-sage-border bg-accent-sage-soft text-accent-sage-hover"
                    : "border border-border-tactile bg-surface-subtle text-ink-secondary"
                }`}
              >
                {facialMovementRange ? "Active" : "Paused"}
              </span>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Let my clinic see how my facial movement in the camera check compares with my own usual range (optional, research potential).
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="toggle-consent-facial-movement-usual-range"
              disabled={busyMethod === "facial_movement_usual_range"}
              onClick={handleToggleFacialMovementRange}
              className="min-h-11 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sage cursor-pointer disabled:opacity-50"
            >
              {facialMovementRange ? "Withdraw permission" : "Grant permission"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
