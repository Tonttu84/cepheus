import { decideAccess, type Actor, type TargetData } from '../domain/access';
import {
  listRounds,
  checkReminder,
  type Round,
  type Schedule,
} from '../domain/rounds';
import type {
  CloseElapsedRoundsResult,
  Ports,
  StoredRound,
  UseCaseResult,
} from './ports';

export interface CloseElapsedRoundsInput {
  readonly patientId: string;
}

interface RoundUpdates {
  roundsToUpdate: StoredRound[];
  closedCount: number;
  remindersCount: number;
}

/**
 * Lists all rounds that have ended at or before the current moment (whose endsAt <= now),
 * plus the currently open round (if any) so due reminders can be evaluated.
 * Uses only the domain's listRounds function without relying on getOpenRound.
 */
function listRoundsForEvaluation(schedule: Schedule, now: string): Round[] {
  const nowMs = new Date(now).getTime();
  let count = 1;
  let rounds = listRounds(schedule, count);
  if (rounds.length === 0) return [];

  // If round 1 has not opened yet, no round has opened or ended
  if (new Date(rounds[0].opensAt).getTime() > nowMs) {
    return [];
  }

  // Generate enough rounds so that the last round ends strictly after now
  while (new Date(rounds[rounds.length - 1].endsAt).getTime() <= nowMs) {
    count *= 2;
    rounds = listRounds(schedule, count);
  }

  // Include every round whose opensAt is at or before now.
  // This contains all rounds whose endsAt <= nowMs (elapsed rounds),
  // as well as the round open right now (opensAt <= nowMs < endsAt) if any.
  return rounds.filter((r) => new Date(r.opensAt).getTime() <= nowMs);
}

function evaluateRoundUpdates(
  patientId: string,
  schedule: Schedule,
  openedRounds: readonly Round[],
  storedRounds: readonly StoredRound[],
  now: string
): RoundUpdates {
  const nowMs = new Date(now).getTime();
  const roundsToUpdate: StoredRound[] = [];
  let closedCount = 0;
  let remindersCount = 0;

  for (const round of openedRounds) {
    const existing = storedRounds.find((r) => r.roundNumber === round.number);
    let reminder = existing?.reminderSentAt ?? null;
    let status = existing?.status ?? null;
    let changed = false;

    const check = checkReminder(round, {
      moment: now,
      timeZone: schedule.timeZone,
      reminderSent: Boolean(reminder),
      hasSubmission: status === 'answered' || status === 'not_today',
    });

    if (check.due) {
      reminder = now;
      remindersCount++;
      changed = true;
    }

    if (new Date(round.endsAt).getTime() <= nowMs && !status) {
      status = 'missed';
      closedCount++;
      changed = true;
    }

    if (changed) {
      roundsToUpdate.push({
        patientId,
        roundNumber: round.number,
        localDate: round.localDate,
        status,
        mood: existing?.mood ?? null,
        interest: existing?.interest ?? null,
        reminderSentAt: reminder,
        answeredAt: existing?.answeredAt ?? null,
      });
    }
  }

  return { roundsToUpdate, closedCount, remindersCount };
}

/**
 * Closes elapsed rounds (marking uncompleted past rounds as missed) and sends due reminders.
 *
 * Architecture notes:
 * - Point A: Storing facts and evaluating rules are decoupled; closeElapsedRounds stores
 *   facts in ONE unit of work and returns immediately without running the rule.
 * - Point F: Generates all rounds up to the current moment, however many have elapsed,
 *   without any fixed limit.
 */
export async function closeElapsedRounds(
  actor: Actor,
  input: CloseElapsedRoundsInput,
  ports: Ports
): Promise<UseCaseResult<CloseElapsedRoundsResult>> {
  // Point G: decideAccess must be asked before anything else is done for non-system actors
  if (actor.kind !== 'system') {
    const clinicId = (actor as { clinicId?: string }).clinicId ?? 'unknown';
    const initialTarget: TargetData = {
      kind: 'flags',
      patientId: input?.patientId,
      clinicId,
    };
    const initialAccess = decideAccess({
      actor,
      action: 'write',
      target: initialTarget,
      purpose: 'care',
    });

    if (!initialAccess.ok) {
      return { ok: false, error: initialAccess.error };
    }

    if (!initialAccess.value.allowed) {
      // Point E: Refusal log entry is written on its own, before and outside unit of work
      if (initialAccess.value.log) {
        await ports.accessLog.appendLog({
          actor,
          action: 'write',
          target: initialTarget,
          purpose: 'care',
          allowed: false,
          reason: initialAccess.value.reason,
          timestamp: ports.clock.now(),
        });
      }
      return { ok: false, error: initialAccess.value.reason };
    }
  }

  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }

  let closedCount = 0;
  let remindersCount = 0;
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
        kind: 'flags',
        patientId: switches.patientId,
        clinicId: switches.clinicId,
      };

      const access = decideAccess({
        actor,
        action: 'write',
        target,
        purpose: 'care',
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
            purpose: 'care',
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
          purpose: 'care',
          allowed: true,
          reason: 'allowed',
          timestamp: now,
        });
      }

      // Patient data is read only after the access decision is allowed.
      const patient = await ports.patients.getPatient(input.patientId);
      if (!patient) throw new Error('Patient not found');

      // Generate all rounds up to current moment using domain listRounds without relying on getOpenRound
      const openedRounds = listRoundsForEvaluation(patient.schedule, now);
      const storedRounds = await ports.rounds.getRounds(patient.patientId);

      const evaluated = evaluateRoundUpdates(
        patient.patientId,
        patient.schedule,
        openedRounds,
        storedRounds,
        now
      );

      closedCount = evaluated.closedCount;
      remindersCount = evaluated.remindersCount;

      // Point E: Allowed access that must be logged is written inside unit of work
      if (access.value.log) {
        await ports.accessLog.appendLog({
          actor,
          action: 'write',
          target,
          purpose: 'care',
          allowed: true,
          reason: 'allowed',
          timestamp: now,
        });
      }

      for (const round of evaluated.roundsToUpdate) {
        await ports.rounds.saveRound(round);
      }
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return {
    ok: true,
    value: {
      closedRoundsCount: closedCount,
      remindersSentCount: remindersCount,
      ruleRunNeeded: closedCount > 0 || remindersCount > 0,
    },
  };
}
