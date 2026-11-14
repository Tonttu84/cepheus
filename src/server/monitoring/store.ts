import type { PrismaClient } from "@prisma/client";
import type { EvaluatedArduinoEdgeIngest } from "@/domain/arduino";
import { computeRhythmWindow, type DayWindowInput } from "@/domain/signals";
import { MEASUREMENT_METHODS } from "@/lib/constants";
import { getPrisma } from "@/lib/db";

export interface WearableDayInput {
  readonly date: string;
  readonly dayIndex: number;
  readonly ringActive: boolean;
  readonly wearMinutes: number;
  readonly steps: number | null;
  readonly activeCaloriesKcal: number | null;
  readonly hourlyActivity: readonly (number | null)[];
  readonly bedtimeStartIso: string | null;
  readonly bedtimeEndIso: string | null;
  readonly sleepMidpointMin: number | null;
  readonly timeInBedMin: number | null;
  readonly totalSleepMin: number | null;
  readonly wasoMinutes: number | null;
  readonly nightActivityBouts: number | null;
  readonly lowestHrBpm: number | null;
  readonly avgHrBpm: number | null;
  readonly avgHrvRmssdMs?: number | null;
  readonly sleepWakeGrid: string | null;
}

export const HOME_DEMO_EXTERNAL_ID = "demo-home-node-01";

const MONITORED_METHODS = ["ring_rhythm", "camera_expressivity", "home_routine"] as const;
export type MonitoredMethodKey = (typeof MONITORED_METHODS)[number];

export interface MonitoringConsentSummary {
  method: string;
  label: string;
  broadArea: string;
  recordedDescription: string;
  enabled: boolean;
}

export interface MonitoringSummaryPayload {
  participantExternalId: string;
  consents: MonitoringConsentSummary[];
  latestRhythmWindow: {
    windowEndDate: string;
    validDays: number;
    relativeAmplitude: number;
    interdailyStability: number;
    intradailyVariability: number;
    sri: number | null;
    sleepMidpointSdMin: number | null;
    stepsMean: number | null;
    isSimulated: boolean;
  } | null;
  recentWearableDays: Array<{
    date: string;
    ringActive: boolean;
    steps: number | null;
    totalSleepMin: number | null;
    wasoMinutes: number | null;
    avgHrBpm: number | null;
    avgHrvRmssdMs: number | null;
    source: string;
    isSimulated: boolean;
  }>;
  recentCameraReadings: Array<{
    date: string;
    taskId: string;
    durationSec: number;
    effectiveFps: number;
    faceDetectedRatio: number;
    expressivityScore: number;
    angularPathDegPerMin: number;
    source: string;
    isSimulated: boolean;
  }>;
  recentRoutineReadings: Array<{
    periodEndDate: string;
    channel: string;
    broadArea: string;
    derivedValue: number;
    unit: string;
    source: string;
    isSimulated: boolean;
  }>;
}

/**
 * Ensures the pseudonymous home-node demo participant and its per-method
 * consent rows exist in PostgreSQL. Never stores real names or PII.
 */
export async function ensureHomeDemoParticipant(prisma: PrismaClient = getPrisma()) {
  let participant = await prisma.participant.findUnique({
    where: { externalId: HOME_DEMO_EXTERNAL_ID },
  });

  if (!participant) {
    participant = await prisma.participant.create({
      data: {
        externalId: HOME_DEMO_EXTERNAL_ID,
        label: "Home Demo Node (Arduino UNO Q & Fitbit)",
        source: "live",
        isSimulated: false,
      },
    });
  }

  for (const methodKey of MONITORED_METHODS) {
    const meta = MEASUREMENT_METHODS.find((m) => m.method === methodKey);
    await prisma.measurementConsent.upsert({
      where: {
        participantId_method: {
          participantId: participant.id,
          method: methodKey,
        },
      },
      update: {},
      create: {
        participantId: participant.id,
        method: methodKey,
        broadArea: meta?.broadArea ?? "daily_routine",
        recordedDescription:
          meta?.recordedDescription ??
          "Derived numerical summaries only; video/audio never leave the device.",
        enabled: true,
        isPersonalSign: meta?.isPersonalSignDefault ?? false,
        consentedAt: new Date(),
      },
    });
  }

  return participant;
}

