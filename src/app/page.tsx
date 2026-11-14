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
import { SimulatedBadge } from "@/components/simulated-badge";
import {
  ForestCanopyArtwork,
  ForestDivider,
} from "@/components/forest-divider";
import {
  DemoTimelinePreview,
  type DemoMomentSummary,
} from "@/components/demo-timeline-preview";

export const dynamic = "force-dynamic";

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

  const buttonLabel =
    meta.key === "well"
      ? "Day 18 · Well"
      : meta.key === "small_dip"
        ? "Day 29 · Small dip"
        : "Day 56 · Sustained drift & silence";

  const latestRoundStatus = latestRound
    ? latestRound.status === "completed"
      ? `Completed on ${latestRound.date} (Week ${latestRound.weekNumber})`
      : latestRound.status === "not_today"
        ? `Skipped ("Not today") on ${latestRound.date}`
        : `Unanswered round on ${latestRound.date} (recorded as missed, never scored as zero)`
    : "No rounds scheduled yet";

  const ringWornStatus = latestRingDay?.ringActive
    ? `Smart ring worn (${latestRingDay.wearMinutes} min/day on ${latestRingDay.date})`
    : "Smart ring not active";

  const checkInNote =
    meta.key === "well"
      ? "Twice-weekly check-in and sleep regularity stay steady within personal post-TMS baseline."
      : meta.key === "small_dip"
        ? "A mild one-round dip appears in Week 5 while check-ins remain answered."
        : `${missedOrSkippedRounds.length} unanswered rounds in Week 8 while the smart ring remains actively worn.`;

  const patientViewSummary =
    meta.key === "small_dip" && latestSuggestion
      ? {
          headline: "One small step for today",
          actionTitle: latestSuggestion.actionTitle,
          actionDetail: latestSuggestion.actionDetail,
          note: "Shown on a mild dip — one low-effort action button, with zero graphs, scores, or streaks.",
        }
      : meta.key === "well"
        ? {
            headline: "Everything steady — nothing asked of you today",
            actionTitle: null,
            actionDetail: null,
            note: "When check-ins are steady, the app stays quiet and asks nothing extra.",
          }
        : {
            headline: "Gentle check-in & human outreach",
            actionTitle: "Your care team nurse can check in with you by phone",
            actionDetail:
              "Missed rounds are never punished; direct crisis & clinic nurse lines stay one tap away.",
            note: "After sustained drift and unanswered rounds, outreach shifts to a human nurse call.",
          };

  const broadAreaLabels = safeFlag
    ? safeFlag.broadAreas.map(
        (area: BroadAreaKey) => BROAD_AREA_LABELS[area] ?? area
      )
    : [];

  const clinicViewSummary = safeFlag
    ? {
        hasOpenFlag: true,
        sinceDate: safeFlag.sinceDate,
        broadAreaLabels,
        ringActiveDuringSilence: safeFlag.ringActiveDuringSilence,
        recommendedActions: [
          "Request nurse call",
          "Offer 5-session booster cluster",
        ],
        note: "Supporting the clinic's judgment on when to check in — naming broad life areas and since when, never raw sensor traces.",
      }
    : {
        hasOpenFlag: false,
        sinceDate: null,
        broadAreaLabels: [],
        ringActiveDuringSilence: null,
        recommendedActions: [],
        note:
          meta.key === "well"
            ? "Baseline weeks establish personal reference ranges; no clinic flag is raised."
            : "A single mild dip is handled gently on the patient side without raising a clinic alert.",
      };

  return {
    key: meta.key,
    buttonLabel,
    dayIndex: meta.dayIndex,
    weekNumber: meta.weekNumber,
    title: meta.title,
    subtitle: meta.subtitle,
    recipient: meta.recipient,
    checkInSummary: {
      latestRoundStatus,
      completedCount: completedRounds.length,
      missedOrSkippedCount: missedOrSkippedRounds.length,
      ringWornStatus,
      note: checkInNote,
    },
    patientViewSummary,
    clinicViewSummary,
  };
}

