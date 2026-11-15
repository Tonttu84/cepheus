import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import { validateTapAnswer } from '../domain/instruments';
import { getOpenRound, applySubmission } from '../domain/rounds';
import type { Ports, SubmitTapsResult, UseCaseResult } from './ports';
import { getExistingSubmission } from './shared';

export interface SubmitTapsInput {
  readonly patientId: string;
  readonly mood: number;
  readonly interest: number;
}

function validateInput(input: SubmitTapsInput): { ok: true } | { ok: false; error: string } {
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  const moodVal = validateTapAnswer({ kind: 'mood', value: input.mood });
  if (!moodVal.ok) return { ok: false, error: moodVal.error };
  const interestVal = validateTapAnswer({ kind: 'interest', value: input.interest });
  if (!interestVal.ok) return { ok: false, error: interestVal.error };
  return { ok: true };
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

export async function submitTaps(
  actor: Actor,
  input: SubmitTapsInput,
  ports: Ports
): Promise<UseCaseResult<SubmitTapsResult>> {
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
    // If not allowed, check if it is purely awaiting consent check inside unit of work for own patient data
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
  if (!val.ok) return { ok: false, error: val.error };

  let isDuplicate = false;
  let accessError: string | null = null;
  let roundNumber: number = 0;

  try {
    // Point A: Store facts only in ONE unit of work, do not run rule or wait for it
    await ports.unitOfWork.execute(async () => {
      // Point D & G: Clock read exactly once inside unit of work
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
        if (access.value.log) {
          await ports.accessLog.appendLog({
            actor,
            action: 'write',
            target,
            purpose: USE_CASE_PURPOSE,
            allowed: false,
            reason: access.value.reason,
            timestamp: now,
          });
        }
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

      // Patient data is read only after the access decision is allowed.
      const patient = await ports.patients.getPatient(input.patientId);
      if (!patient) throw new Error('Patient not found');

      const openRound = getOpenRound(patient.schedule, now);
      if (!openRound) throw new Error('No round is currently open');

      roundNumber = openRound.number;

      const existing = await ports.rounds.getRound(patient.patientId, openRound.number);
      const appResult = applySubmission(getExistingSubmission(existing), {
        kind: 'answer',
        mood: input.mood,
        interest: input.interest,
      });

      if (appResult.isDuplicate) {
        isDuplicate = true;
        return;
      }

      await ports.rounds.saveRound({
        patientId: patient.patientId,
        roundNumber: openRound.number,
        localDate: openRound.localDate,
        status: 'answered',
        mood: input.mood,
        interest: input.interest,
        reminderSentAt: existing?.reminderSentAt ?? null,
        answeredAt: now,
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: { ruleRunNeeded: !isDuplicate, roundNumber } };
}
