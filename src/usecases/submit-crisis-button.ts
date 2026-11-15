import { decideAccess, type Actor, type Purpose, type TargetData } from '../domain/access';
import { getOpenRound } from '../domain/rounds';
import { CRISIS_RESOURCES, type CrisisResource } from '../lib/constants';
import type { Ports, SubmitCrisisButtonResult } from './ports';

export interface SubmitCrisisButtonInput {
  readonly patientId: string;
  readonly time?: string;
}

export interface SubmitCrisisButtonFailure {
  readonly saved: false;
  readonly showCrisisPath: true;
  readonly crisisResources: readonly CrisisResource[];
}

export type SubmitCrisisButtonOutcome =
  | {
      readonly ok: true;
      readonly saved: true;
      readonly showCrisisPath: true;
      readonly crisisResources: readonly CrisisResource[];
      readonly value: SubmitCrisisButtonResult;
    }
  | ({
      readonly ok: false;
      readonly error: string;
    } & SubmitCrisisButtonFailure);

const USE_CASE_PURPOSE: Purpose = 'self_access';

function failureResult(error: string): SubmitCrisisButtonOutcome {
  return {
    ok: false,
    error,
    saved: false,
    showCrisisPath: true,
    crisisResources: CRISIS_RESOURCES,
  };
}

function validateInput(input: SubmitCrisisButtonInput): { ok: true } | { ok: false; error: string } {
  if (!input || !input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  return { ok: true };
}

async function resolveCrisisRound(ports: Ports, patientId: string, now: string): Promise<number> {
  const patient = await ports.patients.getPatient(patientId);
  const openRound = patient ? getOpenRound(patient.schedule, now) : null;
  if (openRound) return openRound.number;

  const rounds = await ports.rounds.getRounds(patientId);
  if (rounds.length > 0) {
    return Math.max(...rounds.map((r) => r.roundNumber));
  }
  return 1;
}

async function checkInitialAccess(
  actor: Actor,
  target: TargetData,
  input: SubmitCrisisButtonInput,
  ports: Ports,
  now: string
): Promise<string | null> {
  const initialAccess = decideAccess({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
  });

  if (!initialAccess.ok) return initialAccess.error;
  if (initialAccess.value.allowed) return null;

  const isPatientAwaitingConsentCheck =
    actor.kind === 'patient' &&
    actor.patientId === input?.patientId &&
    initialAccess.value.reason === 'consent_required';

  if (!isPatientAwaitingConsentCheck) {
    if (initialAccess.value.log) {
      await ports.accessLog.appendLog({
        actor,
        action: 'write',
        target,
        purpose: USE_CASE_PURPOSE,
        allowed: false,
        reason: initialAccess.value.reason,
        timestamp: now,
      });
    }
    return initialAccess.value.reason;
  }
  return null;
}

async function persistCrisisEvent(ports: Ports, patientId: string, now: string): Promise<number> {
  const patient = await ports.patients.getPatient(patientId);
  if (!patient) throw new Error('Patient not found');

  const roundNumber = await resolveCrisisRound(ports, patient.patientId, now);
  const existingEvents = await ports.crisis.getCrisisEvents(patient.patientId);
  const alreadyHasEvent = existingEvents.some((e) => e.roundNumber === roundNumber);

  if (!alreadyHasEvent) {
    await ports.crisis.saveCrisisEvent({
      patientId: patient.patientId,
      roundNumber,
      itemId: 'crisis_button',
      value: 1,
      occurredAt: now,
    });
  }
  return roundNumber;
}

/**
 * Submits a physical crisis button press from a bedside or kiosk device.
 *
 * Rules:
 * - ALWAYS returns showCrisisPath: true and the crisis resources, whatever else
 *   happens (refused access, paused consent, storage failure).
 * - Records one crisis event for the patient's current round with itemId "crisis_button",
 *   never more than one per round, never changing an existing one.
 * - Runs in one unit of work; a storage failure is reported as not saved (saved: false).
 */
export async function submitCrisisButton(
  actor: Actor,
  input: SubmitCrisisButtonInput,
  ports: Ports
): Promise<SubmitCrisisButtonOutcome> {
  const now = input?.time ?? ports.clock.now();
  const target: TargetData = {
    kind: 'answers',
    patientId: input?.patientId,
    clinicId: actor.kind === 'patient' || actor.kind === 'staff' ? actor.clinicId : undefined,
  };

  const accessError = await checkInitialAccess(actor, target, input, ports, now);
  if (accessError) return failureResult(accessError);

  const val = validateInput(input);
  if (!val.ok) return failureResult(val.error);

  let roundNumber = 1;
  try {
    await ports.unitOfWork.execute(async () => {
      roundNumber = await persistCrisisEvent(ports, input.patientId, now);
    });
  } catch (err) {
    return failureResult(err instanceof Error ? err.message : 'Storage failed');
  }

  return {
    ok: true,
    saved: true,
    showCrisisPath: true,
    crisisResources: CRISIS_RESOURCES,
    value: {
      saved: true,
      showCrisisPath: true,
      crisisResources: CRISIS_RESOURCES,
      roundNumber,
    },
  };
}
