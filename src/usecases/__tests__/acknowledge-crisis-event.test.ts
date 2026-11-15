import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import { createFakePorts } from '../testing';
import { acknowledgeCrisisEvent } from '../acknowledge-crisis-event';

const CLINIC_A = 'clinic-a';
const CLINIC_B = 'clinic-b';

const staffA: StaffActor = {
  kind: 'staff',
  staffId: 'nurse-1',
  clinicId: CLINIC_A,
  role: 'nurse',
};

const staffB: StaffActor = {
  kind: 'staff',
  staffId: 'nurse-2',
  clinicId: CLINIC_B,
  role: 'nurse',
};

const patientUser: PatientActor = {
  kind: 'patient',
  patientId: 'patient-1',
  clinicId: CLINIC_A,
};

describe('acknowledgeCrisisEvent', () => {
  it('acknowledges an unacknowledged crisis event and records staff member and timestamp', async () => {
    const { ports } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-1',
      roundNumber: 1,
      itemId: '9',
      value: 2,
      occurredAt: '2026-11-16T16:15:00.000Z',
      acknowledgedAt: null,
    });

    const res = await acknowledgeCrisisEvent(staffA, { patientId: 'patient-1', roundNumber: 1 }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      patientId: 'patient-1',
      roundNumber: 1,
      acknowledgedAt: '2026-11-16T18:00:00.000Z',
      acknowledgedByStaffId: 'nurse-1',
    });

    // Check storage: event occurredAt and value are unchanged; acknowledgedAt and staffId are set
    const events = await ports.crisis.getCrisisEvents('patient-1');
    expect(events).toEqual([
      {
        patientId: 'patient-1',
        roundNumber: 1,
        itemId: '9',
        value: 2,
        occurredAt: '2026-11-16T16:15:00.000Z',
        acknowledgedAt: '2026-11-16T18:00:00.000Z',
        acknowledgedByStaffId: 'nurse-1',
      },
    ]);

    // Check access logging
    const logs = await ports.accessLog.getLogs('patient-1');
    expect(
      logs.some(
        (l) => l.actor.kind === 'staff' && l.action === 'write' && l.target.kind === 'crisis_messages' && l.allowed
      )
    ).toBe(true);
  });

  it('refuses to acknowledge an event that has already been acknowledged (once only)', async () => {
    const { ports } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-1',
      roundNumber: 1,
      itemId: '9',
      value: 2,
      occurredAt: '2026-11-16T16:15:00.000Z',
      acknowledgedAt: '2026-11-16T17:00:00.000Z',
      acknowledgedByStaffId: 'nurse-previous',
    });

    const res = await acknowledgeCrisisEvent(staffA, { patientId: 'patient-1', roundNumber: 1 }, ports);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Crisis event already acknowledged');
    }

    // Storage remains unchanged
    const [ev] = await ports.crisis.getCrisisEvents('patient-1');
    expect(ev.acknowledgedAt).toBe('2026-11-16T17:00:00.000Z');
    expect(ev.acknowledgedByStaffId).toBe('nurse-previous');
  });

  it('refuses staff of another clinic (403 other_clinic)', async () => {
    const { ports } = createFakePorts();
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-1',
      roundNumber: 1,
      itemId: '9',
      value: 1,
      occurredAt: '2026-11-16T16:15:00.000Z',
      acknowledgedAt: null,
    });

    const res = await acknowledgeCrisisEvent(staffB, { patientId: 'patient-1', roundNumber: 1 }, ports);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('other_clinic');
    }

    // Refusal is logged
    const logs = await ports.accessLog.getLogs('patient-1');
    expect(logs.some((l) => l.actor.kind === 'staff' && !l.allowed && l.reason === 'other_clinic')).toBe(true);
  });

  it('refuses patients', async () => {
    const { ports } = createFakePorts();
    const res = await acknowledgeCrisisEvent(patientUser, { patientId: 'patient-1', roundNumber: 1 }, ports);
    expect(res.ok).toBe(false);
  });

  it('returns not found for unknown patient or non-existent round event', async () => {
    const { ports } = createFakePorts();
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const resUnknown = await acknowledgeCrisisEvent(staffA, { patientId: 'unknown-p', roundNumber: 1 }, ports);
    expect(resUnknown.ok).toBe(false);
    if (!resUnknown.ok) expect(resUnknown.error).toBe('Patient not found');

    const resNoEvent = await acknowledgeCrisisEvent(staffA, { patientId: 'patient-1', roundNumber: 99 }, ports);
    expect(resNoEvent.ok).toBe(false);
    if (!resNoEvent.ok) expect(resNoEvent.error).toBe('Crisis event not found');
  });
});
