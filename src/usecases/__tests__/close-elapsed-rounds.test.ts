import { describe, expect, it, vi } from 'vitest';
import type { SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import * as roundsDomain from '../../domain/rounds';

describe('closeElapsedRounds', () => {
  const patientId = 'patient-close-test';
  const clinicId = 'clinic-1';

  const systemActor: SystemActor = {
    kind: 'system',
  };

  // Enrolment on Monday 2026-11-16. Weekdays [1, 4] (Mon & Thu) at 18:00 Europe/Helsinki.
  // In Europe/Helsinki (UTC+2 in November):
  // Round 1: opens Mon 2026-11-16T16:00:00.000Z, ends Thu 2026-11-19T16:00:00.000Z
  // Round 2: opens Thu 2026-11-19T16:00:00.000Z, ends Mon 2026-11-23T16:00:00.000Z
  // Round 3: opens Mon 2026-11-23T16:00:00.000Z, ends Thu 2026-11-26T16:00:00.000Z
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

  it('before the first round opens nothing is closed', async () => {
    // Clock set to Monday 2026-11-16 10:00 UTC (round 1 opens at 16:00 UTC)
    const { ports } = createFakePorts('2026-11-16T10:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.closedRoundsCount).toBe(0);
    expect(res.value.remindersSentCount).toBe(0);
    expect(res.value.ruleRunNeeded).toBe(false);

    const rounds = await ports.rounds.getRounds(patientId);
    expect(rounds).toHaveLength(0);
  });

  it('exactly at the moment round 2 opens, round 1 is closed if it has no submission', async () => {
    // Exactly at Thu 2026-11-19 16:00:00.000Z (round 2 opens, round 1 ends)
    const { ports } = createFakePorts('2026-11-19T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.closedRoundsCount).toBe(1);
    expect(res.value.ruleRunNeeded).toBe(true);

    const round1 = await ports.rounds.getRound(patientId, 1);
    expect(round1).not.toBeNull();
    expect(round1?.status).toBe('missed');

    const round2 = await ports.rounds.getRound(patientId, 2);
    expect(round2?.status).not.toBe('missed');
  });

  it('many rounds elapsed in one run are all closed, each exactly once', async () => {
    // Exactly at the moment round 21 opens: 20 rounds have elapsed (2026-11-16 to 2027-01-25T16:00:00.000Z)
    const { ports } = createFakePorts('2027-01-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.closedRoundsCount).toBe(20);
    expect(res.value.ruleRunNeeded).toBe(true);

    const allRounds = await ports.rounds.getRounds(patientId);
    expect(allRounds).toHaveLength(20);
    const roundNumbers = allRounds.map((r) => r.roundNumber);
    // Every round from 1 to 20 exactly once
    expect(roundNumbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const r of allRounds) {
      expect(r.status).toBe('missed');
    }
  });

  it('a round with an answer or "Not today" is never changed', async () => {
    // Clock at 2026-11-27T16:00:00.000Z (rounds 1, 2, 3 have ended)
    const { ports } = createFakePorts('2026-11-27T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Round 1 answered
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'answered',
      mood: 3,
      interest: 4,
      answeredAt: '2026-11-16T17:00:00.000Z',
    });

    // Round 2 not_today
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'not_today',
      answeredAt: '2026-11-19T17:00:00.000Z',
    });

    // Round 3 has no submission

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Only round 3 was closed
    expect(res.value.closedRoundsCount).toBe(1);

    const r1 = await ports.rounds.getRound(patientId, 1);
    expect(r1?.status).toBe('answered');
    expect(r1?.mood).toBe(3);
    expect(r1?.interest).toBe(4);

    const r2 = await ports.rounds.getRound(patientId, 2);
    expect(r2?.status).toBe('not_today');

    const r3 = await ports.rounds.getRound(patientId, 3);
    expect(r3?.status).toBe('missed');
  });

  it('a second run changes nothing', async () => {
    const { ports } = createFakePorts('2026-11-27T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res1 = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.value.closedRoundsCount).toBe(3);

    const res2 = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.value.closedRoundsCount).toBe(0);
    expect(res2.value.remindersSentCount).toBe(0);
    expect(res2.value.ruleRunNeeded).toBe(false);
  });

  it('closes ended rounds whether or not a round is open now (even when getOpenRound returns null)', async () => {
    // When getOpenRound returns null (e.g. no round is open now),
    // rounds whose end is at or before the current moment must still be closed.
    const { ports } = createFakePorts('2026-11-20T10:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Mock getOpenRound to simulate no round being open
    const spy = vi.spyOn(roundsDomain, 'getOpenRound').mockReturnValue(null);

    try {
      const res = await closeElapsedRounds(systemActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Round 1 ended on 2026-11-19T16:00:00.000Z, so it must be closed!
      expect(res.value.closedRoundsCount).toBe(1);
      const r1 = await ports.rounds.getRound(patientId, 1);
      expect(r1?.status).toBe('missed');
    } finally {
      spy.mockRestore();
    }
  });
});