export default async function HomePage() {
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
    // Seamless fallback to deterministic generator if DB isn't seeded yet
    dbSeeded = false;
  }

  const momentSummaries = DEMO_MOMENT_LIST.map((meta) =>
    buildMomentSummary(fullSimulatedDataset, meta)
  );

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Top Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-border-hairline bg-surface-card p-8 shadow-xs sm:p-11">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-sage/6 blur-2xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <SimulatedBadge subtitle="8-week post-TMS synthetic trajectory (Days 1–56)" />
          <span className="rounded-full border border-border-hairline bg-surface-subtle px-3 py-1 text-xs font-medium text-ink-secondary">
            Data source:{" "}
            <strong className="font-semibold text-ink-primary">
              {dbSeeded
                ? "PostgreSQL seeded participant (sim-post-tms-01)"
                : "In-memory deterministic simulation"}
            </strong>
          </span>
        </div>

        <h1 className="font-display relative mt-5 text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">
          Cepheus — Staying Well After TMS Treatment
        </h1>
        <p className="relative mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary sm:text-base">
          A calm home wellbeing check-in companion for the months after
          Transcranial Magnetic Stimulation (TMS). Cepheus pairs a low-effort
          twice-weekly check-in and passive smart-ring sleep rhythm with two
          proportionate loops: a single small step for the patient on a mild
          dip, and a broad-area flag supporting the clinic&apos;s judgment on
          when to check in after sustained drift.
        </p>

        <ForestCanopyArtwork className="mt-8 w-full text-accent-sage" />

        <dl className="relative mt-8 grid grid-cols-1 gap-4 border-t border-surface-muted pt-7 sm:grid-cols-3">
          <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Participant
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink-primary">
              {participantLabel}
            </dd>
          </div>
          <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              TMS Course Completed
            </dt>
            <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
              {tmsCompletedDate}
            </dd>
          </div>
          <div className="rounded-xl border border-border-hairline bg-surface-subtle/80 p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Active Consented Channels
            </dt>
            <dd className="tabular-nums mt-1 text-sm font-semibold text-ink-primary">
              {activeConsentCount} channels
            </dd>
          </div>
        </dl>
      </section>

      {/* Interactive 3-Moment Switcher */}
      <ForestDivider
        variant="treeline"
        label="Three moments across eight weeks"
      />

      <DemoTimelinePreview
        moments={momentSummaries}
        initialMoment="small_dip"
      />

      {/* Workstream Entrypoint Cards (Workstreams 2–5) */}
      <ForestDivider variant="grove" label="Core modules & views" />

      <section aria-label="Workstream modules" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink-primary">
            Explore Workstreams
          </h2>
          <span className="text-xs text-ink-muted">
            All views use simulated data only
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/check-in"
            data-testid="card-check-in"
            className="group flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs transition hover:-translate-y-0.5 hover:border-accent-sage/50 hover:shadow-sm sm:p-8"
          >
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-primary group-hover:text-accent-sage">
                Low-effort wellbeing check-in
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Four 1–5 tap questions twice a week, explicit &ldquo;Not
                today&rdquo; skip, missed answers recorded as missed (never
                punished), and an immediate human crisis path.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent-sage">
              Open check-in flow <span aria-hidden="true">&rarr;</span>
            </span>
          </Link>

          <Link
            href="/camera"
            data-testid="card-camera"
            className="group flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs transition hover:-translate-y-0.5 hover:border-accent-sage/50 hover:shadow-sm sm:p-8"
          >
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-primary group-hover:text-accent-sage">
                On-device camera wellbeing check
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                MediaPipe Face Landmarker runs locally in your browser to
                compute derived facial expressivity and head movement numbers
                only — never storing video or images.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent-sage">
              Open camera check <span aria-hidden="true">&rarr;</span>
            </span>
          </Link>

          <Link
            href="/patient"
            data-testid="card-patient"
            className="group flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs transition hover:-translate-y-0.5 hover:border-accent-sage/50 hover:shadow-sm sm:p-8"
          >
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-primary group-hover:text-accent-sage">
                Patient view: One small step for today
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Surfaces one low-effort suggestion (&ldquo;Take a 10-minute walk
                outside&rdquo;) during a mild dip, with zero scores, zero
                graphs, and zero risk labels.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent-sage">
              Open patient view <span aria-hidden="true">&rarr;</span>
            </span>
          </Link>

          <Link
            href="/clinic"
            data-testid="card-clinic"
            className="group flex flex-col justify-between rounded-2xl border border-border-hairline bg-surface-card p-7 shadow-xs transition hover:-translate-y-0.5 hover:border-accent-sage/50 hover:shadow-sm sm:p-8"
          >
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-primary group-hover:text-accent-sage">
                Clinic view: Broad-area flag &amp; nurse outreach
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Supports the clinic&apos;s judgment on when to check in by
                showing broad life areas and since when, plus actions to request
                a nurse call or offer a 5-session booster cluster.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent-sage">
              Open clinic overview <span aria-hidden="true">&rarr;</span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
