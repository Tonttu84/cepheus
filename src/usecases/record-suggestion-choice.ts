import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { Ports, SuggestionStatus, UseCaseResult } from './ports';

export interface RecordSuggestionChoiceInput {
  readonly patientId: string;
  readonly suggestionId: string;
  readonly choice: 'accepted' | 'skipped';
}

export interface RecordSuggestionChoiceResult {
  readonly recorded: true;
  readonly status: SuggestionStatus;
}

export type RecordSuggestionChoiceError = {
  readonly status?: SuggestionStatus;
};

const USE_CASE_PURPOSE: Purpose = 'self_access';

export async function recordSuggestionChoice(
  actor: Actor,
  input: RecordSuggestionChoiceInput,
  ports: Ports
): Promise<UseCaseResult<RecordSuggestionChoiceResult, RecordSuggestionChoiceError>> {
  const clinicId = (actor as { clinicId?: string }).clinicId ?? 'unknown';
  const initialTarget: TargetData = {
    kind: 'answers',
    patientId: input?.patientId,
    clinicId,
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

  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }
  if (!input.suggestionId || typeof input.suggestionId !== 'string') {
    return { ok: false, error: 'Invalid suggestionId' };
  }
  if (input.choice !== 'accepted' && input.choice !== 'skipped') {
    return { ok: false, error: 'Invalid choice' };
  }

  let accessError: string | null = null;
  let executionError: string | null = null;
  let storedStatus: SuggestionStatus | undefined;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
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

      const suggestion = await ports.suggestions.getSuggestion(input.suggestionId);
      if (!suggestion) {
        executionError = 'suggestion_not_found';
        return;
      }

      if (suggestion.patientId !== input.patientId) {
        executionError = 'not_own_data';
        return;
      }

      // Rule: A second choice on the same suggestion is refused
      if (suggestion.status !== 'shown') {
        executionError = 'already_answered';
        storedStatus = suggestion.status;
        return;
      }

      await ports.suggestions.updateSuggestionChoice(suggestion.id, input.choice, now);
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }
  if (executionError) {
    if (executionError === 'already_answered' && storedStatus) {
      return { ok: false, error: executionError, status: storedStatus };
    }
    return { ok: false, error: executionError };
  }

  return { ok: true, value: { recorded: true, status: input.choice } };
}
