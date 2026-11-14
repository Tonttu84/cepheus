import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import { DEFAULT_EXTRA_ITEMS_CONFIG, getOfferedExtraItem } from '../domain/extra-items';
import {
  getOpenRound,
  isPhq9Due,
  type Phq9Progress,
} from '../domain/rounds';
import type { CheckInState, Ports, StoredPhq9, UseCaseResult } from './ports';
import { buildPhq9DueHistory } from './shared';

export interface GetCheckInStateInput {
  readonly patientId: string;
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

function resolvePhq9Progress(
  openRoundNumber: number,
  isDue: boolean,
  storedPhq9s: readonly StoredPhq9[]
): Phq9Progress {
  if (!isDue) return 'not_started';

  const currentCompleted = storedPhq9s.find(
    (p) =>
      (p.completedInRoundNumber === openRoundNumber || p.roundNumber === openRoundNumber) &&
      p.progress === 'completed'
  );
  if (currentCompleted) return 'completed';

  const currentUnfinished = storedPhq9s.find((p) => p.progress === 'unfinished');
  if (currentUnfinished) return 'unfinished';

  return 'not_started';
}

export async function getCheckInState(
  actor: Actor,
  input: GetCheckInStateInput,
  ports: Ports
): Promise<UseCaseResult<CheckInState>> {
  // Point G: decideAccess must be asked before anything else is done
  const clinicId = (actor as { clinicId?: string }).clinicId ?? 'unknown';
  const initialTarget: TargetData = {
    kind: 'rounds',
    patientId: input?.patientId,
    clinicId,
  };
  const initialAccess = decideAccess({
    actor,
    action: 'read',
    target: initialTarget,
    purpose: USE_CASE_PURPOSE,
  });

  if (!initialAccess.ok) {
    return { ok: false, error: initialAccess.error };
  }

  if (!initialAccess.value.allowed) {
    // Point E: Refusal log entry is written on its own, before and outside unit of work
    if (initialAccess.value.log) {
      await ports.accessLog.appendLog({
        actor,
        action: 'read',
        target: initialTarget,
        purpose: USE_CASE_PURPOSE,
        allowed: false,
        reason: initialAccess.value.reason,
        timestamp: ports.clock.now(),
      });
    }
    return { ok: false, error: initialAccess.value.reason };
  }

  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }

  let accessError: string | null = null;
  let returnValue: CheckInState | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      // Point D & G: Clock read exactly once inside unit of work
      const now = ports.clock.now();

      // This one read is what the access decision itself requires.
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) throw new Error('Patient not found');

      const target: TargetData = {
        kind: 'rounds',
        patientId: switches.patientId,
        clinicId: switches.clinicId,
      };

      const access = decideAccess({
        actor,
        action: 'read',
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
            action: 'read',
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
          action: 'read',
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
      if (!openRound) {
        returnValue = {
          openRound: null,
          taps: 'waiting',
          isPhq9Due: false,
          phq9Progress: 'not_started',
          hasSuggestionWaiting: false,
          extraItem: null,
        };
        return;
      }

      const [storedRounds, storedPhq9s, smallDips] = await Promise.all([
        ports.rounds.getRounds(patient.patientId),
        ports.phq9.getPhq9s(patient.patientId),
        ports.smallDips.getSmallDips(patient.patientId),
      ]);

      const currentRoundRecord = storedRounds.find((r) => r.roundNumber === openRound.number);
      const taps: 'waiting' | 'answered' | 'not_today' =
        currentRoundRecord?.status === 'answered'
          ? 'answered'
          : currentRoundRecord?.status === 'not_today'
            ? 'not_today'
            : 'waiting';
      const history = buildPhq9DueHistory(openRound.number, storedRounds, storedPhq9s);
      const phq9Due = isPhq9Due(openRound.number, history);
      const phq9Progress = resolvePhq9Progress(openRound.number, phq9Due, storedPhq9s);
      const hasSuggestionWaiting = smallDips.some((d) => d.roundNumber === openRound.number);
      const extraConfig = ports.extraItemsConfig ?? DEFAULT_EXTRA_ITEMS_CONFIG;
      const extraItem = getOfferedExtraItem(openRound.number, extraConfig);

      returnValue = {
        openRound: {
          number: openRound.number,
          localDate: openRound.localDate,
          opensAt: openRound.opensAt,
          endsAt: openRound.endsAt,
        },
        taps,
        isPhq9Due: phq9Due,
        phq9Progress,
        hasSuggestionWaiting,
        extraItem,
      };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: returnValue! };
}
