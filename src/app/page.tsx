import Link from "next/link";
import { getPrisma } from "@/lib/db";
import {
  BROAD_AREA_LABELS,
  DEMO_MOMENT_LIST,
  type BroadAreaKey,
  type DemoMomentMeta,
} from "@/lib/constants";
import { toSafeClinicFlagView } from "@/lib/schemas";
import {
  SIMULATED_PARTICIPANT_EXTERNAL_ID,
  generateSimulatedPersonWeeks,
  sliceDatasetThroughDay,
  type SimulatedPersonDataset,
} from "@/lib/simulation";
import { readServerSession } from "@/server/auth";
import { SimulatedBadge } from "@/components/simulated-badge";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";
import {
  DemoTimelinePreview,
  type DemoMomentSummary,
} from "@/components/demo-timeline-preview";
import { PublicLandingShowcase } from "@/components/public-landing-showcase";

export const dynamic = "force-dynamic";

function getMomentButtonLabel(key: DemoMomentMeta["key"]): string {
  if (key === "well") return "Day 18 · Well";
  if (key === "small_dip") return "Day 29 · Small dip";
  return "Day 56 · Sustained drift & silence";
}

function formatLatestRoundStatus(
  latestRound: SimulatedPersonDataset["checkInRounds"][number] | null
): string {
  if (!latestRound) return "No rounds scheduled yet";
  if (latestRound.status === "completed") {
    return `Completed on ${latestRound.date} (Week ${latestRound.weekNumber})`;
  }
  if (latestRound.status === "not_today") {
    return `Skipped ("Not today") on ${latestRound.date}`;
  }
  return `Unanswered round on ${latestRound.date} (recorded as missed, never scored as zero)`;
}

function getPatientViewSummary(
  key: DemoMomentMeta["key"],
  latestSuggestion: SimulatedPersonDataset["patientSuggestions"][number] | null
) {
  if (key === "small_dip" && latestSuggestion) {
    return {
      headline: "One small step for today",
      actionTitle: latestSuggestion.actionTitle,
      actionDetail: latestSuggestion.actionDetail,
      note: "Shown on a mild dip: one optional button, with no graphs or scores.",
    };
  }
  if (key === "well") {
    return {
      headline: "Steady week, nothing extra asked today",
      actionTitle: null,
      actionDetail: null,
      note: "When check-ins stay steady, the app stays quiet.",
    };
  }
  return {
    headline: "Human check-in from the clinic",
    actionTitle: "Your care team nurse can check in with you by phone",
    actionDetail:
      "Missed rounds are never penalised. Direct crisis and clinic nurse lines stay at the top of the screen.",
    note: "After a longer drift and unanswered rounds, follow-up moves to a phone call from a nurse.",
  };
}

function getClinicViewSummary(
  key: DemoMomentMeta["key"],
  safeFlag: ReturnType<typeof toSafeClinicFlagView> | null
) {
  if (!safeFlag) {
    return {
      hasOpenFlag: false,
      sinceDate: null,
      broadAreaLabels: [],
      ringActiveDuringSilence: null,
      recommendedActions: [],
      note:
        key === "well"
          ? "The first weeks set the person's own baseline. No clinic flag is raised."
          : "A single heavier round is handled quietly on the patient side without alerting the clinic.",
    };
  }

  const broadAreaLabels = safeFlag.broadAreas.map(
    (area: BroadAreaKey) => BROAD_AREA_LABELS[area] ?? area
  );

  return {
    hasOpenFlag: true,
    sinceDate: safeFlag.sinceDate,
    broadAreaLabels,
    ringActiveDuringSilence: safeFlag.ringActiveDuringSilence,
    recommendedActions: [
      "Request nurse call",
      "Offer 5-session booster cluster",
    ],
    note: "Gives the nurse the broad life areas that shifted and when the change started, without raw sensor numbers.",
  };
}

