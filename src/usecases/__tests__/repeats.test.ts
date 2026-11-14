import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
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
});
