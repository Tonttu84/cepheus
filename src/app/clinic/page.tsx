import { type BroadAreaKey } from "@/lib/constants";
import { toSafeClinicFlagView } from "@/lib/schemas";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";
import { SimulatedBadge } from "@/components/simulated-badge";
import { ClinicFlagCard } from "@/components/clinic-flag-card";

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
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-border-hairline bg-surface-card p-6 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 56 · Week 8 clinic outer-loop view" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            TMS Care Team Overview
          </span>
        </div>

        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
          TMS outer-loop clinic overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Supporting the clinic&apos;s judgment on when to check in with a
          post-TMS participant. Flags name only the broad life area(s) and since
          when — never raw sensor traces, transactions, or automated diagnostic
          claims.
        </p>
      </section>

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

      {/* Privacy & Clinical Boundary Footer Note */}
      <section className="rounded-2xl border border-border-hairline bg-surface-muted/70 p-4.5 text-xs leading-relaxed text-ink-secondary">
        <p>
          <strong className="font-semibold text-ink-primary">
            Privacy &amp; clinical boundary:
          </strong>{" "}
          This view exposes only broad life areas (<code>check_in</code>,{" "}
          <code>sleep</code>, <code>daily_routine</code>) and the date since
          shift began. Detailed check-in notes or individual measurements are
          shown only if the participant explicitly chooses to share them with
          the clinic.
        </p>
      </section>
    </div>
  );
}
