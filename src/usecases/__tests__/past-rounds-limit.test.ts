import { describe, expect, it } from 'vitest';
import type { SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { closeElapsedRounds } from '../close-elapsed-rounds';

describe('Past Rounds Beyond 100 (Point F)', () => {
  const patientId = 'long-enrolled-patient';
  const clinicId = 'clinic-1';

  const systemActor: SystemActor = {
    kind: 'system',
  };

  // Enrolled 2 years ago on Monday 2024-11-18.
  // 104 weeks * 2 rounds/week = ~208 rounds by November 2026.
  const sampleRecord: PatientRecord = {
    patientId,
    clinicId,
    schedule: {
      weekdays: [1, 4],
      timeOfDay: '18:00',
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2024-11-18',
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it('generates rounds up to the current moment even when there are more than 100 rounds', async () => {
    // Clock set to 2026-11-16 (two years later)
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // More than 100 rounds must have elapsed and been closed as missed
    expect(res.value.closedRoundsCount).toBeGreaterThan(100);

    // Specifically verify round 101 and round 150 were found and marked missed
    const round101 = await ports.rounds.getRound(patientId, 101);
    expect(round101).not.toBeNull();
    expect(round101?.status).toBe('missed');

    const round150 = await ports.rounds.getRound(patientId, 150);
    expect(round150).not.toBeNull();
    expect(round150?.status).toBe('missed');
  });
});
