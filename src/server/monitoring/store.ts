import type { PrismaClient } from "@prisma/client";
import { decideAccess, type Actor, type Purpose } from "@/domain/access";
import type { ConsentState } from "@/domain/consent";
import { computeRhythmWindow, type DayWindowInput } from "@/domain/signals";
import type { EvaluatedArduinoEdgeIngest } from "@/domain/arduino";
import type {
  AuthSession,
  PatientAuthSession,
  StaffAuthSession,
} from "@/lib/auth-types";
import { MEASUREMENT_METHODS } from "@/lib/constants";
import { getPrisma } from "@/lib/db";
import { resolveMonitoringTarget } from "@/server/db/monitoring/session-scope";

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
export const ALL_CONSENT_METHODS = [
  "check_in",
  "phq9",
  "ring_rhythm",
  "camera_expressivity",
  "home_routine",
  "detailed_answers",
  "facial_movement_usual_range",
] as const;
export type MonitoredMethodKey = (typeof ALL_CONSENT_METHODS)[number];
export type PassiveMethodKey = (typeof MONITORED_METHODS)[number];

/**
 * Passive sensing channels start paused (`false`) until the patient opts in (D13,
 * `INITIAL_CONSENT_STATE`). Core check-in participation starts active (`true`).
 */
export function isDefaultEnabledForMethod(methodKey: MonitoredMethodKey): boolean {
  return methodKey === "check_in" || methodKey === "phq9";
}

export interface DeviceConnectionStatus {
  connected: boolean;
  label: string;
}

export type DeviceConnectionsMap = Record<PassiveMethodKey, DeviceConnectionStatus>;

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
  demoOnly: boolean;
  participantExternalId: string;
  viewerKind: "patient" | "staff";
  readingsRedactedForStaff: boolean;
  consents: MonitoringConsentSummary[];
  /**
   * Whether the patient chose to have individual answers kept, as stored.
   * Only in the patient's own view; without it the switch on the monitoring
   * page showed "Paused" whatever was stored and could not be switched off.
   */
  detailedAnswersEnabled?: boolean;
  deviceConnections: DeviceConnectionsMap;
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

function makePatientActor(patientId: string, clinicId: string = DEMO_CLINIC_ID): Actor {
  return { kind: "patient", patientId, clinicId };
}

function makeStaffActor(clinicId: string = DEMO_CLINIC_ID): Actor {
  return {
    kind: "staff",
    staffId: "demo-nurse-01",
    clinicId,
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
  const detailedAnswers = flagOf("detailed_answers");

  return {
    methodFlags: {
      check_in: checkIn,
      phq9,
      ring_rhythm: ring,
      camera_expressivity: camera,
      home_routine: routine,
      detailed_answers: detailedAnswers,
    },
    consentState: {
      taking_part: checkIn || phq9,
      methods: {
        ring,
        camera: camera || routine,
      },
      rule_check: false,
      detailed_answers: detailedAnswers,
    },
  };
}

function assertDomainAccess(params: {
  actor: Actor;
  action: "read" | "write";
  kind: "readings" | "consent" | "flags";
  patientId: string;
  clinicId?: string;
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
      clinicId: params.clinicId ?? DEMO_CLINIC_ID,
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
  const clinic = await prisma.clinic.upsert({
    where: { code: DEMO_CLINIC_ID },
    update: {},
    create: {
      code: DEMO_CLINIC_ID,
      name: "Demo Home Clinic",
    },
  });

  let participant = await prisma.participant.upsert({
    where: { externalId: HOME_DEMO_EXTERNAL_ID },
    update: { clinicId: clinic.id },
    create: {
      clinicId: clinic.id,
      externalId: HOME_DEMO_EXTERNAL_ID,
      label: "Home Demo Node (Arduino UNO Q & Wearable)",
      source: "live",
      isSimulated: false,
      scheduleDaysJson: JSON.stringify([1, 4]),
      scheduleTime: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-11-16",
      takingPart: true,
      ruleCheckConsent: true,
    },
  });

  if (
    !participant.scheduleDaysJson ||
    !participant.scheduleTime ||
    !participant.enrolmentDate ||
    !participant.clinicId
  ) {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        clinicId: clinic.id,
        scheduleDaysJson: JSON.stringify([1, 4]),
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
    });
  }

  for (const methodKey of ALL_CONSENT_METHODS) {
    const meta = MEASUREMENT_METHODS.find((m) => m.method === methodKey);
    const defaultEnabled = isDefaultEnabledForMethod(methodKey);
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
        clinicId: clinic.id,
        method: methodKey,
        broadArea: meta?.broadArea ?? "daily_routine",
        recordedDescription:
          meta?.recordedDescription ??
          "Derived numerical summaries only; video/audio never leave the device.",
        enabled: defaultEnabled,
        isPersonalSign: meta?.isPersonalSignDefault ?? false,
        consentedAt: defaultEnabled ? new Date() : null,
      },
    });
  }

  return participant;
}

