import { describe, expect, it, vi } from 'vitest';
import * as accessDomain from '../../domain/access';
import type { PatientActor, StaffActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { getCheckInState } from '../get-check-in-state';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { evaluatePatient } from '../evaluate-patient';

describe('Consistent Purpose Across DecideAccess and Logs (Point 3)', () => {
  const patientId = 'patient-purpose-test';
  const clinicId = 'clinic-1';

  const patientActor: PatientActor = {
    kind: 'patient',
    patientId,
    clinicId,
  };

  const staffActor: StaffActor = {
    kind: 'staff',
    staffId: 'nurse-1',
    clinicId,
    role: 'nurse',
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

  it('submitTaps uses constant purpose self_access for patient and staff', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // Patient actor
    spy.mockClear();
    const patientRes = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(patientRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await submitTaps(
      staffActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('self_access');
    }
  });

  it('submitNotToday uses constant purpose self_access for patient and staff', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // Patient actor
    spy.mockClear();
    const patientRes = await submitNotToday(patientActor, { patientId }, ports);
    expect(patientRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await submitNotToday(staffActor, { patientId }, ports);
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('self_access');
    }
  });

  it('submitPhq9Answer uses constant purpose self_access for patient and staff', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // Patient actor
    spy.mockClear();
    const patientRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(patientRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await submitPhq9Answer(
      staffActor,
      { patientId, itemId: '2', value: 0 },
      ports
    );
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('self_access');
    }
  });

  it('getCheckInState uses constant purpose self_access for patient and staff', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // Patient actor
    spy.mockClear();
    const patientRes = await getCheckInState(patientActor, { patientId }, ports);
    expect(patientRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await getCheckInState(staffActor, { patientId }, ports);
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('self_access');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('self_access');
    }
  });

  it('closeElapsedRounds uses constant purpose care for system and staff', async () => {
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // System actor
    spy.mockClear();
    const systemRes = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(systemRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('care');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await closeElapsedRounds(staffActor, { patientId }, ports);
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('care');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('care');
    }
  });

  it('evaluatePatient uses constant purpose care for system and staff', async () => {
    const { ports } = createFakePorts('2026-11-20T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const spy = vi.spyOn(accessDomain, 'decideAccess');

    // System actor
    spy.mockClear();
    const systemRes = await evaluatePatient(systemActor, { patientId }, ports);
    expect(systemRes.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('care');
    }

    // Staff actor (refused)
    spy.mockClear();
    const staffRes = await evaluatePatient(staffActor, { patientId }, ports);
    expect(staffRes.ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect((call[0] as { purpose: string }).purpose).toBe('care');
    }
    const staffLogs = (await ports.accessLog.getLogs(patientId)).filter(
      (l) => l.actor.kind === 'staff'
    );
    expect(staffLogs.length).toBeGreaterThan(0);
    for (const log of staffLogs) {
      expect(log.purpose).toBe('care');
    }
  });
});
