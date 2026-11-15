import { Prisma, PrismaClient } from "@prisma/client";
import { addDays, getOpenRound, listRounds, type Schedule } from "../src/domain/rounds";
import { SIMULATED_STAFF_PRESETS } from "../src/lib/auth-types";
import { PATIENT_SUGGESTIONS } from "../src/lib/constants";
import {
  DEFAULT_SIMULATION_SEED,
  generateSimulatedPersonWeeks,
  SIMULATED_PARTICIPANT_EXTERNAL_ID,
} from "../src/lib/simulation";

export const SIM_CLINIC_ID = "sim-clinic-01";
export const SIM_CLINIC_CODE = "sim-clinic-01";
export const SIM_CLINIC_NAME = "Simulated TMS Clinic";

const NURSE = SIMULATED_STAFF_PRESETS.find((preset) => preset.role === "nurse")!;
export const SIM_NURSE = {
  id: NURSE.fallbackStaffId,
  email: NURSE.email,
  name: NURSE.displayName,
  role: NURSE.role,
} as const;

const WEEKDAYS = [1, 4] as const;
const TIME_OF_DAY = "18:00";
const TIME_ZONE = "Europe/Helsinki";
const LOOK_BACK_DAYS = 28;

export interface LiveSchedule {
  readonly enrolmentDate: string;
  readonly scheduleDaysJson: string;
  readonly scheduleTime: string;
  readonly timeZone: string;
}

function localDateIn(timeZone: string, moment: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

function scheduleFrom(enrolmentDate: string): Schedule {
  return {
    weekdays: WEEKDAYS,
    timeOfDay: TIME_OF_DAY,
    timeZone: TIME_ZONE,
    enrolmentDate,
  };
}

function toColumns(enrolmentDate: string): LiveSchedule {
  return {
    enrolmentDate,
    scheduleDaysJson: JSON.stringify(WEEKDAYS),
    scheduleTime: TIME_OF_DAY,
    timeZone: TIME_ZONE,
  };
}

/**
 * A schedule on Mondays and Thursdays at 18:00 in Helsinki whose round
 * `openRoundNumber` is the one open at `now`: the enrolment date is the
 * date of the round that many rounds back, so the earlier rounds have
 * already elapsed and the open one can be answered at once.
 */
export function liveScheduleAt(now: Date, openRoundNumber: number): LiveSchedule {
  const lookBack = scheduleFrom(addDays(localDateIn(TIME_ZONE, now), -LOOK_BACK_DAYS));
  const open = getOpenRound(lookBack, now);
  if (!open || open.number < openRoundNumber) {
    throw new Error("No round is open at the seed moment");
  }
  const rounds = listRounds(lookBack, open.number);
  return toColumns(rounds[open.number - openRoundNumber].localDate);
}

export async function upsertSimClinic(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.clinic.findUnique({
    where: { code: SIM_CLINIC_CODE },
  });
  if (existing && existing.id !== SIM_CLINIC_ID) {
    await tx.clinic.delete({ where: { id: existing.id } });
  }
  const clinic = await tx.clinic.upsert({
    where: { id: SIM_CLINIC_ID },
    update: { name: SIM_CLINIC_NAME, code: SIM_CLINIC_CODE },
    create: { id: SIM_CLINIC_ID, code: SIM_CLINIC_CODE, name: SIM_CLINIC_NAME },
  });
  return clinic.id;
}

/** The one simulated nurse; staff-auth finds this row by the preset's e-mail. */
export async function upsertSimNurse(
  tx: Prisma.TransactionClient,
  clinicId: string
): Promise<string> {
  await tx.staffUser.deleteMany({
    where: { OR: [{ clinicId }, { email: SIM_NURSE.email }] },
  });
  const staff = await tx.staffUser.create({
    data: {
      id: SIM_NURSE.id,
      clinicId,
      email: SIM_NURSE.email,
      name: SIM_NURSE.name,
      role: SIM_NURSE.role,
      active: true,
    },
  });
  return staff.id;
}

export interface SampleParticipant {
  readonly participantCode: string;
  readonly externalId: string;
  readonly label: string;
  readonly questionnaires: readonly ("phq9" | "gad7")[];
}

/** The two sample participants of the e-ID presets (D35), without a history. */
export const SAMPLE_PARTICIPANTS: readonly SampleParticipant[] = [
  {
    participantCode: "P-SIM-DEP-01",
    externalId: "sim-sample-depression-01",
    label: "Sample participant · Depression",
    questionnaires: ["phq9"],
  },
  {
    participantCode: "P-SIM-ANX-01",
    externalId: "sim-sample-anxiety-01",
    label: "Sample participant · Depression & anxiety",
    questionnaires: ["phq9", "gad7"],
  },
  {
    participantCode: "P-SIM-NEW-01",
    externalId: "sim-sample-new-01",
    label: "Sample participant · new, consent not yet given",
    questionnaires: ["phq9"],
  },
];

export function consentEventRows(participantId: string, clinicId: string) {
  return ["taking_part", "rule_check"].map((layer) => ({
    participantId,
    clinicId,
    layer,
    method: null,
    enabled: true,
    noticeVersion: "v1",
  }));
}

export async function createSampleSuggestion(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  now: Date,
  actionIndex = 0
): Promise<void> {
  const template = PATIENT_SUGGESTIONS[actionIndex % PATIENT_SUGGESTIONS.length];
  await tx.patientSuggestion.create({
    data: {
      participantId,
      clinicId,
      createdAt: now,
      date: localDateIn(TIME_ZONE, now),
      reason: "practice",
      actionKey: template.actionKey,
      actionTitle: template.actionTitle,
      actionDetail: template.actionDetail,
      effortTier: template.effortTier,
      status: "shown",
      armType: "intervention",
      isSimulated: true,
    },
  });
}

export async function createSampleParticipants(
  tx: Prisma.TransactionClient,
  clinicId: string,
  now: Date
): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, sample] of SAMPLE_PARTICIPANTS.entries()) {
    const isNew = sample.participantCode === "P-SIM-NEW-01";
    const row = await tx.participant.create({
      data: {
        clinicId,
        participantCode: sample.participantCode,
        externalId: sample.externalId,
        label: sample.label,
        source: "synthetic",
        isSimulated: true,
        ...liveScheduleAt(now, 1),
        takingPart: !isNew,
        ruleCheckConsent: !isNew,
        questionnairesJson: JSON.stringify(sample.questionnaires),
      },
    });
    if (!isNew) {
      await tx.consentEvent.createMany({ data: consentEventRows(row.id, clinicId) });
    }
    if (sample.participantCode === "P-SIM-DEP-01") {
      await createSampleSuggestion(tx, row.id, clinicId, now, index);
    }
    ids.push(row.id);
  }
  return ids;
}

