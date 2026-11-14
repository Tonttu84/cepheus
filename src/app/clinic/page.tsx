import { BROAD_AREA_LABELS, type BroadAreaKey } from "@/lib/constants";
import { toSafeClinicFlagView } from "@/lib/schemas";
import { generateSimulatedPersonWeeks } from "@/lib/simulation";
import { ClinicNurseBriefPanel } from "@/components/clinic-nurse-brief-panel";
import { SimulatedBadge } from "@/components/simulated-badge";

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
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="Day 56 · Week 8 clinic outer-loop view" />
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            TMS Care Team Overview
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          TMS outer-loop clinic overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">
          Supporting the clinic&apos;s judgment on when to check in with a
          post-TMS participant. Flags name only the broad life area(s) and since
          when — never raw sensor traces, transactions, or automated diagnostic
          claims.
        </p>
      </section>

      {/* Active Broad-Area Flag Card */}
      {safeFlag ? (
        <section
          aria-label="Broad-area clinic flag"
          data-testid="clinic-flag-card"
          className="rounded-xl border border-stone-300 bg-white p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <span className="inline-block rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
                Open follow-up flag · Since {safeFlag.sinceDate}
              </span>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">
                {dataset.participant.label} ({dataset.participant.externalId})
              </h2>
              <p className="mt-0.5 text-xs text-stone-600">
                TMS course completed: {dataset.participant.tmsCompletedDate} ·
                Current follow-up point: Day 56 (Week 8)
              </p>
            </div>
            <SimulatedBadge subtitle="Broad-area summary only" />
          </div>

          {/* Broad Life Areas */}
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Broad areas shifted since {safeFlag.sinceDate}
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {safeFlag.broadAreas.map((area: BroadAreaKey) => (
                <span
                  key={area}
                  data-testid={`clinic-broad-area-${area}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm font-medium text-stone-900"
                >
                  <span>{BROAD_AREA_LABELS[area] ?? area}</span>
                  <span className="rounded bg-stone-200/80 px-1.5 py-0.5 font-mono text-xs text-stone-700">
                    {area}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Silence + Ring Active Signal */}
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-semibold text-stone-900">
              Check-in silence with active wearable contact
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-700">
              Two consecutive lowered twice-weekly check-ins were followed by
              unanswered rounds in Week 8 while the smart ring remained actively
              worn ({safeFlag.ringActiveDuringSilence ? "ring active during missed rounds" : "ring inactive"}).
              Missed check-ins are treated as an outreach signal, never scored
              as zero.
            </p>
          </div>

          {/* Clinician / Nurse Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="clinic-action-nurse-call"
              className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500"
            >
              Request nurse call
            </button>
            <button
              type="button"
              data-testid="clinic-action-booster"
              className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              Offer 5-session booster cluster
            </button>
          </div>
        </section>
      ) : null}

      {safeFlag ? (
        <ClinicNurseBriefPanel
          participantCode={dataset.participant.externalId}
          sinceDate={safeFlag.sinceDate}
          broadAreas={safeFlag.broadAreas}
          ringActiveDuringSilence={safeFlag.ringActiveDuringSilence}
        />
      ) : null}

      {/* Privacy & Clinical Boundary Footer Note */}
      <section className="rounded-xl border border-stone-200 bg-stone-100/70 p-4 text-xs leading-relaxed text-stone-600">
        <p>
          <strong>Privacy &amp; clinical boundary:</strong> This view exposes
          only broad life areas (<code>check_in</code>, <code>sleep</code>,{" "}
          <code>daily_routine</code>) and the date since shift began. Detailed
          check-in notes or individual measurements are shown only if the
          participant explicitly chooses to share them with the clinic.
        </p>
      </section>
    </div>
  );
}
