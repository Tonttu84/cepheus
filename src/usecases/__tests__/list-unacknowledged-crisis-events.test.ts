import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import { CRISIS_EVENT_ITEM_ID } from '../../domain/crisis';
import { createFakePorts } from '../testing';
import { listUnacknowledgedCrisisEvents } from '../list-unacknowledged-crisis-events';

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

describe('listUnacknowledgedCrisisEvents', () => {
  it('lists unacknowledged crisis events for patients of caller clinic only', async () => {
    const { ports } = createFakePorts('2026-11-16T18:00:00.000Z');

    // Create patients
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });
    await ports.patients.savePatient({
      patientId: 'patient-2',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false }, // Taking part false still surfaces crisis
    });
    await ports.patients.savePatient({
      patientId: 'patient-other',
      clinicId: CLINIC_B,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    // Save crisis events
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-1',
      roundNumber: 1,
      itemId: CRISIS_EVENT_ITEM_ID.PHQ9_ITEM_9,
      value: 2,
      occurredAt: '2026-11-16T16:15:00.000Z',
      acknowledgedAt: null,
    });
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-2',
      roundNumber: 1,
      itemId: CRISIS_EVENT_ITEM_ID.ASKED_FOR_HELP,
      value: 1,
      occurredAt: '2026-11-16T16:30:00.000Z',
      acknowledgedAt: null,
    });
    // Already acknowledged event
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-1',
      roundNumber: 2,
      itemId: CRISIS_EVENT_ITEM_ID.PHQ9_ITEM_9,
      value: 1,
      occurredAt: '2026-11-16T17:00:00.000Z',
      acknowledgedAt: '2026-11-16T17:30:00.000Z',
    });
    // Event in other clinic
    await ports.crisis.saveCrisisEvent({
      patientId: 'patient-other',
      roundNumber: 1,
      itemId: CRISIS_EVENT_ITEM_ID.PHQ9_ITEM_9,
      value: 3,
      occurredAt: '2026-11-16T16:45:00.000Z',
      acknowledgedAt: null,
    });

    const resA = await listUnacknowledgedCrisisEvents(staffA, ports);
    expect(resA.ok).toBe(true);
    if (!resA.ok) return;

    expect(resA.value).toEqual([
      { patientId: 'patient-1', roundNumber: 1, occurredAt: '2026-11-16T16:15:00.000Z', description: 'PHQ-9 item 9 answered above zero' },
      { patientId: 'patient-2', roundNumber: 1, occurredAt: '2026-11-16T16:30:00.000Z', description: 'a person asked for help' },
    ]);

    // Clinic B nurse only sees clinic B's event
    const resB = await listUnacknowledgedCrisisEvents(staffB, ports);
    expect(resB.ok).toBe(true);
    if (!resB.ok) return;
    expect(resB.value).toEqual([
      { patientId: 'patient-other', roundNumber: 1, occurredAt: '2026-11-16T16:45:00.000Z', description: 'PHQ-9 item 9 answered above zero' },
    ]);
  });

  it('logs each patient whose crisis events are read by staff', async () => {
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
      itemId: CRISIS_EVENT_ITEM_ID.PHQ9_ITEM_9,
      value: 1,
      occurredAt: '2026-11-16T16:15:00.000Z',
      acknowledgedAt: null,
    });

    await listUnacknowledgedCrisisEvents(staffA, ports);
    const logs = await ports.accessLog.getLogs('patient-1');
    expect(logs.some((l) => l.actor.kind === 'staff' && l.target.kind === 'crisis_messages' && l.allowed)).toBe(true);
  });

  it('refuses patients or non-staff callers', async () => {
    const { ports } = createFakePorts();
    const res = await listUnacknowledgedCrisisEvents(patientUser, ports);
    expect(res.ok).toBe(false);
  });
});
