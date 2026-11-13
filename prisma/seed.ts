import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_SIMULATION_SEED,
  generateSimulatedPersonWeeks,
  SIMULATED_PARTICIPANT_EXTERNAL_ID,
} from "../src/lib/simulation";

export async function seedDatabase(client?: PrismaClient): Promise<{
  participantId: string;
  externalId: string;
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

    const result = await prisma.$transaction(async (tx) => {
      // Remove any existing simulated participant with this externalId (cascade cleans children)
      await tx.participant.deleteMany({
        where: { externalId: SIMULATED_PARTICIPANT_EXTERNAL_ID },
      });

      const participant = await tx.participant.create({
        data: {
          externalId: dataset.participant.externalId,
          label: dataset.participant.label,
          source: dataset.participant.source,
          isSimulated: dataset.participant.isSimulated,
          seed: dataset.participant.seed,
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
        data: dataset.consents.map((c) => ({
          participantId,
          method: c.method,
          broadArea: c.broadArea,
          recordedDescription: c.recordedDescription,
          enabled: c.enabled,
          isPersonalSign: c.isPersonalSign,
          consentedAt: c.consentedAt,
          revokedAt: c.revokedAt,
        })),
      });

      await tx.ringDay.createMany({
        data: dataset.ringDays.map((d) => ({
          participantId,
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

      await tx.checkInRound.createMany({
        data: dataset.checkInRounds.map((r) => ({
          participantId,
          scheduledAt: r.scheduledAt,
          respondedAt: r.respondedAt,
          date: r.date,
          dayIndex: r.dayIndex,
          weekNumber: r.weekNumber,
          roundNumber: r.roundNumber,
          status: r.status,
          moodScore: r.moodScore,
          interestScore: r.interestScore,
          energyScore: r.energyScore,
          ruminationScore: r.ruminationScore,
          compositeScore: r.compositeScore,
          singleItemScore: r.singleItemScore,
          itemOrderJson: r.itemOrderJson,
          freeTextNote: r.freeTextNote,
          selfHarmTriggered: r.selfHarmTriggered,
          crisisPathShown: r.crisisPathShown,
          responseLatencyMs: r.responseLatencyMs,
          ringActiveAtRound: r.ringActiveAtRound,
          isSimulated: r.isSimulated,
          source: r.source,
        })),
      });

      await tx.phq9Assessment.createMany({
        data: dataset.phq9Assessments.map((p) => ({
          participantId,
          scheduledAt: p.scheduledAt,
          completedAt: p.completedAt,
          date: p.date,
          dayIndex: p.dayIndex,
          weekNumber: p.weekNumber,
          status: p.status,
          totalScore: p.totalScore,
          item1Interest: p.item1Interest,
          item2Mood: p.item2Mood,
          item3Sleep: p.item3Sleep,
          item4Energy: p.item4Energy,
          item5Appetite: p.item5Appetite,
          item6SelfWorth: p.item6SelfWorth,
          item7Concentration: p.item7Concentration,
          item8Psychomotor: p.item8Psychomotor,
          item9SelfHarm: p.item9SelfHarm,
          crisisPathShown: p.crisisPathShown,
          baselineDelta: p.baselineDelta,
          isSimulated: p.isSimulated,
          source: p.source,
        })),
      });

      await tx.rhythmWindow.createMany({
        data: dataset.rhythmWindows.map((w) => ({
          participantId,
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
          preMoodScore: s.preMoodScore,
          postMoodScore: s.postMoodScore,
          nextCheckInDelta: s.nextCheckInDelta,
          isSimulated: s.isSimulated,
        })),
      });

      await tx.clinicFlag.createMany({
        data: dataset.clinicFlags.map((f) => ({
          participantId,
          createdAt: f.createdAt,
          sinceDate: f.sinceDate,
          dayIndex: f.dayIndex,
          triggerKind: f.triggerKind,
          primaryArea: f.primaryArea,
          broadAreasJson: f.broadAreasJson,
          status: f.status,
          ringActiveDuringSilence: f.ringActiveDuringSilence,
          patientSharedDetails: f.patientSharedDetails,
          sharedAt: f.sharedAt,
          isSimulated: f.isSimulated,
        })),
      });

      return {
        participantId,
        externalId: participant.externalId ?? SIMULATED_PARTICIPANT_EXTERNAL_ID,
        counts: {
          consents: dataset.consents.length,
          ringDays: dataset.ringDays.length,
          checkInRounds: dataset.checkInRounds.length,
          phq9Assessments: dataset.phq9Assessments.length,
          rhythmWindows: dataset.rhythmWindows.length,
          cameraReadings: dataset.cameraReadings.length,
          routineReadings: dataset.routineReadings.length,
          personalBaselines: dataset.personalBaselines.length,
          patientSuggestions: dataset.patientSuggestions.length,
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
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

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
