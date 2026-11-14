import { type BroadAreaKey } from "@/lib/constants";
import { toSafeClinicFlagView } from "@/lib/schemas";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";
import { ClinicNurseBriefPanel } from "@/components/clinic-nurse-brief-panel";
import { SimulatedBadge } from "@/components/simulated-badge";
import { ClinicFlagCard } from "@/components/clinic-flag-card";
import { ForestDivider } from "@/components/forest-divider";

export default function ClinicPage() {
  const dataset = generateSimulatedPersonWeeks({ throughDay: 56 });
  const rawFlag = dataset.clinicFlags[dataset.clinicFlags.length - 1];

  const safeFlag = rawFlag
    ? toSafeClinicFlagView({
        id: `sim-flag-${rawFlag.dayIndex}`,
        participantId: dataset.participant.externalId,
        sinceDate: rawFlag.sinceDate,
        triggerKind: rawFlag.triggerKind,
        primaryArea: rawFlag.primaryArea,
        broadAreasJson: rawFlag.broadAreasJson,
        status: rawFlag.status,
        ringActiveDuringSilence: rawFlag.ringActiveDuringSilence,
        patientSharedDetails: rawFlag.patientSharedDetails,
        isSimulated: true,
      })
    : null;

  return (
    <div className="space-y-12 sm:space-y-14">
      {/* Header */}
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 56 · Week 8 clinic follow-up view" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            TMS Care Team Overview
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          Post-TMS clinic follow-up
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Helps the care team see when a post-TMS patient may benefit from a
          phone call. A flag names only the broad areas of daily life that
          shifted and when the change started, without raw sensor numbers or
          automated diagnoses.
        </p>
      </section>

      <ForestDivider variant="treeline" label="Active follow-up flag" />

      {/* Active Broad-Area Flag Card */}
      {safeFlag ? (
        <ClinicFlagCard
          participantLabel={dataset.participant.label}
          participantExternalId={dataset.participant.externalId}
          tmsCompletedDate={dataset.participant.tmsCompletedDate}
          sinceDate={safeFlag.sinceDate}
          broadAreas={safeFlag.broadAreas as BroadAreaKey[]}
          ringActiveDuringSilence={Boolean(safeFlag.ringActiveDuringSilence)}
        />
      ) : null}

      {safeFlag ? (
        <ClinicNurseBriefPanel
          participantCode={dataset.participant.externalId}
          sinceDate={safeFlag.sinceDate}
          broadAreas={safeFlag.broadAreas}
          ringActiveDuringSilence={safeFlag.ringActiveDuringSilence}
        />
      ) : null}

      <ForestDivider variant="clearing" />

      {/* Privacy & Clinical Boundary Footer Note */}
      <section className="rounded-2xl border border-border-hairline bg-surface-muted/70 p-7 text-xs leading-relaxed text-ink-secondary sm:p-10">
        <p>
          <strong className="font-semibold text-ink-primary">
            Privacy and clinical boundary:
          </strong>{" "}
          This page shows only broad areas of daily life (<code>check_in</code>,{" "}
          <code>sleep</code>, <code>daily_routine</code>) and the date the shift
          began. Individual check-in answers and daily measurements stay private
          unless the patient chooses to share them with the clinic.
        </p>
      </section>
    </div>
  );
}
