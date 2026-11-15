import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import {
  DEFAULT_SIMULATION_SEED,
  generateSimulatedPersonWeeks,
  type SimulatedPersonDataset,
} from "@/lib/simulation";
import { resetDemoClock } from "@/server/api/clock";
import { resetSettings } from "@/server/api/settings";
import { sharedAnswerStore, type InMemoryAnswerStore } from "./answer-store";
import {
  createCalmFirstRound,
  createSampleParticipants,
  createSampleSuggestion,
  type LiveSchedule,
  liveScheduleAt,
  upsertSimClinic,
  upsertSimNurse,
} from "../../../prisma/seed";

export interface ResetOptions {
  /** The moment the live schedules are laid out from; now by default. */
  readonly now?: Date;
  /** In-memory answer store to clear for simulated participants; sharedAnswerStore by default. */
  readonly answerStore?: InMemoryAnswerStore;
}

async function seedParticipantCore(
  tx: Prisma.TransactionClient,
  clinicId: string,
  dataset: SimulatedPersonDataset,
  liveSchedule: LiveSchedule
): Promise<string> {
  const participant = await tx.participant.create({
    data: {
      clinicId,
      externalId: dataset.participant.externalId,
      participantCode: dataset.participant.participantCode,
      label: dataset.participant.label,
      source: dataset.participant.source,
      isSimulated: true,
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
  return participant.id;
}

async function seedConsents(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
  await tx.measurementConsent.createMany({
    data: dataset.consents.map((c) => ({
      participantId,
      clinicId,
      method: c.method,
      broadArea: c.broadArea,
      recordedDescription: c.recordedDescription,
      enabled: c.enabled,
      isPersonalSign: c.isPersonalSign,
      consentedAt: c.consentedAt,
      revokedAt: c.revokedAt,
    })),
  });

  await tx.consentEvent.createMany({
    data: [
      { participantId, clinicId, layer: "taking_part", method: null, enabled: true, noticeVersion: "v1" },
      { participantId, clinicId, layer: "rule_check", method: null, enabled: true, noticeVersion: "v1" },
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
}

async function seedRingDays(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
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
      isSimulated: true,
      source: d.source,
    })),
  });
}

async function seedRhythmWindows(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
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
      isSimulated: true,
    })),
  });
}

async function seedCameraReadings(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
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
      isSimulated: true,
      source: c.source,
    })),
  });
}

async function seedRoutineAndBaselines(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
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
      isSimulated: true,
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
}

async function seedSuggestionsAndFlags(
  tx: Prisma.TransactionClient,
  participantId: string,
  clinicId: string,
  dataset: SimulatedPersonDataset
): Promise<void> {
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
      isSimulated: true,
    })),
  });

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
      isSimulated: true,
    })),
  });
}

/**
 * Deletes what simulated patients gathered (check-ins, PHQ-9 and GAD-7 totals,
 * rounds, warnings, crisis events, nurse calls, consent events) and puts back
 * the seeded state.
 *
 * Touches only rows of participants marked simulated, in one transaction.
 * Also zeroes the demo clock offset and puts switches back to their defaults.
 */
export async function resetSimulatedData(
  prisma: PrismaClient = getPrisma(),
  options: ResetOptions = {}
): Promise<void> {
  resetDemoClock();
  resetSettings();

  const now = options.now ?? new Date();
  const answerStore = options.answerStore ?? sharedAnswerStore;
  const dataset = generateSimulatedPersonWeeks({ seed: DEFAULT_SIMULATION_SEED });
  const liveSchedule = liveScheduleAt(now, 2);

  let simulatedIdsToDelete: string[] = [];

  await prisma.$transaction(async (tx) => {
    const existingSimulated = await tx.participant.findMany({
      where: { isSimulated: true },
      select: { id: true },
    });
    simulatedIdsToDelete = existingSimulated.map((p) => p.id);

    if (simulatedIdsToDelete.length > 0) {
      await tx.webhookCredential.deleteMany({
        where: { participantId: { in: simulatedIdsToDelete } },
      });
    }

    await tx.participant.deleteMany({ where: { isSimulated: true } });

    const clinicId = await upsertSimClinic(tx);
    await upsertSimNurse(tx, clinicId);

    const participantId = await seedParticipantCore(tx, clinicId, dataset, liveSchedule);
    await seedConsents(tx, participantId, clinicId, dataset);
    await seedRingDays(tx, participantId, clinicId, dataset);
    await seedRhythmWindows(tx, participantId, clinicId, dataset);
    await createCalmFirstRound(tx, participantId, clinicId, liveSchedule);
    await seedCameraReadings(tx, participantId, clinicId, dataset);
    await seedRoutineAndBaselines(tx, participantId, clinicId, dataset);
    await seedSuggestionsAndFlags(tx, participantId, clinicId, dataset);
    await createSampleSuggestion(tx, participantId, clinicId, now, 0);
    await createSampleParticipants(tx, clinicId, now);
  });

  clearSimulatedAnswers(simulatedIdsToDelete, answerStore);
}

/**
 * Clears in-memory questionnaire answers for the given simulated patient IDs.
 * Called when resetting demo data and when advancing the demo clock.
 */
export function clearSimulatedAnswers(
  patientIds: readonly string[],
  answerStore: InMemoryAnswerStore = sharedAnswerStore
): void {
  answerStore.deleteForPatients(patientIds);
}