export async function createCalmFirstRound(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  schedule: LiveSchedule
): Promise<void> {
  const [round1] = listRounds(scheduleFrom(schedule.enrolmentDate), 1);
  await tx.checkInRound.create({
    data: {
      participantId,
      clinicId,
      roundNumber: 1,
      date: round1.localDate,
      dayIndex: 1,
      weekNumber: 1,
      scheduledAt: new Date(round1.opensAt),
      respondedAt: new Date(round1.opensAt),
      status: "completed",
      moodScore: 3,
      interestScore: 3,
      isSimulated: true,
      source: "synthetic",
    },
  });
}

export function seededParticipantKeys(mainExternalId: string): Prisma.ParticipantWhereInput {
  const codes = ["P-SIM-001", ...SAMPLE_PARTICIPANTS.map((s) => s.participantCode)];
  const externalIds = [mainExternalId, ...SAMPLE_PARTICIPANTS.map((s) => s.externalId)];
  return { OR: [{ participantCode: { in: codes } }, { externalId: { in: externalIds } }] };
}

export interface SeedOptions {
  /** The moment the live schedules are laid out from; now by default. */
  readonly now?: Date;
}

export async function seedDatabase(
  client?: PrismaClient,
  options: SeedOptions = {}
): Promise<{
  participantId: string;
  externalId: string;
  nurseStaffId: string;
  sampleParticipantIds: string[];
  counts: {
    consents: number;
    ringDays: number;
    checkInRounds: number;
    phq9Assessments: number;
    rhythmWindows: number;
    cameraReadings: number;
    routineReadings: number;
    personalBaselines: number;
    patientSuggestions: number;
    clinicFlags: number;
  };
}> {
  const ownClient = !client;
  const prisma =
    client ??
    new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL ?? "file:./dev.db",
        },
      },
    });

  try {
    const dataset = generateSimulatedPersonWeeks({
      seed: DEFAULT_SIMULATION_SEED,
    });
    const now = options.now ?? new Date();
    // P-SIM-001 signs in and answers live: round 1 is a calm round that has
    // elapsed and round 2 is open at the moment of seeding.
    const liveSchedule = liveScheduleAt(now, 2);

    const result = await prisma.$transaction(async (tx) => {
      const clinicId = await upsertSimClinic(tx);
      const nurseStaffId = await upsertSimNurse(tx, clinicId);

      // Remove the simulated participants an earlier seed made (cascade cleans children)
      await tx.participant.deleteMany({
        where: seededParticipantKeys(SIMULATED_PARTICIPANT_EXTERNAL_ID),
      });

      const participant = await tx.participant.create({
        data: {
          clinicId,
          externalId: dataset.participant.externalId,
          participantCode: dataset.participant.participantCode,
          label: dataset.participant.label,
          source: dataset.participant.source,
          isSimulated: dataset.participant.isSimulated,
          seed: dataset.participant.seed,
          ...liveSchedule,
          takingPart: true,
          ruleCheckConsent: true,
          questionnairesJson: JSON.stringify(["phq9"]),
          tmsCompletedDate: dataset.participant.tmsCompletedDate,
          currentDemoDay: dataset.participant.currentDemoDay,
          group: dataset.participant.group,
          age: dataset.participant.age,
          gender: dataset.participant.gender,
          madrsBaseline: dataset.participant.madrsBaseline,
          madrsEnd: dataset.participant.madrsEnd,
        },
      });

      const participantId = participant.id;

      await tx.measurementConsent.createMany({
        data: dataset.consents.map((c) => {
          const isCore = c.method === "check_in" || c.method === "phq9";
          return {
            participantId,
            clinicId,
            method: c.method,
            broadArea: c.broadArea,
            recordedDescription: c.recordedDescription,
            enabled: isCore ? c.enabled : false,
            isPersonalSign: c.isPersonalSign,
            consentedAt: isCore ? c.consentedAt : null,
            revokedAt: isCore ? c.revokedAt : null,
          };
        }),
      });

      await tx.consentEvent.createMany({
        data: [
          {
            participantId,
            clinicId,
            layer: "taking_part",
            method: null,
            enabled: true,
            noticeVersion: "v1",
          },
          {
            participantId,
            clinicId,
            layer: "rule_check",
            method: null,
            enabled: true,
            noticeVersion: "v1",
          },
          ...dataset.consents.map((c) => ({
            participantId,
            clinicId,
            layer: "method",
            method: c.method,
            enabled: c.enabled,
            noticeVersion: "v1",
          })),
        ],
      });

      await tx.ringDay.createMany({
        data: dataset.ringDays.map((d) => ({
          participantId,
          clinicId,
          date: d.date,
          dayIndex: d.dayIndex,
          ringActive: d.ringActive,
          wearMinutes: d.wearMinutes,
          steps: d.steps,
          activeCaloriesKcal: d.activeCaloriesKcal,
          daytimeMeanActivity: d.daytimeMeanActivity,
          nighttimeMeanActivity: d.nighttimeMeanActivity,
          m10: d.m10,
          l5: d.l5,
          relativeAmplitude: d.relativeAmplitude,
          hourlyActivityJson: d.hourlyActivityJson,
          bedtimeStart: d.bedtimeStart,
          bedtimeEnd: d.bedtimeEnd,
          sleepMidpointMin: d.sleepMidpointMin,
          timeInBedMin: d.timeInBedMin,
          totalSleepMin: d.totalSleepMin,
          onsetLatencyMin: d.onsetLatencyMin,
          wasoMinutes: d.wasoMinutes,
          nightActivityBouts: d.nightActivityBouts,
          lowestHrBpm: d.lowestHrBpm,
          avgHrBpm: d.avgHrBpm,
          avgHrvRmssdMs: d.avgHrvRmssdMs,
          tempDeviationC: d.tempDeviationC,
          sleepWakeGrid: d.sleepWakeGrid,
          sleepPhase5MinRaw: d.sleepPhase5MinRaw,
          isSimulated: d.isSimulated,
          source: d.source,
        })),
      });

      // The 8-week rounds and PHQ-9s of the dataset follow the simulation's
      // own calendar, not this live schedule; the live check-in starts from
      // one calm round instead, so that the rule reads only what was answered.
      await createCalmFirstRound(tx, participantId, clinicId, liveSchedule);

      await tx.rhythmWindow.createMany({
        data: dataset.rhythmWindows.map((w) => ({
          participantId,
          clinicId,
          windowEndDate: w.windowEndDate,
          dayIndex: w.dayIndex,
          windowDays: w.windowDays,
          validDays: w.validDays,
          m10: w.m10,
          l5: w.l5,
          relativeAmplitude: w.relativeAmplitude,
          interdailyStability: w.interdailyStability,
          intradailyVariability: w.intradailyVariability,
          sri: w.sri,
          sleepMidpointSdMin: w.sleepMidpointSdMin,
          wasoMeanMin: w.wasoMeanMin,
          stepsMean: w.stepsMean,
          raZScore: w.raZScore,
          isZScore: w.isZScore,
          sriZScore: w.sriZScore,
          isSimulated: w.isSimulated,
        })),
      });

      await tx.cameraReading.createMany({
        data: dataset.cameraReadings.map((c) => ({
          participantId,
          clinicId,
          recordedAt: c.recordedAt,
          date: c.date,
          dayIndex: c.dayIndex,
          taskId: c.taskId,
          durationSec: c.durationSec,
          sampleRateHz: c.sampleRateHz,
          effectiveFps: c.effectiveFps,
          faceDetectedRatio: c.faceDetectedRatio,
          expressivityScore: c.expressivityScore,
          smileFraction: c.smileFraction,
          mouthSmileMean: c.mouthSmileMean,
          mouthSmileSd: c.mouthSmileSd,
          browInnerUpSd: c.browInnerUpSd,
          browDownSd: c.browDownSd,
          browOuterUpSd: c.browOuterUpSd,
          eyeSquintSd: c.eyeSquintSd,
          cheekSquintSd: c.cheekSquintSd,
          jawOpenSd: c.jawOpenSd,
          blendshapeStatsJson: c.blendshapeStatsJson,
          yawSdDeg: c.yawSdDeg,
          pitchSdDeg: c.pitchSdDeg,
          rollSdDeg: c.rollSdDeg,
          angularPathDegPerMin: c.angularPathDegPerMin,
          translationSd: c.translationSd,
          expressivityZScore: c.expressivityZScore,
          headMovementZScore: c.headMovementZScore,
          isSimulated: c.isSimulated,
          source: c.source,
        })),
      });

      await tx.routineSignalReading.createMany({
        data: dataset.routineReadings.map((r) => ({
          participantId,
          clinicId,
          periodStartDate: r.periodStartDate,
          periodEndDate: r.periodEndDate,
          dayIndex: r.dayIndex,
          channel: r.channel,
          broadArea: r.broadArea,
          derivedValue: r.derivedValue,
          unit: r.unit,
          baselineZScore: r.baselineZScore,
          isSimulated: r.isSimulated,
          source: r.source,
        })),
      });

      await tx.personalBaseline.createMany({
        data: dataset.personalBaselines.map((b) => ({
          participantId,
          clinicId,
          metricName: b.metricName,
          windowStartDate: b.windowStartDate,
          windowEndDate: b.windowEndDate,
          sampleCount: b.sampleCount,
          mean: b.mean,
          sd: b.sd,
          median: b.median,
          iqr: b.iqr,
        })),
      });

      await tx.patientSuggestion.createMany({
        data: dataset.patientSuggestions.map((s) => ({
          participantId,
          clinicId,
          createdAt: s.createdAt,
          date: s.date,
          dayIndex: s.dayIndex,
          reason: s.reason,
          actionKey: s.actionKey,
          actionTitle: s.actionTitle,
          actionDetail: s.actionDetail,
          effortTier: s.effortTier,
          status: s.status,
          respondedAt: s.respondedAt,
          armType: s.armType,
          nextCheckInDelta: s.nextCheckInDelta,
          isSimulated: s.isSimulated,
        })),
      });

      // Give each simulated patient one OPEN suggestion in addition to any history,
      // so the demo starts with something to answer.
      await createSampleSuggestion(tx, participantId, clinicId, now, 0);

      await tx.clinicFlag.createMany({
        data: dataset.clinicFlags.map((f) => ({
          participantId,
          clinicId,
          createdAt: f.createdAt,
          sinceDate: f.sinceDate,
          dayIndex: f.dayIndex,
          triggerKind: f.triggerKind,
          ruleVersion: f.ruleVersion,
          primaryArea: f.primaryArea,
          broadAreasJson: f.broadAreasJson,
          status: f.status,
          ringActiveDuringSilence: f.ringActiveDuringSilence,
          patientSharedDetails: f.patientSharedDetails,
          sharedAt: f.sharedAt,
          isSimulated: f.isSimulated,
        })),
      });

      const sampleParticipantIds = await createSampleParticipants(tx, clinicId, now);

      return {
        participantId,
        externalId: participant.externalId ?? SIMULATED_PARTICIPANT_EXTERNAL_ID,
        nurseStaffId,
        sampleParticipantIds,
        counts: {
          consents: dataset.consents.length,
          ringDays: dataset.ringDays.length,
          checkInRounds: 1,
          phq9Assessments: 0,
          rhythmWindows: dataset.rhythmWindows.length,
          cameraReadings: dataset.cameraReadings.length,
          routineReadings: dataset.routineReadings.length,
          personalBaselines: dataset.personalBaselines.length,
          patientSuggestions: dataset.patientSuggestions.length + 1,
          clinicFlags: dataset.clinicFlags.length,
        },
      };
    });

    return result;
  } finally {
    if (ownClient) {
      await prisma.$disconnect();
    }
  }
}

const isMainModule =
  typeof process !== "undefined" &&
  typeof process.argv[1] === "string" &&
  /[\\/]prisma[\\/]seed\.ts$/.test(process.argv[1]);

if (isMainModule) {
  seedDatabase()
    .then((summary) => {
      console.log(
        `Seeded simulated participant (${summary.externalId}):`,
        JSON.stringify(summary.counts)
      );
    })
    .catch((err) => {
      console.error("Failed to seed database:", err);
      process.exit(1);
    });
}
