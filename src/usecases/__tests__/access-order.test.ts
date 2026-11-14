import { describe, expect, it, vi } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { evaluatePatient } from '../evaluate-patient';
import { getCheckInState } from '../get-check-in-state';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { submitExtraAnswer } from '../submit-extra-answer';

describe('Access Decision Order across all Use Cases (Point 3)', () => {
  const patientId = 'patient-order-test';
  const clinicId = 'clinic-1';

  const systemActor: SystemActor = { kind: 'system' };
  const patientActor: PatientActor = { kind: 'patient', patientId, clinicId };

  const activeRecord: PatientRecord = {
    patientId,
    clinicId,
    schedule: {
      weekdays: [1, 4],
      timeOfDay: '18:00',
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2026-11-16',
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  const recordConsentOff: PatientRecord = {
    ...activeRecord,
    consent: {
      taking_part: false,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it('closeElapsedRounds never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('evaluatePatient never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await evaluatePatient(systemActor, { patientId }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('submitTaps never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('submitNotToday never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await submitNotToday(patientActor, { patientId }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('submitPhq9Answer never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await submitPhq9Answer(patientActor, { patientId, itemId: '1', value: 0 }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('getCheckInState never reads patient data when patient is forbidden', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    const otherPatient: PatientActor = { kind: 'patient', patientId: 'other', clinicId };
    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await getCheckInState(otherPatient, { patientId }, ports);
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });

  it('submitExtraAnswer never reads patient data when consent is off', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(recordConsentOff);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const res = await submitExtraAnswer(
      patientActor,
      { patientId, itemId: 'extra_sleep', value: 3 },
      ports
    );
    expect(res.ok).toBe(false);
    expect(getPatientSpy).not.toHaveBeenCalled();
  });
});
