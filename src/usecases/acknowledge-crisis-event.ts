import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { Ports, UseCaseResult } from './ports';

export interface AcknowledgeCrisisEventInput {
  readonly patientId: string;
  readonly roundNumber: number;
}

export interface AcknowledgeCrisisEventResult {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly acknowledgedAt: string;
  readonly acknowledgedByStaffId: string;
}

const USE_CASE_PURPOSE: Purpose = 'care';

/**
 * Acknowledges an unacknowledged crisis event for a patient of the staff caller's clinic.
 * Can only be done once per event; the event's original values, item, and occurredAt never change.
 */
export async function acknowledgeCrisisEvent(
  actor: Actor,
  input: AcknowledgeCrisisEventInput,
  ports: Ports
): Promise<UseCaseResult<AcknowledgeCrisisEventResult>> {
  if (actor.kind !== 'staff') {
    return { ok: false, error: 'Only clinic staff may acknowledge crisis events' };
  }

  const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
  if (!switches) {
    return { ok: false, error: 'Patient not found' };
  }

  const target: TargetData = {
    kind: 'crisis_messages',
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

  let resultValue: AcknowledgeCrisisEventResult | null = null;
  let executionError: string | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      const events = await ports.crisis.getCrisisEvents(input.patientId);
      const found = events.find((e) => e.roundNumber === input.roundNumber);

      if (!found) {
        executionError = 'Crisis event not found';
        return;
      }

      if (found.acknowledgedAt) {
        executionError = 'Crisis event already acknowledged';
        return;
      }

      await ports.crisis.saveCrisisEvent({
        ...found,
        acknowledgedAt: now,
        acknowledgedByStaffId: actor.staffId,
      });

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
        patientId: input.patientId,
        roundNumber: input.roundNumber,
        acknowledgedAt: now,
        acknowledgedByStaffId: actor.staffId,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Storage failed',
    };
  }

  if (executionError) {
    return { ok: false, error: executionError };
  }

  if (!resultValue) {
    return { ok: false, error: 'Could not acknowledge crisis event' };
  }

  return { ok: true, value: resultValue };
}