export async function isMethodConsented(
  participantId: string,
  method: MonitoredMethodKey,
  prisma: PrismaClient = getPrisma()
): Promise<boolean> {
  const row = await prisma.measurementConsent.findUnique({
    where: {
      participantId_method: {
        participantId,
        method,
      },
    },
  });
  return Boolean(row?.enabled);
}

export async function updateMethodConsent(
  method: MonitoredMethodKey,
  enabled: boolean,
  prisma: PrismaClient = getPrisma()
): Promise<MonitoringConsentSummary> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const updated = await prisma.measurementConsent.update({
    where: {
      participantId_method: {
        participantId: participant.id,
        method,
      },
    },
    data: {
      enabled,
      consentedAt: enabled ? new Date() : undefined,
      revokedAt: enabled ? null : new Date(),
    },
  });
  const meta = MEASUREMENT_METHODS.find((m) => m.method === method);
  return {
    method: updated.method,
    label: meta?.label ?? updated.method,
    broadArea: updated.broadArea,
    recordedDescription: updated.recordedDescription,
    enabled: updated.enabled,
  };
}

/**
 * Persists Fitbit or simulated wearable days into RingDay and computes a rolling RhythmWindow.
 * Enforces `ring_rhythm` consent before writing.
 */
export async function saveWearableDaysAndComputeRhythm(
  days: readonly WearableDayInput[],
  options: { isSimulated: boolean; sourceLabel: string },
  prisma: PrismaClient = getPrisma()
): Promise<
  | {
      ok: true;
      savedDays: number;
      rhythmComputed: boolean;
      rhythmError?: string;
    }
  | { ok: false; status: 403; error: string }
> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const consented = await isMethodConsented(participant.id, "ring_rhythm", prisma);
  if (!consented) {
    return {
      ok: false,
      status: 403,
      error: "Wearable rhythm monitoring consent is currently switched off.",
    };
  }

  for (const day of days) {
    await prisma.ringDay.upsert({
      where: {
        participantId_date: {
          participantId: participant.id,
          date: day.date,
        },
      },
      update: {
        dayIndex: day.dayIndex,
        ringActive: day.ringActive,
        wearMinutes: day.wearMinutes,
        steps: day.steps,
        activeCaloriesKcal: day.activeCaloriesKcal,
        hourlyActivityJson: JSON.stringify(day.hourlyActivity),
        bedtimeStart: day.bedtimeStartIso ? new Date(day.bedtimeStartIso) : null,
        bedtimeEnd: day.bedtimeEndIso ? new Date(day.bedtimeEndIso) : null,
        sleepMidpointMin: day.sleepMidpointMin,
        timeInBedMin: day.timeInBedMin,
        totalSleepMin: day.totalSleepMin,
        wasoMinutes: day.wasoMinutes,
        nightActivityBouts: day.nightActivityBouts,
        lowestHrBpm: day.lowestHrBpm,
        avgHrBpm: day.avgHrBpm,
        avgHrvRmssdMs: day.avgHrvRmssdMs ?? null,
        sleepWakeGrid: day.sleepWakeGrid,
        isSimulated: options.isSimulated,
        source: options.sourceLabel,
      },
      create: {
        participantId: participant.id,
        date: day.date,
        dayIndex: day.dayIndex,
        ringActive: day.ringActive,
        wearMinutes: day.wearMinutes,
        steps: day.steps,
        activeCaloriesKcal: day.activeCaloriesKcal,
        hourlyActivityJson: JSON.stringify(day.hourlyActivity),
        bedtimeStart: day.bedtimeStartIso ? new Date(day.bedtimeStartIso) : null,
        bedtimeEnd: day.bedtimeEndIso ? new Date(day.bedtimeEndIso) : null,
        sleepMidpointMin: day.sleepMidpointMin,
        timeInBedMin: day.timeInBedMin,
        totalSleepMin: day.totalSleepMin,
        wasoMinutes: day.wasoMinutes,
        nightActivityBouts: day.nightActivityBouts,
        lowestHrBpm: day.lowestHrBpm,
        avgHrBpm: day.avgHrBpm,
        avgHrvRmssdMs: day.avgHrvRmssdMs ?? null,
        sleepWakeGrid: day.sleepWakeGrid,
        isSimulated: options.isSimulated,
        source: options.sourceLabel,
      },
    });
  }

  const recentRows = await prisma.ringDay.findMany({
    where: { participantId: participant.id },
    orderBy: { date: "asc" },
    take: 14,
  });

  const windowSlice = recentRows.slice(-7);
  if (windowSlice.length < 7) {
    return {
      ok: true,
      savedDays: days.length,
      rhythmComputed: false,
      rhythmError: `Need at least 7 days for rolling rhythm metrics (have ${windowSlice.length}).`,
    };
  }

  const windowInputs: DayWindowInput[] = windowSlice.map((row, idx) => ({
    date: row.date,
    dayIndex: idx + 1,
    hourlyActivity: row.hourlyActivityJson ?? JSON.stringify(new Array(24).fill(null)),
    sleepWakeGrid: row.sleepWakeGrid,
    sleepMidpointMin: row.sleepMidpointMin,
    wasoMinutes: row.wasoMinutes,
    steps: row.steps,
    isSimulated: options.isSimulated,
  }));

  const rhythmRes = computeRhythmWindow(windowInputs);
  if (!rhythmRes.ok) {
    return {
      ok: true,
      savedDays: days.length,
      rhythmComputed: false,
      rhythmError: rhythmRes.error,
    };
  }

  const rw = rhythmRes.value;
  await prisma.rhythmWindow.upsert({
    where: {
      participantId_windowEndDate_windowDays: {
        participantId: participant.id,
        windowEndDate: rw.windowEndDate,
        windowDays: rw.windowDays,
      },
    },
    update: {
      dayIndex: rw.dayIndex,
      validDays: rw.validDays,
      m10: rw.m10,
      l5: rw.l5,
      relativeAmplitude: rw.relativeAmplitude,
      interdailyStability: rw.interdailyStability,
      intradailyVariability: rw.intradailyVariability,
      sri: rw.sri,
      sleepMidpointSdMin: rw.sleepMidpointSdMin,
      wasoMeanMin: rw.wasoMeanMin,
      stepsMean: rw.stepsMean,
      isSimulated: options.isSimulated,
    },
    create: {
      participantId: participant.id,
      windowEndDate: rw.windowEndDate,
      dayIndex: rw.dayIndex,
      windowDays: rw.windowDays,
      validDays: rw.validDays,
      m10: rw.m10,
      l5: rw.l5,
      relativeAmplitude: rw.relativeAmplitude,
      interdailyStability: rw.interdailyStability,
      intradailyVariability: rw.intradailyVariability,
      sri: rw.sri,
      sleepMidpointSdMin: rw.sleepMidpointSdMin,
      wasoMeanMin: rw.wasoMeanMin,
      stepsMean: rw.stepsMean,
      isSimulated: options.isSimulated,
    },
  });

  return {
    ok: true,
    savedDays: days.length,
    rhythmComputed: true,
  };
}

/**
 * Persists derived Arduino UNO Q camera & routine metrics after enforcing per-method consent.
 */
export async function saveArduinoEdgeIngest(
  ingest: EvaluatedArduinoEdgeIngest,
  prisma: PrismaClient = getPrisma()
): Promise<{
  savedCamera: boolean;
  savedRoutineCount: number;
  skippedForConsent: string[];
}> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const skippedForConsent: string[] = [];
  let savedCamera = false;
  let savedRoutineCount = 0;

  if (ingest.cameraReading) {
    const camAllowed = await isMethodConsented(
      participant.id,
      "camera_expressivity",
      prisma
    );
    if (!camAllowed) {
      skippedForConsent.push("camera_expressivity");
    } else {
      const c = ingest.cameraReading;
      await prisma.cameraReading.create({
        data: {
          participantId: participant.id,
          date: ingest.date,
          taskId: c.taskId,
          durationSec: c.durationSec,
          sampleRateHz: c.sampleRateHz,
          effectiveFps: c.effectiveFps,
          faceDetectedRatio: c.faceDetectedRatio,
          expressivityScore: c.expressivityScore,
          smileFraction: c.smileFraction,
          yawSdDeg: c.yawSdDeg,
          pitchSdDeg: c.pitchSdDeg,
          rollSdDeg: c.rollSdDeg,
          angularPathDegPerMin: c.angularPathDegPerMin,
          isSimulated: c.isSimulated,
          source: c.source,
        },
      });
      savedCamera = true;
    }
  }

  if (ingest.routineReadings.length > 0) {
    const routineAllowed = await isMethodConsented(
      participant.id,
      "home_routine",
      prisma
    );
    if (!routineAllowed) {
      skippedForConsent.push("home_routine");
    } else {
      await prisma.routineSignalReading.createMany({
        data: ingest.routineReadings.map((r) => ({
          participantId: participant.id,
          periodStartDate: ingest.date,
          periodEndDate: ingest.date,
          channel: r.channel,
          broadArea: r.broadArea,
          derivedValue: r.derivedValue,
          unit: r.unit,
          isSimulated: r.isSimulated,
          source: r.source,
        })),
      });
      savedRoutineCount = ingest.routineReadings.length;
    }
  }

  return {
    savedCamera,
    savedRoutineCount,
    skippedForConsent,
  };
}

