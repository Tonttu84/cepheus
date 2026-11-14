import type { PrismaClient } from "@prisma/client";
import { decideAccess, type Actor, type Purpose } from "@/domain/access";
import type { ConsentState } from "@/domain/consent";
import { computeRhythmWindow, type DayWindowInput } from "@/domain/signals";
import type { EvaluatedArduinoEdgeIngest } from "@/domain/arduino";
import { MEASUREMENT_METHODS } from "@/lib/constants";
import { getPrisma } from "@/lib/db";

/**
 * DEMO-ONLY PARTICIPANT SCOPING:
 * All home-sensor and wearable demo streams currently map to this single
 * pseudonymous demo participant (no real patient data). Once Step 6
 * (Better Auth patient & staff sessions) is merged, replace this fixed
 * lookup with the authenticated session's `patientId` and `clinicId`.
 */
export const HOME_DEMO_EXTERNAL_ID = "demo-home-node-01";
export const DEMO_CLINIC_ID = "demo-clinic";

const MONITORED_METHODS = ["ring_rhythm", "camera_expressivity", "home_routine"] as const;
const ALL_CONSENT_METHODS = [
  "check_in",
  "phq9",
  "ring_rhythm",
  "camera_expressivity",
  "home_routine",
] as const;
export type MonitoredMethodKey = (typeof ALL_CONSENT_METHODS)[number];

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

export interface MonitoringConsentSummary {
  method: string;
  label: string;
  broadArea: string;
  recordedDescription: string;
  enabled: boolean;
}

export interface MonitoringSummaryPayload {
  demoOnly: true;
  participantExternalId: string;
  viewerKind: "patient" | "staff";
  readingsRedactedForStaff: boolean;
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
  staffBroadAreaFlags: Array<{
    sinceDate: string;
    primaryArea: string;
    status: string;
  }>;
}

export interface LoadedConsentContext {
  consentState: ConsentState;
  methodFlags: Record<MonitoredMethodKey, boolean>;
}

function makePatientActor(patientId: string): Actor {
  return { kind: "patient", patientId, clinicId: DEMO_CLINIC_ID };
}

function makeStaffActor(): Actor {
  return {
    kind: "staff",
    staffId: "demo-nurse-01",
    clinicId: DEMO_CLINIC_ID,
    role: "nurse",
  };
}

export async function loadConsentContext(
  participantId: string,
  prisma: PrismaClient
): Promise<LoadedConsentContext> {
  const rows = await prisma.measurementConsent.findMany({
    where: {
      participantId,
      method: { in: [...ALL_CONSENT_METHODS] },
    },
  });

  const flagOf = (key: MonitoredMethodKey): boolean =>
    Boolean(rows.find((r) => r.method === key)?.enabled);

  const checkIn = flagOf("check_in");
  const phq9 = flagOf("phq9");
  const ring = flagOf("ring_rhythm");
  const camera = flagOf("camera_expressivity");
  const routine = flagOf("home_routine");

  return {
    methodFlags: {
      check_in: checkIn,
      phq9,
      ring_rhythm: ring,
      camera_expressivity: camera,
      home_routine: routine,
    },
    consentState: {
      taking_part: checkIn || phq9,
      methods: {
        ring,
        camera: camera || routine,
      },
      rule_check: false,
    },
  };
}

