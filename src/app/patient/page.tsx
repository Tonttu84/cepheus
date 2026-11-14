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
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 29 · Week 5 gentle check-in view" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Patient View
          </span>
        </div>

        <div className="max-w-3xl space-y-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
            One small step for today
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary">
            Your last check-in looked a bit heavier than usual. Here is one
            small thing to try today, if you feel up for it. If not, leave it
            for another day and rest.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      <PatientSuggestionCard
        actionTitle={activeSuggestion.actionTitle}
        actionDetail={activeSuggestion.actionDetail}
      />

      <ForestDivider variant="grove" />

      <p className="border-t border-border-hairline pt-6 text-xs leading-relaxed text-ink-secondary">
        Skipping a suggestion or a check-in is always fine, and nothing is
        counted against you. If you want to talk with someone directly, the TMS
        clinic nurse line and 24/7 crisis support are at the top of this screen.
      </p>
    </div>
  );
}
