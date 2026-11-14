import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { getCheckInState } from '../get-check-in-state';
import { submitTaps } from '../submit-taps';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { evaluatePatient } from '../evaluate-patient';

describe('Demo Story: 4 weeks well, one small dip, recovery, then two silent rounds', () => {
  const patientId = 'demo-patient-1';
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
      weekdays: [1, 4], // Monday (1) and Thursday (4)
      timeOfDay: '18:00',
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2026-11-16', // Monday
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it('runs the demo story with evaluatePatient called after each step, storing one small dip and one warning', async () => {
    // 2026-11-16 is Monday. In Helsinki (EET, UTC+2), 18:00 is 16:00 UTC.
    const { ports, clock } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // --- ROUND 1: Monday 2026-11-16 (PHQ-9 scheduled round) ---
    const state1 = await getCheckInState(patientActor, { patientId }, ports);
    expect(state1.ok).toBe(true);
    if (!state1.ok) return;
    expect(state1.value.openRound?.number).toBe(1);
    expect(state1.value.areTapsAnswered).toBe(false);
    expect(state1.value.isPhq9Due).toBe(true);
    expect(state1.value.phq9Progress).toBe('not_started');
    expect(state1.value.hasSuggestionWaiting).toBe(false);

    // Submit taps for Round 1
    const taps1 = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(taps1.ok).toBe(true);
    if (!taps1.ok) return;
    expect(taps1.value.ruleRunNeeded).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);

    // Complete all 9 questions of PHQ-9 with low scores (total = 0)
    for (let i = 1; i <= 9; i++) {
      const res = await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 0 },
        ports
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.showCrisisPath).toBe(false);
      if (i < 9) {
        expect(res.value.progress).toBe('unfinished');
        expect(res.value.ruleRunNeeded).toBe(false);
      } else {
        expect(res.value.progress).toBe('completed');
        expect(res.value.ruleRunNeeded).toBe(true);
        await evaluatePatient(systemActor, { patientId }, ports);
      }
    }

    // Verify round 1 stored state
    const storedR1 = await ports.rounds.getRound(patientId, 1);
    expect(storedR1?.status).toBe('answered');
    expect(storedR1?.mood).toBe(3);
    expect(storedR1?.interest).toBe(3);

    const phq9sR1 = await ports.phq9.getPhq9s(patientId);
    expect(phq9sR1).toHaveLength(1);
    expect(phq9sR1[0].progress).toBe('completed');
    expect(phq9sR1[0].total).toBe(0);

    // No warning and no small dip
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(0);

    // --- ROUNDS 2 through 8 (answering well: 4 weeks total) ---
    const roundTimes = [
      { r: 2, t: '2026-11-19T16:00:00.000Z', isPhq9: false },
      { r: 3, t: '2026-11-23T16:00:00.000Z', isPhq9: false },
      { r: 4, t: '2026-11-26T16:00:00.000Z', isPhq9: false },
      { r: 5, t: '2026-11-30T16:00:00.000Z', isPhq9: true },
      { r: 6, t: '2026-12-03T16:00:00.000Z', isPhq9: false },
      { r: 7, t: '2026-12-07T16:00:00.000Z', isPhq9: false },
      { r: 8, t: '2026-12-10T16:00:00.000Z', isPhq9: false },
    ];

    for (const item of roundTimes) {
      clock.setNow(item.t);
      const state = await getCheckInState(patientActor, { patientId }, ports);
      expect(state.ok).toBe(true);
      if (!state.ok) return;
      expect(state.value.openRound?.number).toBe(item.r);
      expect(state.value.isPhq9Due).toBe(item.isPhq9);

      const tapRes = await submitTaps(
        patientActor,
        { patientId, mood: 3, interest: 3 },
        ports
      );
      expect(tapRes.ok).toBe(true);
      if (!tapRes.ok) return;
      expect(tapRes.value.ruleRunNeeded).toBe(true);
      await evaluatePatient(systemActor, { patientId }, ports);

      if (item.isPhq9) {
        for (let i = 1; i <= 9; i++) {
          const phqRes = await submitPhq9Answer(
            patientActor,
            { patientId, itemId: String(i), value: 0 },
            ports
          );
          if (phqRes.ok && phqRes.value.ruleRunNeeded) {
            await evaluatePatient(systemActor, { patientId }, ports);
          }
        }
      }
    }

    // Now 8 rounds answered. Baseline is 3 for mood and 3 for interest.
    const allRoundsSoFar = await ports.rounds.getRounds(patientId);
    expect(allRoundsSoFar).toHaveLength(8);
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(0);

    // --- ROUND 9: Mon 2026-12-14 (Low round: small dip) ---
    // Mood = 1, Interest = 1 (drops 2 points below baseline 3)
    clock.setNow('2026-12-14T16:00:00.000Z');
    const state9 = await getCheckInState(patientActor, { patientId }, ports);
    expect(state9.ok).toBe(true);
    if (!state9.ok) return;
    expect(state9.value.openRound?.number).toBe(9);

    const taps9 = await submitTaps(
      patientActor,
      { patientId, mood: 1, interest: 1 },
      ports
    );
    expect(taps9.ok).toBe(true);
    if (!taps9.ok) return;
    expect(taps9.value.ruleRunNeeded).toBe(true);

    // Evaluate patient rule after step:
    await evaluatePatient(systemActor, { patientId }, ports);

    // State now reflects suggestion waiting to be shown
    const state9After = await getCheckInState(patientActor, { patientId }, ports);
    expect(state9After.ok).toBe(true);
    if (!state9After.ok) return;
    expect(state9After.value.hasSuggestionWaiting).toBe(true);

    const smallDips = await ports.smallDips.getSmallDips(patientId);
    expect(smallDips).toHaveLength(1);
    expect(smallDips[0].roundNumber).toBe(9);
    expect(smallDips[0].version).toBe(1);
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    // --- ROUND 10: Thu 2026-12-17 (Answers normally) ---
    clock.setNow('2026-12-17T16:00:00.000Z');
    const taps10 = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(taps10.ok).toBe(true);
    if (!taps10.ok) return;
    expect(taps10.value.ruleRunNeeded).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);

    const state10 = await getCheckInState(patientActor, { patientId }, ports);
    expect(state10.ok).toBe(true);
    if (!state10.ok) return;
    expect(state10.value.hasSuggestionWaiting).toBe(false);

    // Still exactly 1 small dip stored, 0 warnings
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(1);
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    // --- ROUNDS 11 & 12: UNANSWERED SILENCE ---
    clock.setNow('2026-12-24T17:00:00.000Z');
    const close1 = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(close1.ok).toBe(true);
    if (!close1.ok) return;
    expect(close1.value.ruleRunNeeded).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);

    const r11 = await ports.rounds.getRound(patientId, 11);
    expect(r11?.status).toBe('missed');
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    // Advance clock past round 12:
    clock.setNow('2026-12-28T17:00:00.000Z');
    const close2 = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(close2.ok).toBe(true);
    if (!close2.ok) return;
    expect(close2.value.ruleRunNeeded).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);

    const r12 = await ports.rounds.getRound(patientId, 12);
    expect(r12?.status).toBe('missed');

    // Exactly 1 warning stored!
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('silence');
    expect(warnings[0].since).toBe(r11?.localDate);
    expect(warnings[0].version).toBe(1);
  });

  it('runs the same story with evaluatePatient called only once at the end, giving the same stored warnings and small dips', async () => {
    const { ports, clock } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // R1
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    for (let i = 1; i <= 9; i++) {
      await submitPhq9Answer(patientActor, { patientId, itemId: String(i), value: 0 }, ports);
    }

    // R2..R8
    const roundTimes = [
      { r: 2, t: '2026-11-19T16:00:00.000Z', isPhq9: false },
      { r: 3, t: '2026-11-23T16:00:00.000Z', isPhq9: false },
      { r: 4, t: '2026-11-26T16:00:00.000Z', isPhq9: false },
      { r: 5, t: '2026-11-30T16:00:00.000Z', isPhq9: true },
      { r: 6, t: '2026-12-03T16:00:00.000Z', isPhq9: false },
      { r: 7, t: '2026-12-07T16:00:00.000Z', isPhq9: false },
      { r: 8, t: '2026-12-10T16:00:00.000Z', isPhq9: false },
    ];

    for (const item of roundTimes) {
      clock.setNow(item.t);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
      if (item.isPhq9) {
        for (let i = 1; i <= 9; i++) {
          await submitPhq9Answer(patientActor, { patientId, itemId: String(i), value: 0 }, ports);
        }
      }
    }

    // R9 (low)
    clock.setNow('2026-12-14T16:00:00.000Z');
    await submitTaps(patientActor, { patientId, mood: 1, interest: 1 }, ports);

    // R10 (normal)
    clock.setNow('2026-12-17T16:00:00.000Z');
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // R11 missed
    clock.setNow('2026-12-24T17:00:00.000Z');
    await closeElapsedRounds(systemActor, { patientId }, ports);

    // R12 missed
    clock.setNow('2026-12-28T17:00:00.000Z');
    await closeElapsedRounds(systemActor, { patientId }, ports);

    // Before evaluatePatient: NO warnings and NO small dips are stored yet!
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(0);

    // Run evaluatePatient ONLY ONCE at the end:
    const evalRes = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes.ok).toBe(true);

    // Gives the exact same stored warnings and small dips!
    const smallDips = await ports.smallDips.getSmallDips(patientId);
    expect(smallDips).toHaveLength(1);
    expect(smallDips[0].roundNumber).toBe(9);
    expect(smallDips[0].version).toBe(1);

    const r11 = await ports.rounds.getRound(patientId, 11);
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('silence');
    expect(warnings[0].since).toBe(r11?.localDate);
    expect(warnings[0].version).toBe(1);
  });
});
