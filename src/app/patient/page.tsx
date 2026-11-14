import { PATIENT_SUGGESTIONS } from "@/lib/constants";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";
import { PatientStepPersonalizer } from "@/components/patient-step-personalizer";
import { SimulatedBadge } from "@/components/simulated-badge";

export default function PatientPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 29 });
  const activeSuggestion =
    dataset.patientSuggestions[dataset.patientSuggestions.length - 1] ??
    PATIENT_SUGGESTIONS[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 29 · Week 5 gentle check-in view" />
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            Patient View
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          One small step for today
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">
          When a recent check-in feels a little heavier than usual, Cepheus
          offers one simple, low-effort option for today. You can try it now or
          leave it for later — whatever feels manageable.
        </p>
      </section>

      {/* Single One-Button Low-Effort Suggestion Card */}
      <section
        aria-label="Today's low-effort step"
        data-testid="patient-suggestion-card"
        className="rounded-xl border border-stone-300 bg-white p-6 shadow-xs"
      >
        <span className="inline-block rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
          Gentle option · ~10 minutes
        </span>

        <h2
          data-testid="patient-suggestion-title"
          className="mt-3 text-xl font-semibold text-stone-900"
        >
          {activeSuggestion.actionTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {activeSuggestion.actionDetail}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="patient-suggestion-accept"
            className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500"
          >
            I&apos;ll try this today
          </button>
          <button
            type="button"
            data-testid="patient-suggestion-skip"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            Not today
          </button>
        </div>
      </section>

      <PatientStepPersonalizer
        participantCode={dataset.participant.externalId}
        dayIndex={29}
      />

      {/* Reassurance note */}
      <section className="rounded-xl border border-stone-200 bg-stone-100/70 p-4 text-xs leading-relaxed text-stone-600">
        <p>
          You can always skip a suggestion or a check-in without penalty. If
          you ever want to talk with someone directly, the TMS clinic nurse line
          and 24/7 crisis support are at the top of this screen.
        </p>
      </section>
    </div>
  );
}
