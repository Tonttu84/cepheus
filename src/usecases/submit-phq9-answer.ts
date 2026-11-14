import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import { isCrisis } from '../domain/crisis';
import { PHQ9_ITEMS, scorePhq9, type Phq9Answer } from '../domain/instruments';
import {
  getOpenRound,
  isPhq9Due,
  type Phq9Progress,
} from '../domain/rounds';
import type { Ports, StoredPhq9, StoredRound, SubmitPhq9AnswerResult, UseCaseResult } from './ports';
import { buildPhq9DueHistory } from './shared';

export interface SubmitPhq9AnswerInput {
  readonly patientId: string;
  readonly itemId: string;
  readonly value: number;
}

function validateInput(input: SubmitPhq9AnswerInput): { ok: true } | { ok: false; error: string } {
  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  const item = PHQ9_ITEMS.find((i) => i.id === input.itemId);
  if (!item) return { ok: false, error: 'Invalid item id' };

  const { value } = input;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < item.min || value > item.max) {
    return { ok: false, error: 'Invalid item value' };
  }
  return { ok: true };
}

function checkEligibility(
  roundNum: number,
  rounds: readonly StoredRound[],
  phq9s: readonly StoredPhq9[]
): string | null {
  const history = buildPhq9DueHistory(roundNum, rounds, phq9s);

  if (!isPhq9Due(roundNum, history)) {
    return 'Cannot submit PHQ-9: PHQ-9 is not due in this round';
  }
  const isDone = phq9s.some(
    (p) => (p.completedInRoundNumber === roundNum || p.roundNumber === roundNum) && p.progress === 'completed'
  );
  if (isDone) {
    return 'Cannot submit PHQ-9 answer: PHQ-9 is already completed';
  }
  return null;
}

function mergeAnswer(answers: readonly Phq9Answer[], itemId: string, value: number): Phq9Answer[] {
  const next = [...answers];
  const idx = next.findIndex((a) => a.id === itemId);
  if (idx >= 0) {
    next[idx] = { id: itemId, value };
  } else {
    next.push({ id: itemId, value });
  }
  return next;
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

/**
 * Submits an answer to one PHQ-9 question item.
 *
 * Architecture & Crisis notes:
 * - Point B: The screen must also apply the crisis rule itself the moment the answer is tapped,
 *   so that showing the crisis path never depends on the server answering at all.
 *   The server calculates the crisis signal from the answer before anything is stored,
 *   returns it whether storing succeeds or fails (carrying the signal on error),
 *   and never waits for anything else.
 * - Point C: At most one crisis event is stored for each PHQ-9 questionnaire, created at
 *   the first non-zero answer to the self-harm item, and never changed afterwards.
 * - Point A: Storing facts and running rules are separate use cases; submitPhq9Answer stores
 *   facts in ONE unit of work and returns immediately without running the rule.
 */
export async function submitPhq9Answer(
  actor: Actor,
  input: SubmitPhq9AnswerInput,
  ports: Ports
): Promise<UseCaseResult<SubmitPhq9AnswerResult, { readonly showCrisisPath?: boolean }>> {
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

  // Point B: worked out from the answer before anything is stored
  const crisisCheck = isCrisis({ id: input?.itemId, value: input?.value });
  const showCrisisPath = crisisCheck.ok && crisisCheck.value === true;

  if (!initialAccess.ok) {
    return { ok: false, error: initialAccess.error, showCrisisPath };
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
      return { ok: false, error: initialAccess.value.reason, showCrisisPath };
    }
  }

  const val = validateInput(input);
  if (!val.ok) {
    return { ok: false, error: val.error, showCrisisPath };
  }

  let isComplete = false;
  let progress: Phq9Progress = 'unfinished';
  let accessError: string | null = null;

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

      const storedRound = await ports.rounds.getRound(patient.patientId, openRound.number);
      if (!storedRound || storedRound.status !== 'answered') {
        throw new Error('Cannot submit PHQ-9 before taps are answered');
      }

      const [rounds, phq9s, existingCrisisEvents] = await Promise.all([
        ports.rounds.getRounds(patient.patientId),
        ports.phq9.getPhq9s(patient.patientId),
        ports.crisis.getCrisisEvents(patient.patientId),
      ]);

      const refusal = checkEligibility(openRound.number, rounds, phq9s);
      if (refusal) throw new Error(refusal);

      const unfinished = phq9s.find((p) => p.progress === 'unfinished');
      const questionnaireRoundNumber = unfinished ? unfinished.roundNumber : openRound.number;

      const answers = mergeAnswer(unfinished ? unfinished.answers : [], input.itemId, input.value);
      isComplete = answers.length === 9;
      progress = isComplete ? 'completed' : 'unfinished';

      await ports.phq9.savePhq9({
        patientId: patient.patientId,
        roundNumber: questionnaireRoundNumber,
        completedInRoundNumber: isComplete ? openRound.number : null,
        progress,
        answers,
        total: isComplete ? scorePhq9(answers) : null,
        completedAt: isComplete ? now : null,
        date: isComplete ? openRound.localDate : null,
      });

      // Point C: At most one crisis event for each PHQ-9, created at the first such answer and never changed afterwards
      if (showCrisisPath) {
        const alreadyHasCrisisEvent = existingCrisisEvents.some(
          (e) => e.roundNumber === questionnaireRoundNumber
        );
        if (!alreadyHasCrisisEvent) {
          await ports.crisis.saveCrisisEvent({
            patientId: patient.patientId,
            roundNumber: questionnaireRoundNumber,
            itemId: input.itemId,
            value: input.value,
            occurredAt: now,
          });
        }
      }
    });
  } catch (err) {
    // Point B: returned whether storing succeeds or fails (error carries crisis signal)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Storage failed',
      showCrisisPath,
    };
  }

  if (accessError) {
    return { ok: false, error: accessError, showCrisisPath };
  }

  return {
    ok: true,
    value: {
      showCrisisPath,
      progress,
      ruleRunNeeded: isComplete,
    },
  };
}
