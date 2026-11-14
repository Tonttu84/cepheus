"use client";

import { useState } from "react";

interface TailoredStepState {
  provider: string;
  model: string | null;
  fallbackUsed: boolean;
  result: {
    actionKey: string;
    actionTitle: string;
    message: string;
  };
}

export function PatientStepPersonalizer({
  participantCode,
  dayIndex,
}: {
  participantCode: string;
  dayIndex: number;
}) {
  const [busy, setBusy] = useState(false);
  const [tailored, setTailored] = useState<TailoredStepState | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleTailorStep() {
    setBusy(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/ai/patient-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCode,
          dayIndex,
          broadAreasShifted: ["daily_routine"],
          lowDaylight: true,
          highStationaryBout: true,
          pastActionOutcomes: [
            { actionKey: "short_walk", completedCount: 2, averageNextDelta: 0.4 },
            { actionKey: "bright_light", completedCount: 2, averageNextDelta: 0.6 },
          ],
          isSimulated: true,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        provider?: string;
        model?: string | null;
        fallbackUsed?: boolean;
        result?: TailoredStepState["result"];
      };
      if (!res.ok || !json.ok || !json.result) {
        setErrorText(json.error ?? "Unable to tailor step right now.");
      } else {
        setTailored({
          provider: json.provider ?? "deterministic-fallback",
          model: json.model ?? null,
          fallbackUsed: Boolean(json.fallbackUsed),
          result: json.result,
        });
      }
    } catch {
      setErrorText("Unable to reach the step helper.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Tailor suggestion with EU Gemma on Verda"
      className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Personalize today&apos;s gentle option (EU Verda + Gemma)
          </h2>
          <p className="mt-0.5 text-xs text-stone-600">
            Uses only pseudonymous context (such as low indoor daylight or what
            helped before) to pick one low-effort option.
          </p>
        </div>

        <button
          type="button"
          data-testid="verda-patient-step-btn"
          disabled={busy}
          onClick={handleTailorStep}
          className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Choosing..." : "Tailor step for today's context"}
        </button>
      </div>

      {errorText ? (
        <p className="text-xs text-amber-900">{errorText}</p>
      ) : null}

      {tailored ? (
        <div
          data-testid="verda-patient-step-result"
          className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {tailored.result.actionTitle}
            </span>
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-800">
              {tailored.provider === "verda-gemma"
                ? `Verda EU · ${tailored.model}`
                : "Deterministic safe fallback"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-stone-700">
            {tailored.result.message}
          </p>
        </div>
      ) : null}
    </section>
  );
}