function buildMomentSummary(
  fullDataset: SimulatedPersonDataset,
  meta: DemoMomentMeta
): DemoMomentSummary {
  const sliced = sliceDatasetThroughDay(fullDataset, meta.dayIndex);
  const completedRounds = sliced.checkInRounds.filter(
    (r) => r.status === "completed"
  );
  const missedOrSkippedRounds = sliced.checkInRounds.filter(
    (r) => r.status === "missed" || r.status === "not_today"
  );
  const latestRound =
    sliced.checkInRounds[sliced.checkInRounds.length - 1] ?? null;
  const latestRingDay = sliced.ringDays[sliced.ringDays.length - 1] ?? null;
  const latestSuggestion =
    sliced.patientSuggestions[sliced.patientSuggestions.length - 1] ?? null;
  const latestFlag = sliced.clinicFlags[sliced.clinicFlags.length - 1] ?? null;

  const safeFlag = latestFlag
    ? toSafeClinicFlagView({
        id: `sim-flag-${latestFlag.dayIndex}`,
        participantId: sliced.participant.externalId,
        sinceDate: latestFlag.sinceDate,
        triggerKind: latestFlag.triggerKind,
        primaryArea: latestFlag.primaryArea,
        broadAreasJson: latestFlag.broadAreasJson,
        status: latestFlag.status,
        ringActiveDuringSilence: latestFlag.ringActiveDuringSilence,
        patientSharedDetails: latestFlag.patientSharedDetails,
        isSimulated: true,
      })
    : null;

  const ringWornStatus = latestRingDay?.ringActive
    ? `Smart ring worn (${latestRingDay.wearMinutes} min/day on ${latestRingDay.date})`
    : "Smart ring not active";

  const checkInNote =
    meta.key === "well"
      ? "Twice-weekly check-ins and sleep timing stay close to this person's own first weeks after treatment."
      : meta.key === "small_dip"
        ? "One heavier round shows up in Week 5 while check-ins continue as usual."
        : `${missedOrSkippedRounds.length} unanswered rounds in Week 8 while the smart ring is still worn every day.`;

  return {
    key: meta.key,
    buttonLabel: getMomentButtonLabel(meta.key),
    dayIndex: meta.dayIndex,
    weekNumber: meta.weekNumber,
    title: meta.title,
    subtitle: meta.subtitle,
    recipient: meta.recipient,
    checkInSummary: {
      latestRoundStatus: formatLatestRoundStatus(latestRound),
      completedCount: completedRounds.length,
      missedOrSkippedCount: missedOrSkippedRounds.length,
      ringWornStatus,
      note: checkInNote,
    },
    patientViewSummary: getPatientViewSummary(meta.key, latestSuggestion),
    clinicViewSummary: getClinicViewSummary(meta.key, safeFlag),
  };
}

