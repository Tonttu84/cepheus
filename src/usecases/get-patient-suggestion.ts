import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { Ports, StoredSuggestion, UseCaseResult } from './ports';

export interface GetPatientSuggestionInput {
  readonly patientId: string;
}

export interface GetPatientSuggestionResult {
  readonly suggestion: StoredSuggestion | null;
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

export async function getPatientSuggestion(
  actor: Actor,
  input: GetPatientSuggestionInput,
  ports: Ports
): Promise<UseCaseResult<GetPatientSuggestionResult>> {
  const clinicId = (actor as { clinicId?: string }).clinicId ?? 'unknown';
  const initialTarget: TargetData = {
    kind: 'suggestions',
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
  let suggestion: StoredSuggestion | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) throw new Error('Patient not found');

      const target: TargetData = {
        kind: 'suggestions',
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

      suggestion = await ports.suggestions.getLatestSuggestion(input.patientId);

      // An answered suggestion is shown as answered on the day it was answered
      // (by the clock the use case is given), and from the next day the card
      // shows the plain empty state until a new suggestion exists.
      if (suggestion && suggestion.status !== 'shown') {
        const answeredTimestamp = suggestion.respondedAt ?? suggestion.date ?? suggestion.createdAt;
        const answeredDay = answeredTimestamp.slice(0, 10);
        const currentDay = now.slice(0, 10);
        if (answeredDay !== currentDay) {
          suggestion = null;
        }
      }
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: { suggestion } };
}
