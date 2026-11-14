import { describe, expect, it } from 'vitest';
import { decideAccess, type PatientActor, type StaffActor, type StaffRole } from '../../domain/access';
import type { PatientRecord, Ports } from '../ports';
import { createFakePorts } from '../testing';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { getCheckInState } from '../get-check-in-state';
import { closeElapsedRounds } from '../close-elapsed-rounds';

/**
 * The owner's answer-handling cases (D45). Each test names the case it covers.
 * Cases 1 (nothing on the device) and 5 (repeats) are covered elsewhere:
 * src/__tests__/no-local-storage.test.ts, e2e/no-local-storage.spec.ts,
 * repeats.test.ts and crisis.test.ts.
 */
describe('Answer Handling Cases', () => {
  const patientId = 'patient-case-1';
  const clinicId = 'clinic-1';
  // Round 1 opens Mon 16 Nov 18:00 Helsinki and ends when round 2 opens on Thu 19 Nov.
  const ROUND_1_OPEN = '2026-11-16T16:00:00.000Z';
  const ROUND_2_OPEN = '2026-11-19T16:00:00.000Z';

  const patientActor: PatientActor = { kind: 'patient', patientId, clinicId };
  const nurseActor: StaffActor = { kind: 'staff', staffId: 'nurse-1', clinicId, role: 'nurse' };

  const sampleRecord: PatientRecord = {
    patientId,
    clinicId,
    schedule: {
      weekdays: [1, 4],
      timeOfDay: '18:00',
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2026-11-16',
    },
    consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: false },
  };

  async function setUp() {
    const fake = createFakePorts(ROUND_1_OPEN);
    await fake.ports.patients.savePatient(sampleRecord);
    return fake;
  }

  /** Makes the next write through `save` succeed in memory and then throw, as a database might. */
  function failAfterWrite<T>(save: (value: T) => Promise<void>): (value: T) => Promise<void> {
    return async (value: T) => {
      await save(value);
      throw new Error('storage failed after write');
    };
  }

  async function answerPhq9(ports: Ports, items: readonly string[], value = 1) {
    for (const itemId of items) {
      const res = await submitPhq9Answer(patientActor, { patientId, itemId, value }, ports);
      expect(res.ok).toBe(true);
    }
  }

  describe('Case 2: an answer that cannot be saved is not queued and nothing is half-stored', () => {
    it('a taps save that fails after writing leaves no round, and the round later closes as missed with null scores', async () => {
      const { ports, clock, ctx } = await setUp();
      const realSave = ports.rounds.saveRound.bind(ports.rounds);
      ports.rounds.saveRound = failAfterWrite(realSave);

      const res = await submitTaps(patientActor, { patientId, mood: 3, interest: 1 }, ports);
      expect(res.ok).toBe(false);
      expect(ctx.state.rounds[patientId] ?? []).toEqual([]);

      ports.rounds.saveRound = realSave;
      clock.setNow(ROUND_2_OPEN);
      const closeRes = await closeElapsedRounds({ kind: 'system' }, { patientId }, ports);
      expect(closeRes.ok).toBe(true);

      const round = await ports.rounds.getRound(patientId, 1);
      expect(round?.status).toBe('missed');
      expect(round?.mood).toBeNull();
      expect(round?.interest).toBeNull();
    });

    it('a self-harm answer whose crisis event fails to save stores neither the answer nor the event', async () => {
      const { ports, ctx } = await setUp();
      await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);
      await answerPhq9(ports, ['1', '2']);
      const phq9Before = structuredClone(ctx.state.phq9[patientId]);

      ports.crisis.saveCrisisEvent = failAfterWrite(ports.crisis.saveCrisisEvent.bind(ports.crisis));
      const res = await submitPhq9Answer(patientActor, { patientId, itemId: '9', value: 2 }, ports);

      expect(res.ok).toBe(false);
      expect((res as { showCrisisPath?: boolean }).showCrisisPath).toBe(true);
      expect(ctx.state.phq9[patientId]).toEqual(phq9Before);
      expect(ctx.state.crisis[patientId] ?? []).toEqual([]);
    });
  });

  describe('Case 3: a self-harm answer shows the crisis path whatever happens to storage', () => {
    it('shows the crisis path when the consent to take part is paused, and stores nothing', async () => {
      const { ports, ctx } = await setUp();
      await ports.patients.savePatient({
        ...sampleRecord,
        consent: { ...sampleRecord.consent, taking_part: false },
      });

      const res = await submitPhq9Answer(patientActor, { patientId, itemId: '9', value: 2 }, ports);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('consent_required');
      expect((res as { showCrisisPath?: boolean }).showCrisisPath).toBe(true);
      expect(ctx.state.phq9[patientId] ?? []).toEqual([]);
      expect(ctx.state.crisis[patientId] ?? []).toEqual([]);
    });

    it('shows the crisis path when access is refused, and stores nothing', async () => {
      const { ports, ctx } = await setUp();
      await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

      const res = await submitPhq9Answer(nurseActor, { patientId, itemId: '9', value: 2 }, ports);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('clinic_staff_forbidden_clinical_data');
      expect((res as { showCrisisPath?: boolean }).showCrisisPath).toBe(true);
      expect(ctx.state.phq9[patientId] ?? []).toEqual([]);
      expect(ctx.state.crisis[patientId] ?? []).toEqual([]);
    });
  });

  describe('Case 4: a person who stops halfway can resume; no total until all nine items', () => {
    it('resumes the same questionnaire and gives a total only with the ninth item', async () => {
      const { ports } = await setUp();
      await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

      await submitPhq9Answer(patientActor, { patientId, itemId: '1', value: 1 }, ports);
      await submitPhq9Answer(patientActor, { patientId, itemId: '2', value: 2 }, ports);

      const stateHalf = await getCheckInState(patientActor, { patientId }, ports);
      expect(stateHalf.ok).toBe(true);
      if (!stateHalf.ok) return;
      expect(stateHalf.value.phq9Progress).toBe('unfinished');

      const half = await ports.phq9.getCurrentPhq9(patientId);
      expect(half?.progress).toBe('unfinished');
      expect(half?.total).toBeNull();
      expect(half?.answers).toHaveLength(2);

      // Resume later: items 3..8 join the same questionnaire, still without a total.
      await answerPhq9(ports, ['3', '4', '5', '6', '7', '8']);
      const eight = await ports.phq9.getPhq9s(patientId);
      expect(eight).toHaveLength(1);
      expect(eight[0].progress).toBe('unfinished');
      expect(eight[0].total).toBeNull();
      expect(eight[0].answers).toHaveLength(8);

      await answerPhq9(ports, ['9']);
      const stateComplete = await getCheckInState(patientActor, { patientId }, ports);
      expect(stateComplete.ok).toBe(true);
      if (!stateComplete.ok) return;
      expect(stateComplete.value.phq9Progress).toBe('completed');

      const all = await ports.phq9.getPhq9s(patientId);
      expect(all).toHaveLength(1);
      expect(all[0].progress).toBe('completed');
      expect(all[0].total).toBe(10); // 1 + 2 + 7 * 1
    });
  });

  describe('Case 6: the clinic does not get the individual answers', () => {
    const roles: StaffRole[] = ['nurse', 'admin'];
    const purposes = ['care', 'self_access', 'rule_check', 'administration', 'method:ring'];

    for (const role of roles) {
      it(`a clinic ${role} may not read answers for any purpose`, () => {
        for (const purpose of purposes) {
          const res = decideAccess({
            actor: { kind: 'staff', staffId: 's1', clinicId, role },
            action: 'read',
            target: { kind: 'answers', patientId, clinicId },
            purpose,
            consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: true },
          });
          expect(res.ok).toBe(true);
          if (res.ok) expect({ purpose, allowed: res.value.allowed }).toEqual({ purpose, allowed: false });
        }
      });
    }
  });

  describe('Case 7: "Not today" ends the round', () => {
    it('is stored as not today with null scores and no PHQ-9 answer is taken afterwards in that round', async () => {
      const { ports, ctx } = await setUp();

      const res = await submitNotToday(patientActor, { patientId }, ports);
      expect(res.ok).toBe(true);

      const state = await getCheckInState(patientActor, { patientId }, ports);
      expect(state.ok).toBe(true);
      if (!state.ok) return;
      expect(state.value.taps).toBe('not_today');

      const round = await ports.rounds.getRound(patientId, 1);
      expect(round?.status).toBe('not_today');
      expect(round?.mood).toBeNull();
      expect(round?.interest).toBeNull();

      const phq9 = await submitPhq9Answer(patientActor, { patientId, itemId: '1', value: 1 }, ports);
      expect(phq9.ok).toBe(false);
      expect(ctx.state.phq9[patientId] ?? []).toEqual([]);
    });
  });
});
