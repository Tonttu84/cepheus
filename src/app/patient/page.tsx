import { PATIENT_SUGGESTIONS } from "@/lib/constants";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";
import { SimulatedBadge } from "@/components/simulated-badge";
import { PatientSuggestionCard } from "@/components/patient-suggestion-card";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";

export default function PatientPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 29 });
  const activeSuggestion =
    dataset.patientSuggestions[dataset.patientSuggestions.length - 1] ??
    PATIENT_SUGGESTIONS[0];

  return (
    <div className="mx-auto max-w-2xl space-y-10 sm:space-y-12">
      {/* Header */}
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 29 · Week 5 gentle check-in view" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Patient View
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          One small step for today
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Your last check-in looked a bit heavier than usual. Here is one small
          thing to try today, if you feel up for it. If not, leave it for
          another day and rest.
        </p>
        <ForestCanopyArtwork className="mt-6 w-full text-accent-sage" />
      </section>

      <ForestDivider variant="clearing" />

      {/* Single One-Button Low-Effort Suggestion Card */}
      <PatientSuggestionCard
        actionTitle={activeSuggestion.actionTitle}
        actionDetail={activeSuggestion.actionDetail}
      />

      <ForestDivider variant="grove" />

      {/* Reassurance note */}
      <section className="rounded-2xl border border-border-hairline bg-surface-muted/70 p-4.5 text-xs leading-relaxed text-ink-secondary">
        <p>
          Skipping a suggestion or a check-in is always fine, and nothing is
          counted against you. If you want to talk with someone directly, the
          TMS clinic nurse line and 24/7 crisis support are at the top of this
          screen.
        </p>
      </section>
    </div>
  );
}