function ExploreViewsGrid({ role }: { role: "patient" | "staff" }) {
  const showPatient = role === "patient";
  const showStaff = role === "staff";

  return (
    <section aria-label="Workstream modules" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
            Explore each view
          </h2>
          <p className="text-sm text-ink-secondary">
            {showStaff
              ? "Open the clinic follow-up overview."
              : "Step through your home check-in and sensing views."}
          </p>
        </div>
        <span className="text-xs text-ink-muted">
          All views use simulated data only
        </span>
      </div>

      <div className="divide-y divide-border-hairline rounded-2xl border border-border-hairline bg-surface-card">
        {showPatient ? (
          <>
            <Link
              href="/check-in"
              data-testid="card-check-in"
              className="group flex flex-col justify-between gap-4 p-6 transition hover:bg-surface-subtle/60 sm:flex-row sm:items-center sm:p-8"
            >
              <div className="max-w-xl space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-ink-primary group-hover:text-accent-sage">
                  Twice-weekly wellbeing check-in
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Two quick 0 to 4 tap questions twice a week, or a single tap
                  on &ldquo;Not today&rdquo; when you want to rest. Missed
                  rounds are simply noted as missed, and phone numbers for a
                  real person stay at the top of the page.
                </p>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition group-hover:border-accent-sage group-hover:bg-accent-sage group-hover:text-white">
                Open check-in <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>

            <Link
              href="/patient"
              data-testid="card-patient"
              className="group flex flex-col justify-between gap-4 p-6 transition hover:bg-surface-subtle/60 sm:flex-row sm:items-center sm:p-8"
            >
              <div className="max-w-xl space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-ink-primary group-hover:text-accent-sage">
                  Patient view: One small step for today
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Offers one simple idea (&ldquo;Take a 10-minute walk
                  outside&rdquo;) when a check-in dips below usual, without
                  charts or scores.
                </p>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition group-hover:border-accent-sage group-hover:bg-accent-sage group-hover:text-white">
                Open patient view <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>

            <Link
              href="/camera"
              data-testid="card-camera"
              className="group flex flex-col justify-between gap-4 p-6 transition hover:bg-surface-subtle/60 sm:flex-row sm:items-center sm:p-8"
            >
              <div className="max-w-xl space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-ink-primary group-hover:text-accent-sage">
                  On-device camera check
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  MediaPipe Face Landmarker runs in your browser for 20 seconds
                  and keeps only two summary numbers for face and head movement.
                  No video or images are ever saved.
                </p>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition group-hover:border-accent-sage group-hover:bg-accent-sage group-hover:text-white">
                Open camera check <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>

            <Link
              href="/monitoring"
              data-testid="card-monitoring"
              className="group flex flex-col justify-between gap-4 p-6 transition hover:bg-surface-subtle/60 sm:flex-row sm:items-center sm:p-8"
            >
              <div className="max-w-xl space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-ink-primary group-hover:text-accent-sage">
                  Monitoring &amp; consent settings
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Review which channels are active, adjust your sharing
                  preferences, and see how your own first weeks form a personal
                  baseline.
                </p>
              </div>
              <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition group-hover:border-accent-sage group-hover:bg-accent-sage group-hover:text-white">
                Open monitoring &amp; consent{" "}
                <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          </>
        ) : null}

        {showStaff ? (
          <Link
            href="/clinic"
            data-testid="card-clinic"
            className="group flex flex-col justify-between gap-4 p-6 transition hover:bg-surface-subtle/60 sm:flex-row sm:items-center sm:p-8"
          >
            <div className="max-w-xl space-y-1.5">
              <h3 className="font-display text-xl font-semibold text-ink-primary group-hover:text-accent-sage">
                Clinic view: Follow-up flag for the nurse
              </h3>
              <p className="text-sm leading-relaxed text-ink-secondary">
                Shows the care team which broad life areas shifted and when the
                change started, with buttons to arrange a nurse call or a
                5-session booster cluster.
              </p>
            </div>
            <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border-tactile bg-surface-subtle px-4 py-2 text-xs font-semibold text-ink-primary transition group-hover:border-accent-sage group-hover:bg-accent-sage group-hover:text-white">
              Open clinic overview <span aria-hidden="true">&rarr;</span>
            </span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

async function loadSignedInOverview() {
  const fullSimulatedDataset = generateSimulatedPersonWeeks();
  let dbSeeded = false;
  let participantLabel = fullSimulatedDataset.participant.label;
  let tmsCompletedDate = fullSimulatedDataset.participant.tmsCompletedDate;
  let activeConsentCount = fullSimulatedDataset.consents.filter(
    (c) => c.enabled
  ).length;

  try {
    const prisma = getPrisma();
    const dbParticipant = await prisma.participant.findUnique({
      where: { externalId: SIMULATED_PARTICIPANT_EXTERNAL_ID },
      include: {
        consents: true,
        clinicFlags: true,
        patientSuggestions: true,
      },
    });
    if (dbParticipant) {
      dbSeeded = true;
      participantLabel = dbParticipant.label;
      tmsCompletedDate =
        dbParticipant.tmsCompletedDate ??
        fullSimulatedDataset.participant.tmsCompletedDate;
      activeConsentCount = dbParticipant.consents.filter(
        (c) => c.enabled
      ).length;
    }
  } catch {
    dbSeeded = false;
  }

  return {
    dbSeeded,
    participantLabel,
    tmsCompletedDate,
    activeConsentCount,
    momentSummaries: DEMO_MOMENT_LIST.map((meta) =>
      buildMomentSummary(fullSimulatedDataset, meta)
    ),
  };
}

export default async function HomePage() {
  const session = await readServerSession();
  if (!session) {
    return <PublicLandingShowcase />;
  }

  const {
    dbSeeded,
    participantLabel,
    tmsCompletedDate,
    activeConsentCount,
    momentSummaries,
  } = await loadSignedInOverview();

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="8 weeks after TMS (Days 1–56)" />
          <span className="tabular-nums text-xs text-ink-muted">
            {participantLabel} · TMS finished {tmsCompletedDate} ·{" "}
            {activeConsentCount} consented channels ·{" "}
            {dbSeeded
              ? "PostgreSQL (sim-post-tms-01)"
              : "In-memory simulation"}
          </span>
        </div>

        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-5xl">
            Staying well at home after TMS
          </h1>
          <p className="text-base leading-relaxed text-ink-secondary sm:text-lg">
            Finishing a course of Transcranial Magnetic Stimulation (TMS) often
            leaves a gap between clinic visits. Cepheus uses a short
            twice-weekly check-in and sleep timing from a smart ring to do two
            things: offer one small step at home when a week feels heavier, and
            let the clinic nurse know when a longer shift is worth a phone call.
          </p>
        </div>

        <ForestCanopyArtwork className="w-full pt-2 text-accent-sage" />
      </header>

      <DemoTimelinePreview
        moments={momentSummaries}
        initialMoment="small_dip"
      />

      <ForestDivider variant="grove" />

      <ExploreViewsGrid role={session.kind} />
    </div>
  );
}
