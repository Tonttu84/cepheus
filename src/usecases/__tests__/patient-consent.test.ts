import { beforeEach, describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '@/domain/access';
import {
  getPatientConsent,
  updateMethodConsent,
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
  const actorStaff: StaffActor = { kind: 'staff', staffId: 'nurse-1', clinicId: CLINIC_ID, role: 'nurse' };

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

  describe('updateMethodConsent', () => {
    it('switches a method off and it stays off until switched on', async () => {
      // Turn ring off
      const res1 = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'ring', enabled: false },
        ports
      );
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.value).toEqual({ method: 'ring', enabled: false });
      }

      // Verify it is off
      const read1 = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(read1.ok && read1.value.consent.methods.ring).toBe(false);

      // Verify it stays off
      const read2 = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(read2.ok && read2.value.consent.methods.ring).toBe(false);

      // Switch back on
      const res2 = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'ring_rhythm', enabled: true },
        ports
      );
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.value).toEqual({ method: 'ring', enabled: true });
      }

      const read3 = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(read3.ok && read3.value.consent.methods.ring).toBe(true);
    });

    it('switches camera from off to on and accepts camera_expressivity name', async () => {
      const res = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'camera_expressivity', enabled: true },
        ports
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toEqual({ method: 'camera', enabled: true });
      }

      const read = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(read.ok && read.value.consent.methods.camera).toBe(true);
    });

    it('refuses when a patient tries to update another patient consent', async () => {
      const res = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_B, method: 'ring', enabled: false },
        ports
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('not_own_data');
      }
    });

    it('refuses when staff attempts to update patient consent', async () => {
      const res = await updateMethodConsent(
        actorStaff,
        { patientId: PATIENT_A, method: 'ring', enabled: false },
        ports
      );
      expect(res.ok).toBe(false);
    });
  });
});
