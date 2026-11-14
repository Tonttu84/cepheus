"use client";

import { useState } from "react";

interface NurseBriefState {
  provider: string;
  model: string | null;
  faithfulnessVerified: boolean;
  result: {
    summary: string;
    conversationOpeners: string[];
  };
}

const SOURCE_METRICS = [
  { label: "Unanswered rounds", valueText: "2" },
  { label: "Sleep regularity shift", valueText: "-18%" },
] as const;

export function ClinicNurseBriefPanel({
  participantCode,
  sinceDate,
  broadAreas,
  ringActiveDuringSilence,
}: {
  participantCode: string;
  sinceDate: string;
  broadAreas: readonly string[];
  ringActiveDuringSilence: boolean | null;
}) {
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<NurseBriefState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleGenerateBrief() {
    setBusy(true);
    setConfirmed(false);
    setErrorText(null);
    try {
      const res = await fetch("/api/ai/nurse-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCode,
          sinceDate,
          triggerKind: "silence",
          broadAreas: [...broadAreas],
          ringActiveDuringSilence,
          metrics: SOURCE_METRICS,
          isSimulated: true,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        provider?: string;
        model?: string | null;
        faithfulnessVerified?: boolean;
        result?: NurseBriefState["result"];
      };
      if (!res.ok || !json.ok || !json.result) {
        setErrorText(json.error ?? "Unable to generate nurse brief.");
      } else {
        setBrief({
          provider: json.provider ?? "deterministic-fallback",
          model: json.model ?? null,
          faithfulnessVerified: Boolean(json.faithfulnessVerified),
          result: json.result,
        });
      }
    } catch {
      setErrorText("Unable to reach nurse brief service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Nurse pre-call brief via EU Verda Gemma"
      className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            Nurse Pre-Call Brief (Optional EU Verda + Gemma formatter)
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600">
            Formats pseudonymous broad-area shifts into a brief summary and
            non-judgmental phone openers. Off by default unless{" "}
            <code>VERDA_AI_ENABLED=true</code>; deterministic rules always
            trigger the flag and the model never interprets or scores.
          </p>
        </div>

        <button
          type="button"
          data-testid="verda-nurse-brief-btn"
          disabled={busy}
          onClick={handleGenerateBrief}
          className="min-h-11 inline-flex items-center justify-center rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Preparing brief..." : "Generate nurse pre-call brief"}
        </button>
      </div>

      {errorText ? (
        <p className="text-xs text-amber-900">{errorText}</p>
      ) : null}

      {brief ? (
        <div
          data-testid="verda-nurse-brief-result"
          className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              AI-formatted draft · verify against source numbers
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
              {brief.provider === "verda-gemma"
                ? `Verda EU (${brief.model}) · Faithfulness checked`
                : "Deterministic safe fallback · Faithfulness checked"}
            </span>
          </div>

          <div
            data-testid="verda-source-metrics"
            className="rounded border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
          >
            <strong>Source metrics passed in:</strong> Since {sinceDate} · Areas:{" "}
            {broadAreas.join(", ")} ·{" "}
            {SOURCE_METRICS.map((m) => `${m.label}: ${m.valueText}`).join(" · ")}
          </div>

          <p className="text-sm leading-relaxed text-stone-800">
            {brief.result.summary}
          </p>

          <div>
            <h4 className="text-xs font-semibold text-stone-700">
              Gentle call-opener suggestions
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-stone-700">
              {brief.result.conversationOpeners.map((opener, i) => (
                <li key={i}>{opener}</li>
              ))}
            </ul>
          </div>

          <label className="flex items-center gap-2 pt-1 text-xs font-medium text-stone-700">
            <input
              type="checkbox"
              data-testid="verda-nurse-confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span>
              I checked the summary against the source metrics above (human-in-the-loop
              oversight).
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}
