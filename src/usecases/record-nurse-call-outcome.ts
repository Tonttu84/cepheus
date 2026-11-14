import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type {
  CallPosition,
  NurseCallActionTaken,
  NurseCallOutcomeTier,
  NurseCallStatus,
  Ports,
  UseCaseResult,
} from './ports';

export interface RecordNurseCallOutcomeInput {
  readonly patientId: string;
  readonly flagId?: string | null;
  readonly status?: NurseCallStatus;
  readonly outcomeTier?: NurseCallOutcomeTier | null;
  readonly actionTaken?: NurseCallActionTaken | null;
  readonly medicationChecked?: boolean;
  readonly watchNextRounds?: number;
  readonly boosterSessionsPlanned?: number | null;
  readonly date?: string | null;
  readonly position?: CallPosition | null;
}

export interface RecordNurseCallOutcomeResult {
  readonly id: string;
  readonly patientId: string;
  readonly flagId?: string | null;
  readonly status: NurseCallStatus;
  readonly outcomeTier?: NurseCallOutcomeTier | null;
  readonly actionTaken?: NurseCallActionTaken | null;
  readonly flagStatus?: string | null;
}

const USE_CASE_PURPOSE: Purpose = 'care';

const VALID_STATUSES: ReadonlySet<string> = new Set(['requested', 'completed', 'unreachable']);
const VALID_OUTCOME_TIERS: ReadonlySet<string> = new Set([
  'rough_patch',
  'sustained_decline',
  'full_relapse',
  'crisis',
  'false_alarm',
]);
const VALID_ACTIONS: ReadonlySet<string> = new Set([
  'advice_and_medication_check',
  'booster_tms_cluster',
  'new_tms_course_referral',
  'urgent_care',
  'none',
]);

function computeFlagStatus(
  status: NurseCallStatus,
  actionTaken?: NurseCallActionTaken | null,
  outcomeTier?: NurseCallOutcomeTier | null,
  watchNextRounds?: number
): string {
  if (status === 'unreachable') return 'nurse_call_requested';
  if (actionTaken === 'booster_tms_cluster') return 'booster_offered';
  if (actionTaken === 'advice_and_medication_check' || outcomeTier === 'rough_patch' || (watchNextRounds ?? 0) > 0) {
    return 'watching';
  }
  return 'resolved';
}

/**
 * Records the outcome of a nurse call regarding a flag.
 * Updates the flag status according to the decision rows and registers the call
 * so the warning rule restarts.
 */
export async function recordNurseCallOutcome(
  actor: Actor,
  input: RecordNurseCallOutcomeInput,
  ports: Ports
): Promise<UseCaseResult<RecordNurseCallOutcomeResult>> {
  if (actor.kind !== 'staff') {
    return { ok: false, error: 'Only clinic staff may record nurse calls' };
  }

  const status: NurseCallStatus = input.status ?? 'completed';
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, error: 'Invalid nurse call status' };
  }

  if (input.outcomeTier !== undefined && input.outcomeTier !== null && !VALID_OUTCOME_TIERS.has(input.outcomeTier)) {
    return { ok: false, error: 'Invalid nurse call outcome tier' };
  }

  if (input.actionTaken !== undefined && input.actionTaken !== null && !VALID_ACTIONS.has(input.actionTaken)) {
    return { ok: false, error: 'Invalid nurse call action taken' };
  }

  const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
  if (!switches) {
    return { ok: false, error: 'Patient not found' };
  }

  const target: TargetData = {
    kind: 'call_outcomes',
    patientId: switches.patientId,
    clinicId: switches.clinicId,
  };

  const initialAccess = decideAccess({
    actor,
    action: 'write',
    target,
    purpose: USE_CASE_PURPOSE,
    consent: switches.consent,
  });

  if (!initialAccess.ok) {
    return { ok: false, error: initialAccess.error };
  }

  if (!initialAccess.value.allowed) {
    if (initialAccess.value.log) {
      await ports.accessLog.appendLog({
        actor,
        action: 'write',
        target,
        purpose: USE_CASE_PURPOSE,
        allowed: false,
        reason: initialAccess.value.reason,
        timestamp: ports.clock.now(),
      });
    }
    return { ok: false, error: initialAccess.value.reason };
  }

  let resultValue: RecordNurseCallOutcomeResult | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      const date = input.date ?? now.slice(0, 10);
      const position = input.position ?? 'after';

      const watchRounds =
        input.watchNextRounds !== undefined
          ? input.watchNextRounds
          : input.outcomeTier === 'rough_patch'
            ? 2
            : 0;

      const boosterPlanned =
        input.boosterSessionsPlanned !== undefined
          ? input.boosterSessionsPlanned
          : input.actionTaken === 'booster_tms_cluster'
            ? 5
            : null;

      const flagStatus = input.flagId
        ? computeFlagStatus(status, input.actionTaken, input.outcomeTier, watchRounds)
        : null;

      const stored = await ports.calls.saveNurseCallRecord({
        patientId: input.patientId,
        clinicId: switches.clinicId,
        flagId: input.flagId ?? null,
        staffUserId: actor.staffId,
        requestedAt: now,
        completedAt: status === 'unreachable' ? null : now,
        status,
        outcomeTier: input.outcomeTier ?? null,
        actionTaken: input.actionTaken ?? null,
        medicationChecked: input.medicationChecked ?? false,
        watchNextRounds: watchRounds,
        boosterSessionsPlanned: boosterPlanned,
        date: status === 'unreachable' ? null : date,
        position: status === 'unreachable' ? null : position,
      });

      if (input.flagId && flagStatus) {
        await ports.warnings.updateFlagStatus(input.flagId, flagStatus);
      }

      if (initialAccess.value.log) {
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

      resultValue = {
        id: stored.id ?? 'recorded-call',
        patientId: input.patientId,
        flagId: input.flagId ?? null,
        status,
        outcomeTier: input.outcomeTier ?? null,
        actionTaken: input.actionTaken ?? null,
        flagStatus,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Storage failed',
    };
  }

  if (!resultValue) {
    return { ok: false, error: 'Could not record nurse call' };
  }

  return { ok: true, value: resultValue };
}
