import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import type { PatientRecord, Ports } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
import { submitGad7Answer } from '../submit-gad7-answer';

// Mondays and Thursdays at 18:00 Helsinki, from Monday 16 Nov 2026.
const ROUND_1 = '2026-11-16T16:00:00.000Z';
const ROUND_2 = '2026-11-19T16:00:00.000Z';
const ROUND_5 = '2026-11-30T16:00:00.000Z';

describe('Submit GAD-7 Answer', () => {
  const patientId = 'patient-gad7';
  const clinicId = 'clinic-1';

  const patientActor: PatientActor = {
    kind: 'patient',
    patientId,
    clinicId,
  };

  const sampleRecord: PatientRecord = {
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
    questionnaires: ['phq9', 'gad7'],
  };

  async function answerItems(ports: Ports, itemIds: readonly string[], value = 1) {
    for (const itemId of itemIds) {
      const res = await submitGad7Answer(patientActor, { patientId, itemId, value }, ports);
      expect(res.ok).toBe(true);
    }
  }

  async function setUpRound(record: PatientRecord = sampleRecord, now = ROUND_1) {
    const fake = createFakePorts(now);
    await fake.ports.patients.savePatient(record);
    const tapRes = await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, fake.ports);
    expect(tapRes.ok).toBe(true);
    return fake;
  }

  it('completes GAD-7 when all 7 questions are answered', async () => {
    const { ports } = await setUpRound();

    for (let i = 1; i <= 6; i++) {
      const res = await submitGad7Answer(
        patientActor,
        { patientId, itemId: String(i), value: 1 },
        ports
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.isComplete).toBe(false);
      expect(res.value.ruleRunNeeded).toBe(false);
    }

    const finalRes = await submitGad7Answer(
      patientActor,
      { patientId, itemId: '7', value: 1 },
      ports
    );
    expect(finalRes.ok).toBe(true);
    if (!finalRes.ok) return;
    expect(finalRes.value.isComplete).toBe(true);
    expect(finalRes.value.ruleRunNeeded).toBe(true);

    const gad7s = await ports.gad7!.getGad7s(patientId);
    expect(gad7s).toHaveLength(1);
    expect(gad7s[0].answers).toHaveLength(7);
    expect(gad7s[0].total).toBe(7);
    expect(gad7s[0].date).toBe('2026-11-16');
    expect(gad7s[0].completedAt).toBe(ROUND_1);
  });

  it('keeps no total while unfinished, and a changed answer replaces the earlier one', async () => {
    const { ports } = await setUpRound();
    await answerItems(ports, ['1', '2'], 1);
    await answerItems(ports, ['1'], 3);

    const [stored] = await ports.gad7!.getGad7s(patientId);
    expect(stored.total).toBeNull();
    expect(stored.date).toBeNull();
    expect(stored.answers).toEqual([
      { id: '1', value: 3 },
      { id: '2', value: 1 },
    ]);
  });

  it('cannot submit GAD-7 if patient does not have gad7 assigned', async () => {
    const { ports } = await setUpRound({ ...sampleRecord, questionnaires: ['phq9'] });

    const res = await submitGad7Answer(
      patientActor,
      { patientId, itemId: '1', value: 1 },
      ports
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('GAD-7 is not assigned to this patient');
    }
    expect(await ports.gad7!.getGad7s(patientId)).toHaveLength(0);
  });

  it('cannot submit GAD-7 before taps are answered', async () => {
    const { ports } = createFakePorts(ROUND_1);
    await ports.patients.savePatient(sampleRecord);

    const res = await submitGad7Answer(
      patientActor,
      { patientId, itemId: '1', value: 1 },
      ports
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('Cannot submit GAD-7 before taps are answered');
    }
  });

  it('cannot submit GAD-7 after it is completed for the round', async () => {
    const { ports } = await setUpRound();
    await answerItems(ports, ['1', '2', '3', '4', '5', '6', '7'], 0);

    const extraRes = await submitGad7Answer(
      patientActor,
      { patientId, itemId: '1', value: 1 },
      ports
    );
    expect(extraRes.ok).toBe(false);
    if (!extraRes.ok) {
      expect(extraRes.error).toContain('GAD-7 is already completed');
    }
  });

  it('treats a stored total as completed even when the item answers were not kept', async () => {
    // With STORE_ITEM_ANSWERS off, real storage returns a completed GAD-7 with
    // its total and no item answers.
    const { ports } = await setUpRound();
    await ports.gad7!.saveGad7({
      patientId,
      roundNumber: 1,
      answers: [],
      total: 12,
      completedAt: ROUND_1,
      date: '2026-11-16',
    });

    const res = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 1 }, ports);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('GAD-7 is already completed');
    const [stored] = await ports.gad7!.getGad7s(patientId);
    expect(stored.total).toBe(12);
  });

  it('is due on the PHQ-9 schedule: refused in round 2, offered again in round 5', async () => {
    const fake = await setUpRound();
    await answerItems(fake.ports, ['1', '2', '3', '4', '5', '6', '7'], 0);

    fake.clock.setNow(ROUND_2);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, fake.ports);
    const inRound2 = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 1 }, fake.ports);
    expect(inRound2.ok).toBe(false);
    if (!inRound2.ok) expect(inRound2.error).toContain('GAD-7 is not due in this round');

    fake.clock.setNow(ROUND_5);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, fake.ports);
    const inRound5 = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 1 }, fake.ports);
    expect(inRound5.ok).toBe(true);
  });

  it('carries an unfinished GAD-7 over to the next round and completes it there', async () => {
    const fake = await setUpRound();
    await answerItems(fake.ports, ['1', '2', '3'], 2);

    fake.clock.setNow(ROUND_2);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, fake.ports);
    await answerItems(fake.ports, ['4', '5', '6', '7'], 1);

    const gad7s = await fake.ports.gad7!.getGad7s(patientId);
    expect(gad7s).toHaveLength(1);
    expect(gad7s[0].roundNumber).toBe(1);
    expect(gad7s[0].total).toBe(10);
    expect(gad7s[0].date).toBe('2026-11-19');
  });

  it('has no crisis rule: the result carries no crisis path', async () => {
    const { ports } = await setUpRound();
    const res = await submitGad7Answer(patientActor, { patientId, itemId: '7', value: 3 }, ports);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).not.toHaveProperty('showCrisisPath');
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(0);
  });

  it('refuses an unknown item and a value outside 0 to 3', async () => {
    const { ports } = await setUpRound();
    const unknown = await submitGad7Answer(patientActor, { patientId, itemId: '8', value: 1 }, ports);
    const tooHigh = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 4 }, ports);
    expect(unknown.ok).toBe(false);
    expect(tooHigh.ok).toBe(false);
    expect(await ports.gad7!.getGad7s(patientId)).toHaveLength(0);
  });

  it('refuses another patient and clinic staff', async () => {
    const { ports } = await setUpRound();
    const other: PatientActor = { kind: 'patient', patientId: 'someone-else', clinicId };
    const nurse: StaffActor = { kind: 'staff', staffId: 'nurse-1', clinicId, role: 'nurse' };

    const byOther = await submitGad7Answer(other, { patientId, itemId: '1', value: 1 }, ports);
    const byNurse = await submitGad7Answer(nurse, { patientId, itemId: '1', value: 1 }, ports);
    expect(byOther.ok).toBe(false);
    expect(byNurse.ok).toBe(false);
    expect(await ports.gad7!.getGad7s(patientId)).toHaveLength(0);
  });

  it('refuses a patient who is not taking part', async () => {
    const { ports } = createFakePorts(ROUND_1);
    await ports.patients.savePatient({
      ...sampleRecord,
      consent: { ...sampleRecord.consent, taking_part: false },
    });
    const res = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 1 }, ports);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('consent_required');
  });

  it('stores nothing when the unit of work fails', async () => {
    const { ports, unitOfWork } = await setUpRound();
    unitOfWork.failNext = true;
    const res = await submitGad7Answer(patientActor, { patientId, itemId: '1', value: 1 }, ports);
    expect(res.ok).toBe(false);
    expect(await ports.gad7!.getGad7s(patientId)).toHaveLength(0);
  });
});
