import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { getCheckInState } from '../get-check-in-state';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { closeElapsedRounds } from '../close-elapsed-rounds';

describe('Refusals and Access Control', () => {
  const patientId = 'patient-1';
  const otherPatientId = 'patient-2';
  const clinicId = 'clinic-1';

  const patientActor: PatientActor = {
    kind: 'patient',
    patientId,
    clinicId,
  };

  const otherPatientActor: PatientActor = {
    kind: 'patient',
    patientId: otherPatientId,
    clinicId,
  };

  const nurseActor: StaffActor = {
    kind: 'staff',
    staffId: 'nurse-1',
    clinicId,
    role: 'nurse',
  };

  const adminActor: StaffActor = {
    kind: 'staff',
    staffId: 'admin-1',
    clinicId,
    role: 'admin',
  };

  const activeRecord: PatientRecord = {
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

  const recordWithConsentOff: PatientRecord = {
    ...activeRecord,
    consent: {
      taking_part: false,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it('refuses nurse or admin calling patient use cases and logs the refusal in the access log', async () => {
    for (const staff of [nurseActor, adminActor]) {
      const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
      await ports.patients.savePatient(activeRecord);

      // Staff calling getCheckInState
      const resCheckIn = await getCheckInState(staff, { patientId }, ports);
      expect(resCheckIn.ok).toBe(false);

      // Staff calling submitTaps
      const resTaps = await submitTaps(
        staff,
        { patientId, mood: 3, interest: 3 },
        ports
      );
      expect(resTaps.ok).toBe(false);

      // Staff calling submitNotToday
      const resNotToday = await submitNotToday(staff, { patientId }, ports);
      expect(resNotToday.ok).toBe(false);

      // Staff calling submitPhq9Answer
      const resPhq9 = await submitPhq9Answer(
        staff,
        { patientId, itemId: '1', value: 0 },
        ports
      );
      expect(resPhq9.ok).toBe(false);

      // All staff attempts to access patient clinical data must be logged as refusals
      const logs = await ports.accessLog.getLogs(patientId);
      expect(logs.length).toBeGreaterThanOrEqual(4);
      for (const log of logs) {
        expect(log.actor.kind).toBe('staff');
        expect(log.allowed).toBe(false);
        expect(log.reason).toBe('clinic_staff_forbidden_clinical_data');
      }
    }
  });

  it('refuses a patient acting for another patient', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    const resCheckIn = await getCheckInState(
      otherPatientActor,
      { patientId },
      ports
    );
    expect(resCheckIn.ok).toBe(false);

    const resTaps = await submitTaps(
      otherPatientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(resTaps.ok).toBe(false);

    const resNotToday = await submitNotToday(
      otherPatientActor,
      { patientId },
      ports
    );
    expect(resNotToday.ok).toBe(false);

    const resPhq9 = await submitPhq9Answer(
      otherPatientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(resPhq9.ok).toBe(false);
  });

  it('refuses submissions when taking_part is off', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(recordWithConsentOff);

    const resTaps = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(resTaps.ok).toBe(false);

    const resNotToday = await submitNotToday(patientActor, { patientId }, ports);
    expect(resNotToday.ok).toBe(false);

    const resPhq9 = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(resPhq9.ok).toBe(false);
  });

  it('refuses a patient calling closeElapsedRounds', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    const res = await closeElapsedRounds(patientActor, { patientId }, ports);
    expect(res.ok).toBe(false);
  });

  it('refuses a submission when no round is open', async () => {
    // Before round 1 opens: enrolment date is 2026-11-16 18:00 Helsinki (16:00 UTC).
    // Set clock to 2026-11-16 12:00 UTC (before round opens at 16:00 UTC).
    const { ports } = createFakePorts('2026-11-16T12:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    const resTaps = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(resTaps.ok).toBe(false);

    const resNotToday = await submitNotToday(patientActor, { patientId }, ports);
    expect(resNotToday.ok).toBe(false);

    const resPhq9 = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(resPhq9.ok).toBe(false);
  });

  it('refuses PHQ-9 submission before taps are answered', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    // Taps not submitted yet
    const res = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(res.ok).toBe(false);
  });

  it('refuses PHQ-9 submission when PHQ-9 is not due in the round', async () => {
    // Round 2 (2026-11-19) is not a scheduled PHQ-9 round (if R1 completed PHQ-9)
    const { ports, clock } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    // Complete R1 taps & PHQ-9
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    for (let i = 1; i <= 9; i++) {
      await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 0 },
        ports
      );
    }

    // Advance to Round 2
    clock.setNow('2026-11-19T16:00:00.000Z');
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // PHQ-9 is NOT due in Round 2
    const res = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(res.ok).toBe(false);
  });

  it('refuses PHQ-9 answer after completion', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    for (let i = 1; i <= 9; i++) {
      await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 0 },
        ports
      );
    }

    // Now complete; subsequent attempt to change answer must be refused
    const res = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '1', value: 2 },
      ports
    );
    expect(res.ok).toBe(false);
  });

  it('refuses invalid values', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    // Invalid tap values (range 0..4, integers only)
    expect(
      (
        await submitTaps(
          patientActor,
          { patientId, mood: 5, interest: 3 },
          ports
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await submitTaps(
          patientActor,
          { patientId, mood: -1, interest: 3 },
          ports
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await submitTaps(
          patientActor,
          { patientId, mood: 2.5, interest: 3 },
          ports
        )
      ).ok
    ).toBe(false);

    // Answer taps properly first
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // Invalid PHQ-9 values (range 0..3, item ids '1'..'9')
    expect(
      (
        await submitPhq9Answer(
          patientActor,
          { patientId, itemId: '1', value: 4 },
          ports
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await submitPhq9Answer(
          patientActor,
          { patientId, itemId: '1', value: -1 },
          ports
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await submitPhq9Answer(
          patientActor,
          { patientId, itemId: '99', value: 0 },
          ports
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await submitPhq9Answer(
          patientActor,
          { patientId, itemId: '1', value: 1.5 },
          ports
        )
      ).ok
    ).toBe(false);
  });

  it('a refused attempt whose later code would fail still leaves its log entry outside unit of work', async () => {
    const { ports, unitOfWork } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    // Later code / unit of work would fail if entered
    unitOfWork.failNext = true;

    // Staff attempt is refused
    const res = await submitTaps(
      nurseActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(res.ok).toBe(false);

    // Refusal log entry was written outside unit of work and is preserved
    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor.kind).toBe('staff');
    expect(logs[0].allowed).toBe(false);
    expect(logs[0].reason).toBe('clinic_staff_forbidden_clinical_data');
  });

  it('no log entry is lost when the unit of work rolls back for a refusal', async () => {
    const { ports, unitOfWork } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(activeRecord);

    // Make unit of work roll back
    unitOfWork.failNext = true;

    const resPhq9 = await submitPhq9Answer(
      adminActor,
      { patientId, itemId: '1', value: 0 },
      ports
    );
    expect(resPhq9.ok).toBe(false);

    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor.kind).toBe('staff');
    expect(logs[0].allowed).toBe(false);
    expect(logs[0].reason).toBe('clinic_staff_forbidden_clinical_data');
  });
});
