import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { Ports, UseCaseResult } from './ports';

export interface UnacknowledgedCrisisEventView {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly occurredAt: string;
}

const USE_CASE_PURPOSE: Purpose = 'care';

/**
 * Lists unacknowledged crisis events for patients of the staff caller's clinic.
 * Returns patient, round, and time; never exposes item values or answers.
 */
export async function listUnacknowledgedCrisisEvents(
  actor: Actor,
  ports: Ports
): Promise<UseCaseResult<readonly UnacknowledgedCrisisEventView[]>> {
  if (actor.kind !== 'staff') {
    return { ok: false, error: 'Only clinic staff may list crisis events' };
  }

  const events = await ports.crisis.getUnacknowledgedCrisisEvents(actor.clinicId);
  const now = ports.clock.now();
  const views: UnacknowledgedCrisisEventView[] = [];

  for (const event of events) {
    const switches = await ports.patients.getPatientAccessSwitches(event.patientId);
    if (!switches) continue;

    const target: TargetData = {
      kind: 'crisis_messages',
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

    if (!access.ok || !access.value.allowed) continue;

    if (access.value.log) {
      await ports.accessLog.appendLog({
        actor,
        action: 'read',
        target,
        purpose: USE_CASE_PURPOSE,
        allowed: true,
        reason: access.value.reason,
        timestamp: now,
      });
    }

    views.push({
      patientId: event.patientId,
      roundNumber: event.roundNumber,
      occurredAt: event.occurredAt,
    });
  }

  return { ok: true, value: views };
}
