import {
  decideAccess,
  type AccessReasonCode,
  type Actor,
  type Purpose,
  type TargetData,
} from '../domain/access';
import type {
  Ports,
  SubmitCameraReadingResult,
  UseCaseResult,
} from './ports';

export interface SubmitCameraReadingInput {
  readonly patientId: string;
  readonly taskId?: string;
  readonly durationSec: number;
  readonly effectiveFps: number;
  readonly faceDetectedRatio: number;
  readonly expressivityScore: number;
  readonly smileFraction?: number;
  readonly yawSdDeg?: number;
  readonly pitchSdDeg?: number;
  readonly rollSdDeg?: number | null;
  readonly angularPathDegPerMin: number;
}

const USE_CASE_PURPOSE: Purpose = 'method:camera';
const TASK_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

function inRange(value: number | undefined, min: number, max: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function validateOptionalNumbers(
  input: SubmitCameraReadingInput
): { ok: true } | { ok: false; error: string } {
  if (input.taskId !== undefined && !TASK_ID_PATTERN.test(input.taskId)) {
    return { ok: false, error: 'Invalid taskId' };
  }
  if (input.smileFraction !== undefined && !inRange(input.smileFraction, 0, 1)) {
    return { ok: false, error: 'Invalid smileFraction' };
  }
  if (input.yawSdDeg !== undefined && !inRange(input.yawSdDeg, 0, 180)) {
    return { ok: false, error: 'Invalid yawSdDeg' };
  }
  if (input.pitchSdDeg !== undefined && !inRange(input.pitchSdDeg, 0, 180)) {
    return { ok: false, error: 'Invalid pitchSdDeg' };
  }
  if (
    input.rollSdDeg !== undefined &&
    input.rollSdDeg !== null &&
    !inRange(input.rollSdDeg, 0, 180)
  ) {
    return { ok: false, error: 'Invalid rollSdDeg' };
  }
  return { ok: true };
}

function validateInput(
  input: SubmitCameraReadingInput
): { ok: true } | { ok: false; error: string } {
  if (!input || !input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  if (!inRange(input.durationSec, 0.001, 600)) {
    return { ok: false, error: 'Invalid durationSec' };
  }
  if (!inRange(input.effectiveFps, 0, 120)) {
    return { ok: false, error: 'Invalid effectiveFps' };
  }
  if (!inRange(input.faceDetectedRatio, 0, 1)) {
    return { ok: false, error: 'Invalid faceDetectedRatio' };
  }
  if (!inRange(input.expressivityScore, 0, 10)) {
    return { ok: false, error: 'Invalid expressivityScore' };
  }
  if (!inRange(input.angularPathDegPerMin, 0, 10_800)) {
    return { ok: false, error: 'Invalid angularPathDegPerMin' };
  }
  return validateOptionalNumbers(input);
}

async function appendRefusalLog(
  ports: Ports,
  actor: Actor,
  target: TargetData,
  reason: AccessReasonCode,
  timestamp: string
): Promise<void> {
  await ports.accessLog.appendLog({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
    allowed: false,
    reason,
    timestamp,
  });
}

async function runCameraSaveTransaction(
  actor: Actor,
  input: SubmitCameraReadingInput,
  ports: Ports
): Promise<{ ok: true; readingId: string } | { ok: false; error: string }> {
  const cameraReadings = ports.cameraReadings ?? ports.camera;
  if (!cameraReadings) {
    throw new Error('Camera reading storage is not configured');
  }
  let accessError: AccessReasonCode | null = null;
  let readingId = '';

  await ports.unitOfWork.execute(async () => {
    const now = ports.clock.now();
    const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
    if (!switches) throw new Error('Patient not found');

    const target: TargetData = {
      kind: 'readings',
      patientId: switches.patientId,
      clinicId: switches.clinicId,
      method: 'camera',
    };
    const access = decideAccess({
      actor,
      action: 'write',
      target,
      purpose: USE_CASE_PURPOSE,
      consent: switches.consent,
    });
    if (!access.ok) throw new Error(access.error);
    if (!access.value.allowed) {
      accessError = access.value.reason;
      if (access.value.log) {
        await appendRefusalLog(ports, actor, target, access.value.reason, now);
      }
      return;
    }

    const saved = await cameraReadings.saveCameraReading({
      patientId: input.patientId,
      date: now.slice(0, 10),
      taskId: input.taskId ?? 'check_in_clip_60s',
      durationSec: input.durationSec,
      effectiveFps: input.effectiveFps,
      faceDetectedRatio: input.faceDetectedRatio,
      expressivityScore: input.expressivityScore,
      smileFraction: input.smileFraction ?? 0,
      yawSdDeg: input.yawSdDeg ?? 0,
      pitchSdDeg: input.pitchSdDeg ?? 0,
      rollSdDeg: input.rollSdDeg ?? null,
      angularPathDegPerMin: input.angularPathDegPerMin,
      source: 'live',
    });
    readingId = saved?.id ?? '';
  });

  if (accessError !== null) {
    return { ok: false, error: accessError };
  }
  return { ok: true, readingId };
}

async function checkInitialWriteAccess(
  actor: Actor,
  patientId: string,
  ports: Ports
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target: TargetData = {
    kind: 'readings',
    patientId,
    clinicId:
      actor.kind === 'patient' || actor.kind === 'staff' ? actor.clinicId : undefined,
    method: 'camera',
  };
  const access = decideAccess({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
  });
  if (!access.ok) return { ok: false, error: access.error };
  if (access.value.allowed) return { ok: true };

  const awaitingConsent =
    actor.kind === 'patient' &&
    actor.patientId === patientId &&
    access.value.reason === 'consent_required';
  if (awaitingConsent) return { ok: true };

  if (access.value.log) {
    await appendRefusalLog(ports, actor, target, access.value.reason, ports.clock.now());
  }
  return { ok: false, error: access.value.reason };
}

export async function submitCameraReading(
  actor: Actor,
  input: SubmitCameraReadingInput,
  ports: Ports
): Promise<UseCaseResult<SubmitCameraReadingResult>> {
  const initial = await checkInitialWriteAccess(actor, input?.patientId, ports);
  if (!initial.ok) return initial;

  const val = validateInput(input);
  if (!val.ok) return { ok: false, error: val.error };
  if (!ports.cameraReadings && !ports.camera) {
    return { ok: false, error: 'Camera reading storage is not configured' };
  }

  try {
    const outcome = await runCameraSaveTransaction(actor, input, ports);
    if (!outcome.ok) return outcome;
    return { ok: true, value: { saved: true, readingId: outcome.readingId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
