import { describe, expect, it } from 'vitest';
import type { Actor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitCameraReading } from '../submit-camera-reading';

const PATIENT_ID = 'p-cam-1';
const CLINIC_ID = 'clinic-cam-1';

const PATIENT_ACTOR: Actor = {
  kind: 'patient',
  patientId: PATIENT_ID,
  clinicId: CLINIC_ID,
};

function makePatient(
  overrides: Partial<PatientRecord['consent']> = {}
): PatientRecord {
  return {
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    schedule: {
      enrolmentDate: '2026-11-01',
      weekdays: [1, 4],
      timeOfDay: '10:00',
      timeZone: 'Europe/Helsinki',
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: true },
      rule_check: true,
      ...overrides,
    },
  };
}

const VALID_INPUT = {
  patientId: PATIENT_ID,
  durationSec: 20,
  effectiveFps: 10,
  faceDetectedRatio: 0.92,
  expressivityScore: 0.14,
  angularPathDegPerMin: 210,
};

describe('submitCameraReading', () => {
  it('saves only derived numbers when taking_part and camera consent are enabled', async () => {
    const { ports, ctx } = createFakePorts('2026-11-16T10:30:00.000Z');
    await ports.patients.savePatient(makePatient());

    const res = await submitCameraReading(PATIENT_ACTOR, VALID_INPUT, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.saved).toBe(true);
    expect(res.value.readingId).toBeTruthy();

    const stored = ctx.state.cameraReadings[PATIENT_ID] ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      patientId: PATIENT_ID,
      date: '2026-11-16',
      taskId: 'check_in_clip_60s',
      durationSec: 20,
      effectiveFps: 10,
      faceDetectedRatio: 0.92,
      expressivityScore: 0.14,
      angularPathDegPerMin: 210,
      source: 'live',
    });
  });

  it('refuses with consent_required when camera consent is paused', async () => {
    const { ports, ctx } = createFakePorts();
    await ports.patients.savePatient(
      makePatient({ methods: { ring: true, camera: false } })
    );

    const res = await submitCameraReading(PATIENT_ACTOR, VALID_INPUT, ports);
    expect(res).toEqual({ ok: false, error: 'consent_required' });
    expect(ctx.state.cameraReadings[PATIENT_ID] ?? []).toHaveLength(0);
  });

  it('refuses with consent_required when taking_part is false even if camera switch was true', async () => {
    const { ports, ctx } = createFakePorts();
    await ports.patients.savePatient(makePatient({ taking_part: false }));

    const res = await submitCameraReading(PATIENT_ACTOR, VALID_INPUT, ports);
    expect(res).toEqual({ ok: false, error: 'consent_required' });
    expect(ctx.state.cameraReadings[PATIENT_ID] ?? []).toHaveLength(0);
  });

  it('refuses staff and other patients via decideAccess before loading or writing', async () => {
    const { ports, ctx } = createFakePorts();
    await ports.patients.savePatient(makePatient());

    const staffActor: Actor = { kind: 'staff', staffId: 's-1', clinicId: CLINIC_ID, role: 'nurse' };
    const otherPatient: Actor = { kind: 'patient', patientId: 'other', clinicId: CLINIC_ID };

    const staffRes = await submitCameraReading(staffActor, VALID_INPUT, ports);
    expect(staffRes.ok).toBe(false);

    const otherRes = await submitCameraReading(otherPatient, VALID_INPUT, ports);
    expect(otherRes).toEqual({ ok: false, error: 'not_own_data' });
    expect(ctx.state.cameraReadings[PATIENT_ID] ?? []).toHaveLength(0);
  });

  it('rejects non-finite or out-of-range derived metrics', async () => {
    const { ports, ctx } = createFakePorts();
    await ports.patients.savePatient(makePatient());

    const badDuration = await submitCameraReading(
      PATIENT_ACTOR,
      { ...VALID_INPUT, durationSec: 0 },
      ports
    );
    expect(badDuration).toEqual({ ok: false, error: 'Invalid durationSec' });

    const badRatio = await submitCameraReading(
      PATIENT_ACTOR,
      { ...VALID_INPUT, faceDetectedRatio: 1.5 },
      ports
    );
    expect(badRatio).toEqual({ ok: false, error: 'Invalid faceDetectedRatio' });

    expect(ctx.state.cameraReadings[PATIENT_ID] ?? []).toHaveLength(0);
  });

  it('rolls back and returns error on unit of work failure', async () => {
    const { ports, ctx, unitOfWork } = createFakePorts();
    await ports.patients.savePatient(makePatient());
    unitOfWork.failNext = true;

    const res = await submitCameraReading(PATIENT_ACTOR, VALID_INPUT, ports);
    expect(res.ok).toBe(false);
    expect(ctx.state.cameraReadings[PATIENT_ID] ?? []).toHaveLength(0);
  });
});
