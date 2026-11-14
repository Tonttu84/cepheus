import { describe, expect, it } from 'vitest';
import type { PatientActor } from '../../domain/access';
import type { Clock, PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';

describe('Round Assignment and Clock Invariants (Point D)', () => {
  const patientId = 'round-patient-1';
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
      weekdays: [1, 4], // Monday and Thursday
      timeOfDay: '18:00', // 16:00 UTC in Helsinki winter time
      timeZone: 'Europe/Helsinki',
      enrolmentDate: '2026-11-16', // Round 1 opens 2026-11-16T16:00:00.000Z, ends 2026-11-19T16:00:00.000Z
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it('an answer one millisecond before a round ends goes to that round', async () => {
    // Round 1 ends at 2026-11-19T16:00:00.000Z.
    // 1 ms before: 2026-11-19T15:59:59.999Z
    const { ports } = createFakePorts('2026-11-19T15:59:59.999Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(res.ok).toBe(true);

    const round1 = await ports.rounds.getRound(patientId, 1);
    expect(round1?.status).toBe('answered');
    expect(round1?.roundNumber).toBe(1);

    const round2 = await ports.rounds.getRound(patientId, 2);
    expect(round2).toBeNull();
  });

  it('an answer exactly at the moment the next round opens goes to the next round', async () => {
    // Exactly at 2026-11-19T16:00:00.000Z, round 2 opens
    const { ports } = createFakePorts('2026-11-19T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(res.ok).toBe(true);

    const round2 = await ports.rounds.getRound(patientId, 2);
    expect(round2?.status).toBe('answered');
    expect(round2?.roundNumber).toBe(2);

    const round1 = await ports.rounds.getRound(patientId, 1);
    expect(round1).toBeNull(); // not answered in round 1
  });

  it('the clock is read once per use case, so a clock that moves during the use case cannot split one submission across two rounds', async () => {
    const { ports } = createFakePorts('2026-11-19T15:59:59.999Z');
    await ports.patients.savePatient(sampleRecord);

    let callCount = 0;
    const movingClock: Clock = {
      now() {
        callCount++;
        // First call: 1 ms before round 2 opens
        // Subsequent calls: after round 2 opens
        if (callCount === 1) {
          return '2026-11-19T15:59:59.999Z';
        }
        return '2026-11-19T16:00:05.000Z';
      },
    };

    const portsWithMovingClock = {
      ...ports,
      clock: movingClock,
    };

    const res = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      portsWithMovingClock
    );
    expect(res.ok).toBe(true);

    // The clock was read at most once inside the unit of work
    expect(callCount).toBe(1);

    const round1 = await ports.rounds.getRound(patientId, 1);
    expect(round1?.status).toBe('answered');
    expect(round1?.answeredAt).toBe('2026-11-19T15:59:59.999Z');

    const round2 = await ports.rounds.getRound(patientId, 2);
    expect(round2).toBeNull();
  });
});
