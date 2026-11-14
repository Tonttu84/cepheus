import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import {
  DEFAULT_EXTRA_ITEMS_CONFIG,
  getOfferedExtraItem,
  validateExtraAnswer,
} from '../domain/extra-items';
import { getOpenRound } from '../domain/rounds';
import type { Ports, SubmitExtraAnswerResult, UseCaseResult } from './ports';

export interface SubmitExtraAnswerInput {
  readonly patientId: string;
  readonly itemId: string;
  readonly value: number;
  readonly roundNumber?: number;
}

function validateInput(input: SubmitExtraAnswerInput): { ok: true } | { ok: false; error: string } {
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  if (!input.itemId || typeof input.itemId !== 'string') {
    return { ok: false, error: 'Invalid item id' };
  }
  return { ok: true };
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

export async function submitExtraAnswer(
  actor: Actor,
  input: SubmitExtraAnswerInput,
  ports: Ports
): Promise<UseCaseResult<SubmitExtraAnswerResult>> {
  // Point G: decideAccess must be asked before anything else is done
  const initialTarget: TargetData = {
    kind: 'answers',
    patientId: input?.patientId,
    clinicId: actor.kind === 'patient' || actor.kind === 'staff' ? actor.clinicId : undefined,
  };
  const initialAccess = decideAccess({
    actor,
    action: 'write',
    target: initialTarget,
    purpose: USE_CASE_PURPOSE,
  });

  if (!initialAccess.ok) {
    return { ok: false, error: initialAccess.error };
  }

  if (!initialAccess.value.allowed) {
    const isPatientAwaitingConsentCheck =
      actor.kind === 'patient' &&
      actor.patientId === input?.patientId &&
      initialAccess.value.reason === 'consent_required';

    if (!isPatientAwaitingConsentCheck) {
      // Point E: Refusal log entry is written on its own, before and outside unit of work
      if (initialAccess.value.log) {
        await ports.accessLog.appendLog({
          actor,
          action: 'write',
          target: initialTarget,
          purpose: USE_CASE_PURPOSE,
          allowed: false,
          reason: initialAccess.value.reason,
          timestamp: ports.clock.now(),
        });
      }
      return { ok: false, error: initialAccess.value.reason };
    }
  }

  const val = validateInput(input);
  if (!val.ok) {
    return { ok: false, error: val.error };
  }

  let accessError: string | null = null;
  let shouldLogRefusal = false;
  let refusalTarget: TargetData | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();

      // This one read is what the access decision itself requires.
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) throw new Error('Patient not found');

      const target: TargetData = {
        kind: 'answers',
        patientId: switches.patientId,
        clinicId: switches.clinicId,
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
        shouldLogRefusal = access.value.log || access.value.reason === 'consent_required';
        refusalTarget = target;
        return;
      }

      // Point E: Allowed access that must be logged is written inside unit of work
      if (access.value.log) {
        await ports.accessLog.appendLog({
          actor,
          action: 'write',
          target,
          purpose: USE_CASE_PURPOSE,
          allowed: true,
          reason: 'allowed',
          timestamp: now,
        });
      }

      const extraConfig = ports.extraItemsConfig ?? DEFAULT_EXTRA_ITEMS_CONFIG;
      if (!extraConfig.enabled) {
        throw new Error('Extra items feature is disabled');
      }

      const patient = await ports.patients.getPatient(input.patientId);
      if (!patient) throw new Error('Patient not found');

      const openRound = getOpenRound(patient.schedule, now);
      if (!openRound) throw new Error('No round is currently open');

      if (input.roundNumber !== undefined && input.roundNumber !== openRound.number) {
        throw new Error('Cannot submit extra answer for another round');
      }

      const storedRound = await ports.rounds.getRound(patient.patientId, openRound.number);
      if (!storedRound || storedRound.status !== 'answered') {
        throw new Error('Cannot submit extra answer before taps are answered');
      }

      const offeredItem = getOfferedExtraItem(openRound.number, extraConfig);
      if (!offeredItem) {
        throw new Error('No extra item offered for this round');
      }

      const validation = validateExtraAnswer(
        { itemId: input.itemId, value: input.value },
        offeredItem
      );
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      const existing = await ports.extraAnswers.getExtraAnswer(patient.patientId, openRound.number);
      if (existing) {
        throw new Error('Extra answer already submitted for this round');
      }

      await ports.extraAnswers.saveExtraAnswer({
        patientId: patient.patientId,
        roundNumber: openRound.number,
        itemId: input.itemId,
        value: input.value,
        answeredAt: now,
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    if (shouldLogRefusal && refusalTarget) {
      await ports.accessLog.appendLog({
        actor,
        action: 'write',
        target: refusalTarget,
        purpose: USE_CASE_PURPOSE,
        allowed: false,
        reason: accessError as import('../domain/access').AccessReasonCode,
        timestamp: ports.clock.now(),
      });
    }
    return { ok: false, error: accessError };
  }

  return { ok: true, value: { recorded: true } };
}
