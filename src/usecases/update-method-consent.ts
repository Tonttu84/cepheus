import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { MeasuringMethod } from '../domain/consent';
import type { Ports, UseCaseResult } from './ports';

export type AllowedConsentMethod =
  | 'ring'
  | 'camera'
  | 'ring_rhythm'
  | 'camera_expressivity'
  | 'home_routine'
  | 'detailed_answers'
  | 'taking_part'
  | 'check_in'
  | 'rule_check';

export type NormalizedConsentTarget =
  | MeasuringMethod
  | 'home_routine'
  | 'detailed_answers'
  | 'taking_part'
  | 'rule_check';

export interface UpdateMethodConsentInput {
  readonly patientId: string;
  readonly method: AllowedConsentMethod;
  readonly enabled: boolean;
}

export interface UpdateMethodConsentResult {
  readonly method: NormalizedConsentTarget;
  readonly enabled: boolean;
}

const USE_CASE_PURPOSE: Purpose = 'self_access';

function normalizeMethod(method: AllowedConsentMethod): NormalizedConsentTarget {
  if (method === 'ring' || method === 'ring_rhythm') return 'ring';
  if (method === 'camera' || method === 'camera_expressivity') return 'camera';
  if (method === 'home_routine') return 'home_routine';
  if (method === 'detailed_answers') return 'detailed_answers';
  if (method === 'taking_part' || method === 'check_in') return 'taking_part';
  if (method === 'rule_check') return 'rule_check';
  throw new Error(`Unknown measuring method: ${method}`);
}

export async function updateMethodConsent(
  actor: Actor,
  input: UpdateMethodConsentInput,
  ports: Ports
): Promise<UseCaseResult<UpdateMethodConsentResult>> {
  const clinicId = (actor as { clinicId?: string }).clinicId ?? 'unknown';
  const initialTarget: TargetData = {
    kind: 'consent',
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

  if (!input.patientId || typeof input.patientId !== 'string') {
    return { ok: false, error: 'Invalid patientId' };
  }

  let normalized: NormalizedConsentTarget;
  try {
    normalized = normalizeMethod(input.method);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid method' };
  }

  let accessError: string | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) throw new Error('Patient not found');

      const target: TargetData = {
        kind: 'consent',
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

      const patient = await ports.patients.getPatient(input.patientId);
      if (!patient) throw new Error('Patient not found');

      const updatedConsent = {
        ...patient.consent,
        ...(normalized === 'taking_part' ? { taking_part: input.enabled } : {}),
        ...(normalized === 'detailed_answers' ? { detailed_answers: input.enabled } : {}),
        ...(normalized === 'rule_check' ? { rule_check: input.enabled } : {}),
        ...(normalized === 'ring' || normalized === 'camera'
          ? {
              methods: {
                ...patient.consent.methods,
                [normalized]: input.enabled,
              },
            }
          : {}),
      };

      const updated = {
        ...patient,
        consent: updatedConsent,
      };

      await ports.patients.savePatient(updated);
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: { method: normalized, enabled: input.enabled } };
}
