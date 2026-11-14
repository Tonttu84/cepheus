import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import { createFakePorts } from '../testing';
import { recordNurseCallOutcome, type RecordNurseCallOutcomeInput } from '../record-nurse-call-outcome';
import { evaluatePatient } from '../evaluate-patient';

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

describe('recordNurseCallOutcome', () => {
  it('records a nurse call outcome, updates the flag to watching for a rough patch, and logs access', async () => {
    const { ports, ctx } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        flagId: 'flag-123',
        status: 'completed',
        outcomeTier: 'rough_patch',
        actionTaken: 'advice_and_medication_check',
        medicationChecked: true,
        watchNextRounds: 2,
        date: '2026-11-16',
      },
      ports
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.patientId).toBe('patient-1');
    expect(res.value.status).toBe('completed');
    expect(res.value.outcomeTier).toBe('rough_patch');
    expect(res.value.actionTaken).toBe('advice_and_medication_check');
    expect(res.value.flagStatus).toBe('watching');

    // Flag status was updated
    expect(ctx.state.flagStatuses['flag-123']).toBe('watching');

    // Call was stored
    const calls = await ports.calls.getCalls('patient-1');
    expect(calls).toEqual([{ patientId: 'patient-1', date: '2026-11-16', position: 'after' }]);

    // Access log recorded
    const logs = await ports.accessLog.getLogs('patient-1');
    expect(
      logs.some(
        (l) => l.actor.kind === 'staff' && l.action === 'write' && l.target.kind === 'call_outcomes' && l.allowed
      )
    ).toBe(true);
  });

  it('updates the flag to booster_offered when action is booster_tms_cluster', async () => {
    const { ports, ctx } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        flagId: 'flag-tms',
        status: 'completed',
        outcomeTier: 'sustained_decline',
        actionTaken: 'booster_tms_cluster',
        boosterSessionsPlanned: 5,
        date: '2026-11-16',
      },
      ports
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.flagStatus).toBe('booster_offered');
    expect(ctx.state.flagStatuses['flag-tms']).toBe('booster_offered');
  });

  it('updates the flag to resolved when false alarm or referral or urgent care', async () => {
    const { ports, ctx } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        flagId: 'flag-resolved',
        status: 'completed',
        outcomeTier: 'false_alarm',
        actionTaken: 'none',
        date: '2026-11-16',
      },
      ports
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.flagStatus).toBe('resolved');
    expect(ctx.state.flagStatuses['flag-resolved']).toBe('resolved');
  });

  it('updates the flag to nurse_call_requested when call was unreachable', async () => {
    const { ports, ctx } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        flagId: 'flag-unreachable',
        status: 'unreachable',
      },
      ports
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.flagStatus).toBe('nurse_call_requested');
    expect(ctx.state.flagStatuses['flag-unreachable']).toBe('nurse_call_requested');
  });

  it('restarts the warning rule after a recorded completed call', async () => {
    const { ports } = createFakePorts('2026-11-16T18:00:00.000Z');
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-10-01' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    // Provide baseline: 8 answered rounds to establish tap baseline
    for (let r = 1; r <= 8; r++) {
      const dayStr = String(r).padStart(2, '0');
      await ports.rounds.saveRound({
        patientId: 'patient-1',
        roundNumber: r,
        localDate: `2026-10-${dayStr}`,
        status: 'answered',
        mood: 3,
        interest: 3,
      });
    }
    // 2 missed rounds -> warning raised
    await ports.rounds.saveRound({
      patientId: 'patient-1',
      roundNumber: 9,
      localDate: '2026-10-09',
      status: 'missed',
    });
    await ports.rounds.saveRound({
      patientId: 'patient-1',
      roundNumber: 10,
      localDate: '2026-10-10',
      status: 'missed',
    });

    // Evaluate before call
    const evalBefore = await evaluatePatient({ kind: 'system' }, { patientId: 'patient-1' }, ports);
    expect(evalBefore.ok).toBe(true);
    const warningsBefore = await ports.warnings.getWarnings('patient-1');
    expect(warningsBefore.length).toBeGreaterThan(0);

    // Record call
    await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        status: 'completed',
        outcomeTier: 'rough_patch',
        actionTaken: 'advice_and_medication_check',
        date: '2026-10-10',
        position: 'after',
      },
      ports
    );

    // After call, evaluatePatient recognizes the call and restarts the rule
    // A single low round after the call produces small_dip, not an ongoing warning
    await ports.rounds.saveRound({
      patientId: 'patient-1',
      roundNumber: 11,
      localDate: '2026-10-11',
      status: 'answered',
      mood: 1,
      interest: 1,
    });
    const evalAfter = await evaluatePatient({ kind: 'system' }, { patientId: 'patient-1' }, ports);
    expect(evalAfter.ok).toBe(true);
    if (!evalAfter.ok) return;
    expect(evalAfter.value.newEffects.some((e) => e.type === 'small_dip')).toBe(true);
  });

  it('refuses when patient has revoked consent for care (consent_required)', async () => {
    const { ports } = createFakePorts();
    await ports.patients.savePatient({
      patientId: 'patient-no-consent',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-no-consent',
        status: 'completed',
        outcomeTier: 'rough_patch',
      },
      ports
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('consent_required');
    }

    const logs = await ports.accessLog.getLogs('patient-no-consent');
    expect(logs.some((l) => l.actor.kind === 'staff' && !l.allowed && l.reason === 'consent_required')).toBe(true);
  });

  it('refuses staff of another clinic (other_clinic)', async () => {
    const { ports } = createFakePorts();
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffB,
      {
        patientId: 'patient-1',
        status: 'completed',
      },
      ports
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('other_clinic');
    }
  });

  it('refuses patient actors', async () => {
    const { ports } = createFakePorts();
    const res = await recordNurseCallOutcome(patientUser, { patientId: 'patient-1' }, ports);
    expect(res.ok).toBe(false);
  });

  it('refuses invalid outcome tier or action taken', async () => {
    const { ports } = createFakePorts();
    await ports.patients.savePatient({
      patientId: 'patient-1',
      clinicId: CLINIC_A,
      schedule: { weekdays: [1, 4], timeOfDay: '18:00', timeZone: 'Europe/Helsinki', enrolmentDate: '2026-11-16' },
      consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
    });

    const res = await recordNurseCallOutcome(
      staffA,
      {
        patientId: 'patient-1',
        outcomeTier: 'invalid_tier' as unknown as RecordNurseCallOutcomeInput['outcomeTier'],
      },
      ports
    );
    expect(res.ok).toBe(false);
  });
});
