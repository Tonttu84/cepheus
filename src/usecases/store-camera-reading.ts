import { decideAccess, type Actor, type TargetData, type Purpose } from '../domain/access';
import type { Ports, UseCaseResult, StoredCameraReading } from './ports';

export interface StoreCameraReadingInput extends Omit<StoredCameraReading, 'participantId'> {
  readonly patientId: string;
}

const USE_CASE_PURPOSE: Purpose = 'method:camera';

export async function storeCameraReading(
  actor: Actor,
  input: StoreCameraReadingInput,
  ports: Ports
): Promise<UseCaseResult<void>> {
  const initialTarget: TargetData = {
    kind: 'readings',
    patientId: input.patientId,
    clinicId: actor.kind === 'patient' || actor.kind === 'staff' ? actor.clinicId : undefined,
    method: 'camera',
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
      actor.patientId === input.patientId &&
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

  let accessError: string | null = null;

  try {
    await ports.unitOfWork.execute(async () => {
      const now = ports.clock.now();
      const switches = await ports.patients.getPatientAccessSwitches(input.patientId);
      if (!switches) throw new Error('Patient not found');

      const target: TargetData = {
        kind: 'readings',
        patientId: switches.patientId,
        clinicId: switches.clinicId,
        method: 'camera',
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

      const { patientId, ...readingData } = input;
      
      if (!ports.camera) {
         throw new Error("Camera port not available");
      }

      await ports.camera.saveCameraReading({
        participantId: patientId,
        ...readingData,
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }

  if (accessError) {
    return { ok: false, error: accessError };
  }

  return { ok: true, value: undefined };
}

