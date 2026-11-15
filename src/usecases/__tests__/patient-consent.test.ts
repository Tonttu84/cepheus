import { beforeEach, describe, expect, it } from 'vitest';
import type { PatientActor } from '@/domain/access';
import {
  getPatientConsent,
  type PatientRecord,
  type Ports,
} from '@/usecases';
import { createFakePorts } from '@/usecases/testing';

const CLINIC_ID = 'clinic-1';
const PATIENT_A = 'patient-a';
const PATIENT_B = 'patient-b';

function createPatientRecord(
  patientId: string,
  overrides: Partial<PatientRecord> = {}
): PatientRecord {
  return {
    patientId,
    clinicId: CLINIC_ID,
    schedule: {
      weekdays: [1, 4],
      timeOfDay: '18:00',
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2026-11-16',
    },
    consent: {
      taking_part: true,
      methods: { ring: true, camera: false },
      rule_check: true,
    },
    ...overrides,
  };
}

describe('Patient consent use cases', () => {
  let ports: Ports;
  const actorPatientA: PatientActor = { kind: 'patient', patientId: PATIENT_A, clinicId: CLINIC_ID };

  beforeEach(async () => {
    const fake = createFakePorts();
    ports = fake.ports;
    await ports.patients.savePatient(createPatientRecord(PATIENT_A));
    await ports.patients.savePatient(createPatientRecord(PATIENT_B));
  });

  describe('getPatientConsent', () => {
    it('reads the patient consent switches', async () => {
      const res = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.consent).toEqual({
          taking_part: true,
          methods: { ring: true, camera: false },
          rule_check: true,
        });
      }
    });

    it('refuses when a patient tries to read another patient consent', async () => {
      const res = await getPatientConsent(actorPatientA, { patientId: PATIENT_B }, ports);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('not_own_data');
      }
    });
  });
});
