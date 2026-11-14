import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { evaluatePatient } from '../evaluate-patient';

describe('Repeats and Idempotency', () => {
  const patientId = 'patient-repeats';
  const clinicId = 'clinic-1';

  const patientActor: PatientActor = {
    kind: 'patient',
    patientId,
    clinicId,
  };

  const systemActor: SystemActor = {
    kind: 'system',
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
  };

  it('the same taps submitted twice store one answer and no second effect', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // First submission: low round (mood 0, interest 0) -> ruleRunNeeded = true
    const firstRes = await submitTaps(
      patientActor,
      { patientId, mood: 0, interest: 0 },
      ports
    );
    expect(firstRes.ok).toBe(true);
    if (!firstRes.ok) return;
    expect(firstRes.value.ruleRunNeeded).toBe(true);

    // Server layer runs evaluatePatient
    const evalRes1 = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes1.ok).toBe(true);

    const roundsAfterFirst = await ports.rounds.getRounds(patientId);
    expect(roundsAfterFirst).toHaveLength(1);
    const dipsAfterFirst = await ports.smallDips.getSmallDips(patientId);
    expect(dipsAfterFirst).toHaveLength(1);

    // Second submission of the exact same taps (duplicate)
    const secondRes = await submitTaps(
      patientActor,
      { patientId, mood: 0, interest: 0 },
      ports
    );
    expect(secondRes.ok).toBe(true);
    if (!secondRes.ok) return;
    expect(secondRes.value.ruleRunNeeded).toBe(false);

    // Server layer runs evaluatePatient again
    const evalRes2 = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes2.ok).toBe(true);
    if (!evalRes2.ok) return;
    expect(evalRes2.value.storedEffectsCount).toBe(0);

    // Still exactly one stored round and one small dip
    const roundsAfterSecond = await ports.rounds.getRounds(patientId);
    expect(roundsAfterSecond).toHaveLength(1);
    const dipsAfterSecond = await ports.smallDips.getSmallDips(patientId);
    expect(dipsAfterSecond).toHaveLength(1);
  });

  it('closeElapsedRounds run twice stores nothing new', async () => {
    // Round 1 ends on Thursday 2026-11-19 16:00 UTC.
    // Advance clock past round 1 and round 2 (to 2026-11-25)
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // First run of closeElapsedRounds
    const firstRun = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) return;
    expect(firstRun.value.closedRoundsCount).toBe(2);
    expect(firstRun.value.ruleRunNeeded).toBe(true);

    // Server evaluates patient
    await evaluatePatient(systemActor, { patientId }, ports);

    const roundsAfterFirst = await ports.rounds.getRounds(patientId);
    const warningsAfterFirst = await ports.warnings.getWarnings(patientId);
    expect(roundsAfterFirst.filter((r) => r.status === 'missed')).toHaveLength(2);
    expect(warningsAfterFirst).toHaveLength(1);

    // Second run immediately
    const secondRun = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) return;
    expect(secondRun.value.closedRoundsCount).toBe(0);
    expect(secondRun.value.ruleRunNeeded).toBe(false);

    // Server evaluates patient again
    const evalRes = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes.ok).toBe(true);
    if (!evalRes.ok) return;
    expect(evalRes.value.storedEffectsCount).toBe(0);

    const roundsAfterSecond = await ports.rounds.getRounds(patientId);
    const warningsAfterSecond = await ports.warnings.getWarnings(patientId);
    expect(roundsAfterSecond).toHaveLength(roundsAfterFirst.length);
    expect(warningsAfterSecond).toHaveLength(warningsAfterFirst.length);
  });

  it('evaluatePatient run twice stores nothing new and never deletes or rewrites stored warnings', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Set up 2 missed rounds in storage
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'missed',
    });
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'missed',
    });

    // Run 1: should store 1 silence warning
    const result1 = await evaluatePatient(systemActor, { patientId }, ports);
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    expect(result1.value.storedEffectsCount).toBe(1);

    const warnings1 = await ports.warnings.getWarnings(patientId);
    expect(warnings1).toHaveLength(1);

    // Run 2: stores nothing new!
    const result2 = await evaluatePatient(systemActor, { patientId }, ports);
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.value.storedEffectsCount).toBe(0);

    const warnings2 = await ports.warnings.getWarnings(patientId);
    expect(warnings2).toHaveLength(1);
    expect(warnings2[0]).toEqual(warnings1[0]);
  });

  it('the same PHQ-9 answer submitted twice stores one answer and does not duplicate state', async () => {
    // Open round 1 is a PHQ-9 round (enrolment 2026-11-16 16:00 UTC)
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Taps must be answered before PHQ-9 can be submitted
    const tapRes = await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    expect(tapRes.ok).toBe(true);

    // Submit question 1 (value 2) first time
    const phqRes1 = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 2 },
      ports
    );
    expect(phqRes1.ok).toBe(true);
    if (!phqRes1.ok) return;
    expect(phqRes1.value.progress).toBe('unfinished');
    expect(phqRes1.value.ruleRunNeeded).toBe(false);

    const phqList1 = await ports.phq9.getPhq9s(patientId);
    expect(phqList1).toHaveLength(1);
    expect(phqList1[0].answers).toEqual([{ id: '1', value: 2 }]);

    // Submit the EXACT same PHQ-9 answer second time
    const phqRes2 = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 2 },
      ports
    );
    expect(phqRes2.ok).toBe(true);
    if (!phqRes2.ok) return;
    expect(phqRes2.value.progress).toBe('unfinished');
    expect(phqRes2.value.ruleRunNeeded).toBe(false);

    // Stored answers still contains only 1 entry with value 2
    const phqList2 = await ports.phq9.getPhq9s(patientId);
    expect(phqList2).toHaveLength(1);
    expect(phqList2[0].answers).toEqual([{ id: '1', value: 2 }]);

    // Complete the remaining questions 2 through 9
    for (let i = 2; i <= 8; i++) {
      await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 1 },
        ports
      );
    }
    const finalItemRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 0 },
      ports
    );
    expect(finalItemRes.ok).toBe(true);
    if (!finalItemRes.ok) return;
    expect(finalItemRes.value.progress).toBe('completed');
    expect(finalItemRes.value.ruleRunNeeded).toBe(true);

    // Submitting the final question again when already completed is refused
    const completedRepeat = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 0 },
      ports
    );
    expect(completedRepeat.ok).toBe(false);
    if (!completedRepeat.ok) {
      expect(completedRepeat.error).toMatch(/already completed/i);
    }
  });

  it('submitting "Not today" after taps for the same round is ignored and does not overwrite answered taps', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // First submit taps in open round 1
    const taps = await submitTaps(patientActor, { patientId, mood: 4, interest: 3 }, ports);
    expect(taps.ok).toBe(true);

    const roundBefore = await ports.rounds.getRound(patientId, 1);
    expect(roundBefore?.status).toBe('answered');
    expect(roundBefore?.mood).toBe(4);
    expect(roundBefore?.interest).toBe(3);

    // Now submit "Not today" for the same round
    const notToday = await submitNotToday(patientActor, { patientId }, ports);
    expect(notToday.ok).toBe(true);
    if (!notToday.ok) return;
    expect(notToday.value.ruleRunNeeded).toBe(false);

    // Stored round remains answered with original mood & interest (never overwritten)
    const roundAfter = await ports.rounds.getRound(patientId, 1);
    expect(roundAfter?.status).toBe('answered');
    expect(roundAfter?.mood).toBe(4);
    expect(roundAfter?.interest).toBe(3);
  });
});
