import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import { decideAccess } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { getCheckInState } from '../get-check-in-state';
import { evaluatePatient } from '../evaluate-patient';

vi.mock('../../domain/access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/access')>();
  return {
    ...actual,
    decideAccess: vi.fn(),
  };
});

describe('Single allowed-access log write per operation (Point 1)', () => {
  const patientId = 'patient-log-once';
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

  beforeEach(() => {
    vi.mocked(decideAccess).mockReturnValue({
      ok: true,
      value: { allowed: true, reason: 'allowed', log: true },
    });
  });

  it('submitTaps logs allowed access exactly once per call, including duplicate calls', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const first = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(first.ok).toBe(true);

    const logsAfterFirst = await ports.accessLog.getLogs(patientId);
    expect(logsAfterFirst).toHaveLength(1);
    expect(logsAfterFirst[0].allowed).toBe(true);

    // Repeated (duplicate) submission
    const second = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(second.ok).toBe(true);

    const logsAfterSecond = await ports.accessLog.getLogs(patientId);
    expect(logsAfterSecond).toHaveLength(2);
    expect(logsAfterSecond[1].allowed).toBe(true);
  });

  it('submitNotToday logs allowed access exactly once per call, including duplicate calls', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const first = await submitNotToday(patientActor, { patientId }, ports);
    expect(first.ok).toBe(true);

    const logsAfterFirst = await ports.accessLog.getLogs(patientId);
    expect(logsAfterFirst).toHaveLength(1);
    expect(logsAfterFirst[0].allowed).toBe(true);

    // Duplicate call
    const second = await submitNotToday(patientActor, { patientId }, ports);
    expect(second.ok).toBe(true);

    const logsAfterSecond = await ports.accessLog.getLogs(patientId);
    expect(logsAfterSecond).toHaveLength(2);
    expect(logsAfterSecond[1].allowed).toBe(true);
  });

  it('submitPhq9Answer logs allowed access exactly once per call, including duplicate calls', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Answer taps first (ports.accessLog will have 1 tap log)
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    const logsBefore = await ports.accessLog.getLogs(patientId);

    const res = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(res.ok).toBe(true);

    const logsAfter = await ports.accessLog.getLogs(patientId);
    expect(logsAfter.length - logsBefore.length).toBe(1);
    expect(logsAfter[logsAfter.length - 1].allowed).toBe(true);

    // Repeated submission for the same item
    const res2 = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(res2.ok).toBe(true);

    const logsAfter2 = await ports.accessLog.getLogs(patientId);
    expect(logsAfter2.length - logsBefore.length).toBe(2);
    expect(logsAfter2[logsAfter2.length - 1].allowed).toBe(true);
  });

  it('closeElapsedRounds logs allowed access exactly once per call, including repeated runs', async () => {
    // 2026-11-20: round 1 has elapsed
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const first = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(first.ok).toBe(true);

    const logsAfterFirst = await ports.accessLog.getLogs(patientId);
    expect(logsAfterFirst).toHaveLength(1);
    expect(logsAfterFirst[0].allowed).toBe(true);

    // Repeated call (no-op)
    const second = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(second.ok).toBe(true);

    const logsAfterSecond = await ports.accessLog.getLogs(patientId);
    expect(logsAfterSecond).toHaveLength(2);
    expect(logsAfterSecond[1].allowed).toBe(true);
  });

  it('getCheckInState logs allowed access exactly once per call', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);

    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs).toHaveLength(1);
    expect(logs[0].allowed).toBe(true);
  });

  it('evaluatePatient logs allowed access exactly once per call when allowed and log (Point 2)', async () => {
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await evaluatePatient(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);

    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs).toHaveLength(1);
    expect(logs[0].allowed).toBe(true);
  });
});
