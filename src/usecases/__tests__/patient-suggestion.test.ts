import { beforeEach, describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '@/domain/access';
import {
  getPatientSuggestion,
  recordSuggestionChoice,
  type PatientRecord,
  type Ports,
  type StoredSuggestion,
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

function createSuggestion(
  patientId: string,
  overrides: Partial<StoredSuggestion> = {}
): StoredSuggestion {
  return {
    id: `sug-${patientId}-1`,
    patientId,
    clinicId: CLINIC_ID,
    createdAt: '2026-11-16T10:00:00.000Z',
    date: '2026-11-16',
    dayIndex: 1,
    reason: 'practice',
    actionKey: 'short_walk',
    actionTitle: 'Take a 10-minute walk outside',
    actionDetail: 'Step outside for ten minutes at an easy pace.',
    effortTier: 'low',
    status: 'shown',
    respondedAt: null,
    isSimulated: true,
    ...overrides,
  };
}

describe('Patient suggestion use cases', () => {
  let ports: Ports;
  let clock: ReturnType<typeof createFakePorts>['clock'];
  const actorPatientA: PatientActor = { kind: 'patient', patientId: PATIENT_A, clinicId: CLINIC_ID };
  const actorStaff: StaffActor = { kind: 'staff', staffId: 'nurse-1', clinicId: CLINIC_ID, role: 'nurse' };

  beforeEach(async () => {
    const fake = createFakePorts('2026-11-16T18:00:00.000Z');
    ports = fake.ports;
    clock = fake.clock;
    await ports.patients.savePatient(createPatientRecord(PATIENT_A));
    await ports.patients.savePatient(createPatientRecord(PATIENT_B));
  });

  describe('getPatientSuggestion', () => {
    it('returns null when there is no suggestion for the patient', async () => {
      const res = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.suggestion).toBeNull();
      }
    });

    it('returns the latest suggestion when one exists in storage', async () => {
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const res = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.suggestion).toEqual(sug);
      }
    });

    it('shows an answered suggestion on the day it was answered', async () => {
      const answeredSug = createSuggestion(PATIENT_A, {
        status: 'accepted',
        respondedAt: '2026-11-16T10:30:00.000Z',
      });
      await ports.suggestions.saveSuggestion(answeredSug);

      // Same day (2026-11-16)
      clock.setNow('2026-11-16T18:00:00.000Z');
      const res = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.suggestion).toEqual(answeredSug);
      }
    });

    it('returns null (empty state) for an answered suggestion from the next day until a new suggestion exists', async () => {
      const answeredSug = createSuggestion(PATIENT_A, {
        status: 'accepted',
        respondedAt: '2026-11-16T10:30:00.000Z',
      });
      await ports.suggestions.saveSuggestion(answeredSug);

      // Advance clock to next day: 2026-11-17
      clock.setNow('2026-11-17T09:00:00.000Z');
      const resNextDay = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(resNextDay.ok).toBe(true);
      if (resNextDay.ok) {
        expect(resNextDay.value.suggestion).toBeNull();
      }

      // When a new suggestion is created later, it is returned
      const newSug = createSuggestion(PATIENT_A, {
        id: 'sug-patient-a-2',
        createdAt: '2026-11-18T10:00:00.000Z',
        date: '2026-11-18',
        status: 'shown',
        respondedAt: null,
      });
      await ports.suggestions.saveSuggestion(newSug);

      clock.setNow('2026-11-18T10:30:00.000Z');
      const resWithNew = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(resWithNew.ok).toBe(true);
      if (resWithNew.ok) {
        expect(resWithNew.value.suggestion).toEqual(newSug);
      }
    });

    it('keeps an open (shown) suggestion visible across days until answered', async () => {
      const openSug = createSuggestion(PATIENT_A, {
        status: 'shown',
        createdAt: '2026-11-15T10:00:00.000Z',
        date: '2026-11-15',
      });
      await ports.suggestions.saveSuggestion(openSug);

      clock.setNow('2026-11-17T12:00:00.000Z');
      const res = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.suggestion).toEqual(openSug);
      }
    });

    it('refuses when a patient tries to read another patient suggestion', async () => {
      const res = await getPatientSuggestion(actorPatientA, { patientId: PATIENT_B }, ports);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('not_own_data');
      }
    });

    it('refuses when staff attempts to read clinical suggestions', async () => {
      const res = await getPatientSuggestion(actorStaff, { patientId: PATIENT_A }, ports);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('clinic_staff_forbidden_clinical_data');
      }
    });
  });

  describe('recordSuggestionChoice', () => {
    it('records a choice (accepted) and updates suggestion status and respondedAt', async () => {
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const res = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'accepted' },
        ports
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.recorded).toBe(true);
        expect(res.value.status).toBe('accepted');
      }

      const updated = await ports.suggestions.getSuggestion(sug.id);
      expect(updated?.status).toBe('accepted');
      expect(updated?.respondedAt).toBe('2026-11-16T18:00:00.000Z');
    });

    it('records a choice (skipped) without punishment', async () => {
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const res = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'skipped' },
        ports
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.recorded).toBe(true);
        expect(res.value.status).toBe('skipped');
      }

      const updated = await ports.suggestions.getSuggestion(sug.id);
      expect(updated?.status).toBe('skipped');
      expect(updated?.respondedAt).toBe('2026-11-16T18:00:00.000Z');
    });

    it('refuses a second choice on the same suggestion (immutable once answered)', async () => {
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const firstChoice = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'accepted' },
        ports
      );
      expect(firstChoice.ok).toBe(true);

      const secondChoice = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'skipped' },
        ports
      );
      expect(secondChoice.ok).toBe(false);
      if (!secondChoice.ok) {
        expect(secondChoice.error).toBe('already_answered');
      }

      const stored = await ports.suggestions.getSuggestion(sug.id);
      expect(stored?.status).toBe('accepted');
    });

    it('refuses when a patient tries to answer another patient suggestion', async () => {
      const sugB = createSuggestion(PATIENT_B);
      await ports.suggestions.saveSuggestion(sugB);

      const res = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sugB.id, choice: 'accepted' },
        ports
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('not_own_data');
      }
    });

    it('refuses when staff attempts to answer a suggestion', async () => {
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const res = await recordSuggestionChoice(
        actorStaff,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'accepted' },
        ports
      );
      expect(res.ok).toBe(false);
    });

    it('refuses when patient has paused taking part consent', async () => {
      await ports.patients.savePatient(
        createPatientRecord(PATIENT_A, {
          consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false },
        })
      );
      const sug = createSuggestion(PATIENT_A);
      await ports.suggestions.saveSuggestion(sug);

      const res = await recordSuggestionChoice(
        actorPatientA,
        { patientId: PATIENT_A, suggestionId: sug.id, choice: 'accepted' },
        ports
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('consent_required');
      }
    });
  });
});
