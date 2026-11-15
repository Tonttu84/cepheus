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

    it('layer 1: agrees to taking part and turns taking_part switch on', async () => {
      await ports.patients.savePatient(
        createPatientRecord(PATIENT_A, {
          consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false },
        })
      );

      const before = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(before.ok && before.value.consent.taking_part).toBe(false);

      const res = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'taking_part', enabled: true },
        ports
      );
      expect(res.ok).toBe(true);

      const after = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(after.ok && after.value.consent.taking_part).toBe(true);
    });

    it('each layer: updates layer 1, layer 2 methods, and layer 3 detailed answers independently', async () => {
      // Layer 1
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'taking_part', enabled: true },
        ports
      );
      // Layer 2
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'ring_rhythm', enabled: true },
        ports
      );
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'camera_expressivity', enabled: true },
        ports
      );
      // Layer 3
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'detailed_answers', enabled: true },
        ports
      );

      const read = await getPatientConsent(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.consent.taking_part).toBe(true);
        expect(read.value.consent.methods.ring).toBe(true);
        expect(read.value.consent.methods.camera).toBe(true);
        expect(read.value.consent.detailed_answers).toBe(true);
      }
    });

    it('a patient without layer 3 never gets item answers written on completion', async () => {
      // Patient A has layer 3 off
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'detailed_answers', enabled: false },
        ports
      );

      await ports.phq9.savePhq9({
        patientId: PATIENT_A,
        roundNumber: 1,
        progress: 'completed',
        answers: [{ id: '1', value: 2 }, { id: '2', value: 1 }],
        total: 3,
        completedAt: '2026-11-16T18:00:00.000Z',
        completedInRoundNumber: 1,
        date: '2026-11-16',
      });

      const assessments = await ports.phq9.getPhq9s(PATIENT_A);
      expect(assessments).toHaveLength(1);
      expect(assessments[0].total).toBe(3);
      expect(assessments[0].answers).toEqual([]);
    });

    it('withdrawing layer 3 deletes kept answers, and another patient is never affected', async () => {
      const actorPatientB: PatientActor = { kind: 'patient', patientId: PATIENT_B, clinicId: CLINIC_ID };

      // Both patients have layer 3 on initially
      await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'detailed_answers', enabled: true },
        ports
      );
      await updateMethodConsent(
        actorPatientB,
        { patientId: PATIENT_B, method: 'detailed_answers', enabled: true },
        ports
      );

      // Save completed PHQ-9 for Patient A and Patient B
      await ports.phq9.savePhq9({
        patientId: PATIENT_A,
        roundNumber: 1,
        progress: 'completed',
        answers: [{ id: '1', value: 3 }, { id: '2', value: 2 }],
        total: 5,
        completedAt: '2026-11-16T18:00:00.000Z',
        completedInRoundNumber: 1,
        date: '2026-11-16',
      });
      await ports.phq9.savePhq9({
        patientId: PATIENT_B,
        roundNumber: 1,
        progress: 'completed',
        answers: [{ id: '1', value: 1 }, { id: '2', value: 1 }],
        total: 2,
        completedAt: '2026-11-16T18:00:00.000Z',
        completedInRoundNumber: 1,
        date: '2026-11-16',
      });

      // Both initially have their item answers kept
      const phq9AInitial = await ports.phq9.getPhq9s(PATIENT_A);
      const phq9BInitial = await ports.phq9.getPhq9s(PATIENT_B);
      expect(phq9AInitial[0].answers).toEqual([{ id: '1', value: 3 }, { id: '2', value: 2 }]);
      expect(phq9BInitial[0].answers).toEqual([{ id: '1', value: 1 }, { id: '2', value: 1 }]);

      // Patient A withdraws layer 3
      const withdrawRes = await updateMethodConsent(
        actorPatientA,
        { patientId: PATIENT_A, method: 'detailed_answers', enabled: false },
        ports
      );
      expect(withdrawRes.ok).toBe(true);

      // Patient A's kept answers are deleted (empty), total is kept
      const phq9AAfter = await ports.phq9.getPhq9s(PATIENT_A);
      expect(phq9AAfter[0].total).toBe(5);
      expect(phq9AAfter[0].answers).toEqual([]);

      // Patient B is completely unaffected!
      const phq9BAfter = await ports.phq9.getPhq9s(PATIENT_B);
      expect(phq9BAfter[0].total).toBe(2);
      expect(phq9BAfter[0].answers).toEqual([{ id: '1', value: 1 }, { id: '2', value: 1 }]);
    });
  });
});