export async function getMonitoringSummary(
  prisma: PrismaClient = getPrisma()
): Promise<MonitoringSummaryPayload> {
  const participant = await ensureHomeDemoParticipant(prisma);

  const [consents, rhythmWindow, ringDays, cameraReadings, routineReadings] =
    await Promise.all([
      prisma.measurementConsent.findMany({
        where: {
          participantId: participant.id,
          method: { in: [...MONITORED_METHODS] },
        },
      }),
      prisma.rhythmWindow.findFirst({
        where: { participantId: participant.id },
        orderBy: { windowEndDate: "desc" },
      }),
      prisma.ringDay.findMany({
        where: { participantId: participant.id },
        orderBy: { date: "desc" },
        take: 7,
      }),
      prisma.cameraReading.findMany({
        where: { participantId: participant.id },
        orderBy: { recordedAt: "desc" },
        take: 5,
      }),
      prisma.routineSignalReading.findMany({
        where: { participantId: participant.id },
        orderBy: { id: "desc" },
        take: 6,
      }),
    ]);

  return {
    participantExternalId: participant.externalId ?? HOME_DEMO_EXTERNAL_ID,
    consents: MONITORED_METHODS.map((methodKey) => {
      const row = consents.find((c) => c.method === methodKey);
      const meta = MEASUREMENT_METHODS.find((m) => m.method === methodKey);
      return {
        method: methodKey,
        label: meta?.label ?? methodKey,
        broadArea: row?.broadArea ?? meta?.broadArea ?? "daily_routine",
        recordedDescription:
          row?.recordedDescription ?? meta?.recordedDescription ?? "",
        enabled: row?.enabled ?? true,
      };
    }),
    latestRhythmWindow: rhythmWindow
      ? {
          windowEndDate: rhythmWindow.windowEndDate,
          validDays: rhythmWindow.validDays,
          relativeAmplitude: rhythmWindow.relativeAmplitude,
          interdailyStability: rhythmWindow.interdailyStability,
          intradailyVariability: rhythmWindow.intradailyVariability,
          sri: rhythmWindow.sri,
          sleepMidpointSdMin: rhythmWindow.sleepMidpointSdMin,
          stepsMean: rhythmWindow.stepsMean,
          isSimulated: rhythmWindow.isSimulated,
        }
      : null,
    recentWearableDays: ringDays.map((d) => ({
      date: d.date,
      ringActive: d.ringActive,
      steps: d.steps,
      totalSleepMin: d.totalSleepMin,
      wasoMinutes: d.wasoMinutes,
      avgHrBpm: d.avgHrBpm,
      avgHrvRmssdMs: d.avgHrvRmssdMs,
      source: d.source,
      isSimulated: d.isSimulated,
    })),
    recentCameraReadings: cameraReadings.map((c) => ({
      date: c.date,
      taskId: c.taskId,
      durationSec: c.durationSec,
      effectiveFps: c.effectiveFps,
      faceDetectedRatio: c.faceDetectedRatio,
      expressivityScore: c.expressivityScore,
      angularPathDegPerMin: c.angularPathDegPerMin,
      source: c.source,
      isSimulated: c.isSimulated,
    })),
    recentRoutineReadings: routineReadings.map((r) => ({
      periodEndDate: r.periodEndDate,
      channel: r.channel,
      broadArea: r.broadArea,
      derivedValue: r.derivedValue,
      unit: r.unit,
      source: r.source,
      isSimulated: r.isSimulated,
    })),
  };
}
