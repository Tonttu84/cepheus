import { describe, it, expect, beforeEach } from 'vitest';
import { createFakePorts } from '../testing/fake-ports';
import { storeCameraReading } from '../store-camera-reading';
import type { PatientActor, StaffActor } from '../../domain/access';
import { INITIAL_CONSENT_STATE } from '../../domain/consent';

describe('storeCameraReading use case', () => {
  let deps: ReturnType<typeof createFakePorts>;
  const patientId = 'pt-1';
  const clinicId = 'clinic-1';
  const actor: PatientActor = { kind: 'patient', patientId, clinicId };

  const validReading = {
    patientId,
    date: '2026-11-15',
    durationSec: 20,
    effectiveFps: 30,
    faceDetectedRatio: 0.95,
    expressivityScore: 0.12,
    smileFraction: 0.05,
    yawSdDeg: 2.1,
    pitchSdDeg: 1.5,
    angularPathDegPerMin: 120,
  };

  beforeEach(async () => {
    deps = createFakePorts();
    await deps.ports.patients.savePatient({
      patientId,
      clinicId,
      schedule: { weekdays: [1, 4], timeOfDay: '08:00', timeZone: 'UTC', enrolmentDate: '2026-11-01' },
      consent: {
        ...INITIAL_CONSENT_STATE,
        taking_part: true,
        methods: { ...INITIAL_CONSENT_STATE.methods, camera: true },
      },
    });
  });

  it('stores a reading successfully when consent is granted', async () => {
    const result = await storeCameraReading(actor, validReading, deps.ports);
    expect(result.ok).toBe(true);

    const readings = await deps.ports.camera!.getCameraReadings(patientId);
    expect(readings.length).toBe(1);
    expect(readings[0].expressivityScore).toBe(0.12);
  });

  it('refuses to store when taking_part consent is false', async () => {
    await deps.ports.patients.savePatient({
      patientId,
      clinicId,
      schedule: { weekdays: [1, 4], timeOfDay: '08:00', timeZone: 'UTC', enrolmentDate: '2026-11-01' },
      consent: { ...INITIAL_CONSENT_STATE, taking_part: false },
    });

    const result = await storeCameraReading(actor, validReading, deps.ports);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('consent_required');
    const readings = await deps.ports.camera!.getCameraReadings(patientId);
    expect(readings.length).toBe(0);
  });

  it('refuses to store when camera_expressivity consent is paused', async () => {
    await deps.ports.patients.savePatient({
      patientId,
      clinicId,
      schedule: { weekdays: [1, 4], timeOfDay: '08:00', timeZone: 'UTC', enrolmentDate: '2026-11-01' },
      consent: {
        ...INITIAL_CONSENT_STATE,
        taking_part: true,
        methods: { ...INITIAL_CONSENT_STATE.methods, camera: false },
      },
    });

    const result = await storeCameraReading(actor, validReading, deps.ports);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('consent_required');
    const readings = await deps.ports.camera!.getCameraReadings(patientId);
    expect(readings.length).toBe(0);
  });

  it('refuses if a different patient actor tries to write it', async () => {
    const otherActor: PatientActor = { kind: 'patient', patientId: 'other-pt', clinicId };
    const result = await storeCameraReading(otherActor, validReading, deps.ports);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_own_data');
  });

  it('refuses if staff tries to write it', async () => {
    const staffActor: StaffActor = { kind: 'staff', staffId: 'staff-1', clinicId, role: 'nurse' };
    const result = await storeCameraReading(staffActor, validReading, deps.ports);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('clinic_staff_forbidden_clinical_data');
  });
});