function assertDomainAccess(params: {
  actor: Actor;
  action: "read" | "write";
  kind: "readings" | "consent" | "flags";
  patientId: string;
  purpose: Purpose;
  consent: ConsentState;
  method?: "ring" | "camera";
}): { allowed: true } | { allowed: false; reason: string } {
  const res = decideAccess({
    actor: params.actor,
    action: params.action,
    target: {
      kind: params.kind,
      patientId: params.patientId,
      clinicId: DEMO_CLINIC_ID,
      method: params.method,
    },
    purpose: params.purpose,
    consent: params.consent,
  });
  if (!res.ok) {
    return { allowed: false, reason: res.error };
  }
  if (!res.value.allowed) {
    return { allowed: false, reason: res.value.reason };
  }
  return { allowed: true };
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
        label: "Home Demo Node (Arduino UNO Q & Wearable)",
        source: "live",
        isSimulated: false,
      },
    });
  }

  for (const methodKey of ALL_CONSENT_METHODS) {
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

export async function updateMethodConsent(
  method: MonitoredMethodKey,
  enabled: boolean,
  prisma: PrismaClient = getPrisma()
): Promise<MonitoringConsentSummary> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const { consentState } = await loadConsentContext(participant.id, prisma);
  const access = assertDomainAccess({
    actor: makePatientActor(participant.id),
    action: "write",
    kind: "consent",
    patientId: participant.id,
    purpose: "self_access",
    consent: consentState,
  });
  if (!access.allowed) {
    throw new Error(`Access denied updating consent: ${access.reason}`);
  }

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

async function upsertRingDays(
  participantId: string,
  days: readonly WearableDayInput[],
  options: { isSimulated: boolean; sourceLabel: string },
  prisma: PrismaClient
): Promise<void> {
  for (const day of days) {
    const shared = {
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
    };

    await prisma.ringDay.upsert({
      where: { participantId_date: { participantId, date: day.date } },
      update: shared,
      create: { participantId, date: day.date, ...shared },
    });
  }
}

async function recomputeAndSaveRhythmWindow(
  participantId: string,
  isSimulated: boolean,
  prisma: PrismaClient
): Promise<{ computed: boolean; error?: string }> {
  const recentRows = await prisma.ringDay.findMany({
    where: { participantId },
    orderBy: { date: "asc" },
    take: 14,
  });

  const windowSlice = recentRows.slice(-7);
  if (windowSlice.length < 7) {
    return {
      computed: false,
      error: `Need at least 7 days for rolling rhythm metrics (have ${windowSlice.length}).`,
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
    isSimulated,
  }));

  const rhythmRes = computeRhythmWindow(windowInputs);
  if (!rhythmRes.ok) {
    return { computed: false, error: rhythmRes.error };
  }

  const rw = rhythmRes.value;
  const fields = {
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
    isSimulated,
  };

  await prisma.rhythmWindow.upsert({
    where: {
      participantId_windowEndDate_windowDays: {
        participantId,
        windowEndDate: rw.windowEndDate,
        windowDays: rw.windowDays,
      },
    },
    update: fields,
    create: {
      participantId,
      windowEndDate: rw.windowEndDate,
      windowDays: rw.windowDays,
      ...fields,
    },
  });

  return { computed: true };
}

/**
 * Persists Fitbit or Health Connect wearable days into RingDay and computes a rolling RhythmWindow.
 * Enforces `decideAccess` + `ring_rhythm` consent before writing.
 */
export async function saveWearableDaysAndComputeRhythm(
  days: readonly WearableDayInput[],
  options: { isSimulated: boolean; sourceLabel: string },
  prisma: PrismaClient = getPrisma()
): Promise<
  | { ok: true; savedDays: number; rhythmComputed: boolean; rhythmError?: string }
  | { ok: false; status: 403; error: string }
> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const { consentState } = await loadConsentContext(participant.id, prisma);

  const access = assertDomainAccess({
    actor: makePatientActor(participant.id),
    action: "write",
    kind: "readings",
    patientId: participant.id,
    purpose: "method:ring",
    consent: consentState,
    method: "ring",
  });
  if (!access.allowed) {
    return {
      ok: false,
      status: 403,
      error: "Wearable rhythm monitoring consent is currently switched off.",
    };
  }

  await upsertRingDays(participant.id, days, options, prisma);
  const rhythm = await recomputeAndSaveRhythmWindow(
    participant.id,
    options.isSimulated,
    prisma
  );

  return {
    ok: true,
    savedDays: days.length,
    rhythmComputed: rhythm.computed,
    rhythmError: rhythm.error,
  };
}

/**
 * Persists derived Arduino UNO Q camera & routine metrics after enforcing `decideAccess`
 * and per-method consent.
 */
export async function saveArduinoEdgeIngest(
  ingest: EvaluatedArduinoEdgeIngest,
  prisma: PrismaClient = getPrisma()
): Promise<
  | {
      ok: true;
      savedCamera: boolean;
      savedRoutineCount: number;
      skippedForConsent: string[];
    }
  | { ok: false; status: 403; error: string }
> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const { consentState, methodFlags } = await loadConsentContext(participant.id, prisma);

  const access = assertDomainAccess({
    actor: makePatientActor(participant.id),
    action: "write",
    kind: "readings",
    patientId: participant.id,
    purpose: "method:camera",
    consent: consentState,
    method: "camera",
  });
  if (!access.allowed) {
    return {
      ok: false,
      status: 403,
      error: "Camera and home routine monitoring consents are currently switched off.",
    };
  }

  const skippedForConsent: string[] = [];
  let savedCamera = false;
  let savedRoutineCount = 0;

  if (ingest.cameraReading) {
    if (!methodFlags.camera_expressivity) {
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
    if (!methodFlags.home_routine) {
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

  return { ok: true, savedCamera, savedRoutineCount, skippedForConsent };
}

function formatConsentSummaries(
  rows: Array<{ method: string; broadArea: string; recordedDescription: string; enabled: boolean }>
): MonitoringConsentSummary[] {
  return MONITORED_METHODS.map((methodKey) => {
    const row = rows.find((c) => c.method === methodKey);
    const meta = MEASUREMENT_METHODS.find((m) => m.method === methodKey);
    return {
      method: methodKey,
      label: meta?.label ?? methodKey,
      broadArea: row?.broadArea ?? meta?.broadArea ?? "daily_routine",
      recordedDescription: row?.recordedDescription ?? meta?.recordedDescription ?? "",
      enabled: row?.enabled ?? true,
    };
  });
}

async function loadStaffRedactedSummary(
  participantId: string,
  actor: Actor,
  consentState: ConsentState,
  consents: MonitoringConsentSummary[],
  prisma: PrismaClient
): Promise<MonitoringSummaryPayload> {
  const flagsAccess = assertDomainAccess({
    actor,
    action: "read",
    kind: "flags",
    patientId: participantId,
    purpose: "care",
    consent: consentState,
  });
  const flags = flagsAccess.allowed
    ? await prisma.clinicFlag.findMany({
        where: { participantId },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  return {
    demoOnly: true,
    participantExternalId: HOME_DEMO_EXTERNAL_ID,
    viewerKind: "staff",
    readingsRedactedForStaff: true,
    consents,
    latestRhythmWindow: null,
    recentWearableDays: [],
    recentCameraReadings: [],
    recentRoutineReadings: [],
    staffBroadAreaFlags: flags.map((f) => ({
      sinceDate: f.sinceDate,
      primaryArea: f.primaryArea,
      status: f.status,
    })),
  };
}

/**
 * Reads the demo participant's monitoring summary after checking `decideAccess`.
 * When `viewerKind === "staff"`, `decideAccess` refuses raw clinical readings (D8),
 * returning only broad-area flags with all sensor numbers redacted.
 */
export async function getMonitoringSummary(
  viewerKind: "patient" | "staff" = "patient",
  prisma: PrismaClient = getPrisma()
): Promise<MonitoringSummaryPayload> {
  const participant = await ensureHomeDemoParticipant(prisma);
  const { consentState } = await loadConsentContext(participant.id, prisma);

  const actor =
    viewerKind === "staff" ? makeStaffActor() : makePatientActor(participant.id);
  const purpose = viewerKind === "staff" ? "care" : "self_access";

  const ringRead = assertDomainAccess({
    actor,
    action: "read",
    kind: "readings",
    method: "ring",
    patientId: participant.id,
    purpose,
    consent: consentState,
  });
  const cameraRead = assertDomainAccess({
    actor,
    action: "read",
    kind: "readings",
    method: "camera",
    patientId: participant.id,
    purpose,
    consent: consentState,
  });

  const consentsRows = await prisma.measurementConsent.findMany({
    where: { participantId: participant.id, method: { in: [...MONITORED_METHODS] } },
  });
  const consents = formatConsentSummaries(consentsRows);

  if (!ringRead.allowed && !cameraRead.allowed) {
    return loadStaffRedactedSummary(
      participant.id,
      actor,
      consentState,
      consents,
      prisma
    );
  }

  const [rhythmWindow, ringDays, cameraReadings, routineReadings] = await Promise.all([
    ringRead.allowed
      ? prisma.rhythmWindow.findFirst({
          where: { participantId: participant.id },
          orderBy: { windowEndDate: "desc" },
        })
      : Promise.resolve(null),
    ringRead.allowed
      ? prisma.ringDay.findMany({
          where: { participantId: participant.id },
          orderBy: { date: "desc" },
          take: 7,
        })
      : Promise.resolve([]),
    cameraRead.allowed
      ? prisma.cameraReading.findMany({
          where: { participantId: participant.id },
          orderBy: { recordedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    cameraRead.allowed
      ? prisma.routineSignalReading.findMany({
          where: { participantId: participant.id },
          orderBy: { id: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  return {
    demoOnly: true,
    participantExternalId: participant.externalId ?? HOME_DEMO_EXTERNAL_ID,
    viewerKind,
    readingsRedactedForStaff: false,
    consents,
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
    staffBroadAreaFlags: [],
  };
}