export async function updateMethodConsent(
  method: MonitoredMethodKey,
  enabled: boolean,
  prisma: PrismaClient = getPrisma(),
  session?: PatientAuthSession
): Promise<MonitoringConsentSummary> {
  const target = await resolveMonitoringTarget({ session }, prisma);
  if (!target) {
    throw new Error("Participant record unavailable.");
  }
  const { participant, clinicCode } = target;
  const effectiveClinicId = participant.clinicId ?? clinicCode;
  const { consentState } = await loadConsentContext(participant.id, prisma);
  const access = assertDomainAccess({
    actor: makePatientActor(participant.id, effectiveClinicId),
    action: "write",
    kind: "consent",
    patientId: participant.id,
    clinicId: effectiveClinicId,
    purpose: "self_access",
    consent: consentState,
  });
  if (!access.allowed) {
    throw new Error(`Access denied updating consent: ${access.reason}`);
  }

  const meta = MEASUREMENT_METHODS.find((m) => m.method === method);

  const existing = await prisma.measurementConsent.findUnique({
    where: {
      participantId_method: {
        participantId: participant.id,
        method,
      },
    },
  });

  const updated = await prisma.measurementConsent.upsert({
    where: {
      participantId_method: {
        participantId: participant.id,
        method,
      },
    },
    create: {
      participantId: participant.id,
      clinicId: effectiveClinicId,
      method,
      broadArea: meta?.broadArea ?? "daily_routine",
      recordedDescription: meta?.recordedDescription ?? "",
      enabled,
      isPersonalSign: meta?.isPersonalSignDefault ?? false,
      consentedAt: enabled ? new Date() : null,
      revokedAt: enabled ? null : new Date(),
    },
    update: {
      enabled,
      consentedAt: enabled ? new Date() : undefined,
      revokedAt: enabled ? null : new Date(),
    },
  });

  if (!existing || existing.enabled !== enabled) {
    const isDetailed = method === "detailed_answers";
    const isTakingPart = method === "check_in";
    const isFacialMovementRange = method === "facial_movement_usual_range";
    await prisma.consentEvent.create({
      data: {
        participantId: participant.id,
        clinicId: participant.clinicId,
        layer: isDetailed
          ? "detailed_answers"
          : isTakingPart
          ? "taking_part"
          : isFacialMovementRange
          ? "facial_movement_usual_range"
          : "method",
        method: isDetailed || isTakingPart || isFacialMovementRange ? null : method,
        enabled,
        noticeVersion: "v1",
      },
    });
  }

  if (method === "check_in") {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { takingPart: enabled },
    });
  }

  if (method === "detailed_answers" && !enabled) {
    await prisma.phq9Assessment.updateMany({
      where: { participantId: participant.id },
      data: {
        item1Interest: null,
        item2Mood: null,
        item3Sleep: null,
        item4Energy: null,
        item5Appetite: null,
        item6SelfWorth: null,
        item7Concentration: null,
        item8Psychomotor: null,
        item9SelfHarm: null,
      },
    });
    await prisma.gad7Assessment.updateMany({
      where: { participantId: participant.id },
      data: {
        item1Nervous: null,
        item2ControlWorry: null,
        item3ExcessiveWorry: null,
        item4Relaxing: null,
        item5Restless: null,
        item6Irritable: null,
        item7Afraid: null,
      },
    });
  }

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
  clinicId: string | null,
  days: readonly WearableDayInput[],
  options: { isSimulated: boolean; sourceLabel: string },
  prisma: PrismaClient
): Promise<void> {
  for (const day of days) {
    const shared = {
      clinicId,
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
  clinicId: string | null,
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
    clinicId,
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
  options: {
    isSimulated: boolean;
    sourceLabel: string;
    session?: PatientAuthSession;
    participantId?: string | null;
  },
  prisma: PrismaClient = getPrisma()
): Promise<
  | { ok: true; savedDays: number; rhythmComputed: boolean; rhythmError?: string }
  | { ok: false; status: 403; error: string }
> {
  const target = await resolveMonitoringTarget(
    { session: options.session, participantId: options.participantId },
    prisma
  );
  if (!target) {
    return {
      ok: false,
      status: 403,
      error: "Participant record unavailable.",
    };
  }
  const { participant, clinicCode } = target;
  const effectiveClinicId = participant.clinicId ?? clinicCode;
  const { consentState } = await loadConsentContext(participant.id, prisma);

  const access = assertDomainAccess({
    actor: makePatientActor(participant.id, effectiveClinicId),
    action: "write",
    kind: "readings",
    patientId: participant.id,
    clinicId: effectiveClinicId,
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

  await upsertRingDays(participant.id, participant.clinicId, days, options, prisma);
  const rhythm = await recomputeAndSaveRhythmWindow(
    participant.id,
    participant.clinicId,
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
  prisma: PrismaClient = getPrisma(),
  options?: { session?: PatientAuthSession }
): Promise<
  | {
      ok: true;
      savedCamera: boolean;
      savedRoutineCount: number;
      skippedForConsent: string[];
    }
  | { ok: false; status: 403; error: string }
> {
  const target = await resolveMonitoringTarget({ session: options?.session }, prisma);
  if (!target) {
    return {
      ok: false,
      status: 403,
      error: "Participant record unavailable.",
    };
  }
  const { participant, clinicCode } = target;
  const effectiveClinicId = participant.clinicId ?? clinicCode;
  const { consentState, methodFlags } = await loadConsentContext(participant.id, prisma);

  const access = assertDomainAccess({
    actor: makePatientActor(participant.id, effectiveClinicId),
    action: "write",
    kind: "readings",
    patientId: participant.id,
    clinicId: effectiveClinicId,
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
          clinicId: participant.clinicId,
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
          clinicId: participant.clinicId,
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
      enabled: row?.enabled ?? false,
    };
  });
}

function emptyDeviceConnections(): DeviceConnectionsMap {
  return {
    ring_rhythm: { connected: false, label: "No device connected" },
    camera_expressivity: { connected: false, label: "No device connected" },
    home_routine: { connected: false, label: "No device connected" },
  };
}

async function loadDeviceConnections(
  participantId: string,
  prisma: PrismaClient
): Promise<DeviceConnectionsMap> {
  const [cred, liveRingCount, liveCameraCount, liveRoutineCount] = await Promise.all([
    prisma.webhookCredential.findUnique({
      where: { participantId },
      select: { revokedAt: true },
    }),
    prisma.ringDay.count({ where: { participantId, isSimulated: false } }),
    prisma.cameraReading.count({ where: { participantId, isSimulated: false } }),
    prisma.routineSignalReading.count({ where: { participantId, isSimulated: false } }),
  ]);

  const phonePaired = Boolean(cred && cred.revokedAt === null);
  const ringConnected = phonePaired || liveRingCount > 0;

  return {
    ring_rhythm: {
      connected: ringConnected,
      label: phonePaired
        ? "Phone paired"
        : liveRingCount > 0
          ? "Wearable connected"
          : "No device connected",
    },
    camera_expressivity: {
      connected: liveCameraCount > 0,
      label: liveCameraCount > 0 ? "UNO Q camera connected" : "No device connected",
    },
    home_routine: {
      connected: liveRoutineCount > 0,
      label: liveRoutineCount > 0 ? "UNO Q sensor connected" : "No device connected",
    },
  };
}

async function loadStaffSummary(
  session: StaffAuthSession | null,
  prisma: PrismaClient
): Promise<MonitoringSummaryPayload> {
  if (!session) {
    const participant = await ensureHomeDemoParticipant(prisma);
    const { consentState } = await loadConsentContext(participant.id, prisma);
    const clinicId = participant.clinicId ?? DEMO_CLINIC_ID;
    const actor = makeStaffActor(clinicId);
    const flagsAccess = assertDomainAccess({
      actor,
      action: "read",
      kind: "flags",
      patientId: participant.id,
      clinicId,
      purpose: "care",
      consent: consentState,
    });
    const consentsRows = await prisma.measurementConsent.findMany({
      where: { participantId: participant.id, method: { in: [...MONITORED_METHODS] } },
    });
    const flags = flagsAccess.allowed
      ? await prisma.clinicFlag.findMany({
          where: { participantId: participant.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [];
    return {
      demoOnly: true,
      participantExternalId: HOME_DEMO_EXTERNAL_ID,
      viewerKind: "staff",
      readingsRedactedForStaff: true,
      consents: formatConsentSummaries(consentsRows),
      deviceConnections: emptyDeviceConnections(),
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

  const clinic =
    (await prisma.clinic.findUnique({ where: { id: session.actor.clinicId } })) ??
    (await prisma.clinic.findUnique({ where: { code: "sim-clinic-01" } }));
  const resolvedClinicId = clinic?.id ?? session.actor.clinicId;
  const actor: Actor = { ...session.actor, clinicId: resolvedClinicId };
  const flagsAccess = assertDomainAccess({
    actor,
    action: "read",
    kind: "flags",
    patientId: resolvedClinicId,
    clinicId: resolvedClinicId,
    purpose: "care",
    consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: false },
  });
  const flags =
    flagsAccess.allowed && clinic
      ? await prisma.clinicFlag.findMany({
          where: { clinicId: clinic.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [];

  return {
    demoOnly: session.isSimulated,
    participantExternalId: clinic?.code ?? "sim-clinic-01",
    viewerKind: "staff",
    readingsRedactedForStaff: true,
    consents: formatConsentSummaries([]),
    deviceConnections: emptyDeviceConnections(),
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
 * Reads the participant's monitoring summary after checking `decideAccess`.
 * When `viewerOrSession` is `"staff"` or a `StaffAuthSession`, `decideAccess` refuses
 * raw clinical readings (D8), returning only broad-area flags with all sensor numbers redacted.
 */
export async function getMonitoringSummary(
  viewerOrSession: "patient" | "staff" | AuthSession = "patient",
  prisma: PrismaClient = getPrisma()
): Promise<MonitoringSummaryPayload> {
  if (viewerOrSession === "staff") {
    return loadStaffSummary(null, prisma);
  }
  if (typeof viewerOrSession === "object" && viewerOrSession.kind === "staff") {
    return loadStaffSummary(viewerOrSession, prisma);
  }

  const patientSession =
    typeof viewerOrSession === "object" ? viewerOrSession : undefined;
  const target = await resolveMonitoringTarget({ session: patientSession }, prisma);
  if (!target) {
    throw new Error("Participant record unavailable.");
  }
  const { participant, clinicCode } = target;
  const effectiveClinicId = participant.clinicId ?? clinicCode;
  const { consentState } = await loadConsentContext(participant.id, prisma);
  const actor = makePatientActor(participant.id, effectiveClinicId);

  const ringRead = assertDomainAccess({
    actor,
    action: "read",
    kind: "readings",
    method: "ring",
    patientId: participant.id,
    clinicId: effectiveClinicId,
    purpose: "self_access",
    consent: consentState,
  });
  const cameraRead = assertDomainAccess({
    actor,
    action: "read",
    kind: "readings",
    method: "camera",
    patientId: participant.id,
    clinicId: effectiveClinicId,
    purpose: "self_access",
    consent: consentState,
  });

  const consentsRows = await prisma.measurementConsent.findMany({
    where: { participantId: participant.id, method: { in: [...MONITORED_METHODS] } },
  });
  const consents = formatConsentSummaries(consentsRows);
  const detailedAnswers = await prisma.measurementConsent.findUnique({
    where: {
      participantId_method: { participantId: participant.id, method: "detailed_answers" },
    },
    select: { enabled: true },
  });

  const [deviceConnections, rhythmWindow, ringDays, cameraReadings, routineReadings] =
    await Promise.all([
      loadDeviceConnections(participant.id, prisma),
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
    demoOnly: Boolean(
      participant.isSimulated || participant.externalId === HOME_DEMO_EXTERNAL_ID
    ),
    participantExternalId:
      participant.participantCode ?? participant.externalId ?? HOME_DEMO_EXTERNAL_ID,
    viewerKind: "patient",
    readingsRedactedForStaff: false,
    consents,
    detailedAnswersEnabled: detailedAnswers?.enabled ?? false,
    deviceConnections,
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
