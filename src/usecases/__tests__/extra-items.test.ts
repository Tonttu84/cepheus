import { describe, expect, it } from 'vitest';
import type { PatientActor, StaffActor } from '../../domain/access';
import { EXTRA_ITEMS } from '../../domain/extra-items';
import { isScheduledPhq9Round } from '../../domain/rounds';
import { closeElapsedRounds } from '../close-elapsed-rounds';
import { evaluatePatient } from '../evaluate-patient';
import { getCheckInState } from '../get-check-in-state';
import type { PatientRecord } from '../ports';
import { submitExtraAnswer } from '../submit-extra-answer';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { submitTaps } from '../submit-taps';
import { createFakePorts } from '../testing';

describe('Use Cases: Rotating Extra Items and submitExtraAnswer', () => {
  const patientId = 'patient-extra-1';
  const otherPatientId = 'patient-extra-2';
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

  function assertNoForbiddenFields(obj: unknown) {
    expect(obj).toBeDefined();
    if (typeof obj !== 'object' || obj === null) return;

    const record = obj as Record<string, unknown>;
    const forbidden = [
      'total',
      'score',
      'kind',
      'roundkind',
      'baseline',
      'baselines',
      'warning',
      'warnings',
      'flag',
      'flags',
      'otherpatient',
    ];

    for (const key of Object.keys(record)) {
      expect(forbidden).not.toContain(key.toLowerCase());
      if (typeof record[key] === 'object' && record[key] !== null) {
        assertNoForbiddenFields(record[key]);
      }
    }
  }

  describe('getCheckInState with extra items', () => {
    it('returns extraItem as null when the feature is disabled (default)', async () => {
      // Round 2 (Thursday 2026-11-19 16:00 UTC)
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      const res = await getCheckInState(patientActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.openRound?.number).toBe(2);
      expect(res.value.extraItem).toBeNull();
      assertNoForbiddenFields(res.value);
    });

    it('returns extraItem as null on PHQ-9 rounds even when enabled', async () => {
      // Round 1 (Monday 2026-11-16 16:00 UTC, PHQ-9 round)
      const { ports } = createFakePorts('2026-11-16T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);

      const res = await getCheckInState(patientActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.openRound?.number).toBe(1);
      expect(res.value.extraItem).toBeNull();
      assertNoForbiddenFields(res.value);
    });

    it('returns the rotated extra item on non-PHQ-9 rounds when enabled', async () => {
      // Round 2 (Thursday 2026-11-19 16:00 UTC)
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);

      const res = await getCheckInState(patientActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.openRound?.number).toBe(2);
      expect(res.value.extraItem).not.toBeNull();
      expect(res.value.extraItem?.id).toBe('extra_sleep');
      expect(res.value.extraItem?.topicKey).toBe('sleep');
      assertNoForbiddenFields(res.value);
    });
  });

  describe('submitExtraAnswer refusals and validations', () => {
    it('refuses when feature is disabled', async () => {
      // Round 2
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/disabled/i);
    });

    it('feature disabled and the patient\'s consent missing gives the consent refusal with its access-log entry', async () => {
      // Round 2
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z');
      const recordConsentOff: PatientRecord = {
        ...sampleRecord,
        consent: {
          taking_part: false,
          methods: { ring: false, camera: false },
          rule_check: false,
        },
      };
      await ports.patients.savePatient(recordConsentOff);

      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBe('consent_required');

      const logs = await ports.accessLog.getLogs(patientId);
      const consentRefusals = logs.filter(
        (l) => !l.allowed && l.reason === 'consent_required'
      );
      expect(consentRefusals.length).toBe(1);
    });

    it('refuses for staff and logs the refusal with clinic_staff_forbidden_clinical_data', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const res = await submitExtraAnswer(
        nurseActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);

      const logs = await ports.accessLog.getLogs(patientId);
      const staffRefusals = logs.filter(
        (l) => l.actor.kind === 'staff' && !l.allowed && l.reason === 'clinic_staff_forbidden_clinical_data'
      );
      expect(staffRefusals.length).toBeGreaterThanOrEqual(1);
    });

    it('refuses for another patient with not_own_data', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const res = await submitExtraAnswer(
        otherPatientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBe('not_own_data');
    });

    it('refuses when no round is open', async () => {
      // Prior to enrolment: 2026-11-16 12:00 UTC
      const { ports } = createFakePorts('2026-11-16T12:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);

      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
    });

    it('refuses before taps are answered', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);

      // Taps NOT submitted yet
      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/before taps/i);
    });

    it('refuses for another round when roundNumber is specified and does not match open round', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      // Open round is 2, trying to submit for round 1
      const res = await submitExtraAnswer(
        patientActor,
        { patientId, roundNumber: 1, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/another round/i);
    });

    it('refuses for an item not offered for the round', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      // Round 2 offers extra_sleep, not extra_energy
      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_energy', value: 3 },
        ports
      );
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/not offered/i);
    });

    it('refuses when value is outside 0 to 4 or not an integer (1.5, -1, 5, NaN, and a string)', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const resFloat = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 1.5 },
        ports
      );
      expect(resFloat.ok).toBe(false);

      const resNeg = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: -1 },
        ports
      );
      expect(resNeg.ok).toBe(false);

      const resHigh = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 5 },
        ports
      );
      expect(resHigh.ok).toBe(false);

      const resNan = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: NaN },
        ports
      );
      expect(resNan.ok).toBe(false);

      const resString = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: '3' as unknown as number },
        ports
      );
      expect(resString.ok).toBe(false);
    });

    it('accepts valid submission and saves it in extra answers repository', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const res = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 4 },
        ports
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.recorded).toBe(true);

      const stored = await ports.extraAnswers.getExtraAnswer(patientId, 2);
      expect(stored).not.toBeNull();
      expect(stored?.patientId).toBe(patientId);
      expect(stored?.roundNumber).toBe(2);
      expect(stored?.itemId).toBe('extra_sleep');
      expect(stored?.value).toBe(4);
      expect(stored?.answeredAt).toBe('2026-11-19T16:00:00.000Z');
    });

    it('refuses when submitted twice for the same round', async () => {
      const { ports } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await ports.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

      const first = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 4 },
        ports
      );
      expect(first.ok).toBe(true);

      const second = await submitExtraAnswer(
        patientActor,
        { patientId, itemId: 'extra_sleep', value: 3 },
        ports
      );
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.error).toMatch(/already submitted/i);
    });
  });

  describe('Skipping extra items at no cost', () => {
    it('a round where extra item was offered and not answered has identical status to one where it was not offered', async () => {
      // Test two setups: one with extra items off, one with extra items on (but skipped)
      const { ports: portsDisabled } = createFakePorts('2026-11-19T16:00:00.000Z');
      await portsDisabled.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, portsDisabled);

      const { ports: portsEnabled } = createFakePorts('2026-11-19T16:00:00.000Z', {
        version: 1,
        enabled: true,
        items: EXTRA_ITEMS,
      });
      await portsEnabled.patients.savePatient(sampleRecord);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, portsEnabled);
      // Extra item is offered in portsEnabled, but patient does NOT answer it.

      const roundDisabled = await portsDisabled.rounds.getRound(patientId, 2);
      const roundEnabled = await portsEnabled.rounds.getRound(patientId, 2);

      expect(roundEnabled?.status).toBe(roundDisabled?.status);
      expect(roundEnabled?.status).toBe('answered');
      expect(roundEnabled?.mood).toBe(roundDisabled?.mood);
      expect(roundEnabled?.interest).toBe(roundDisabled?.interest);

      // Nothing stored in extraAnswers for portsEnabled
      const extraAnswers = await portsEnabled.extraAnswers.getExtraAnswers(patientId);
      expect(extraAnswers).toHaveLength(0);
    });
  });

  describe('Proof that extra items are not load-bearing: Demo Story parity', () => {
    async function runDemoStorySimulation(enableExtraItems: boolean) {
      const extraConfig = enableExtraItems
        ? {
            version: 1,
            enabled: true,
            items: EXTRA_ITEMS,
          }
        : undefined;
      const { ports, clock } = createFakePorts('2026-11-16T16:00:00.000Z', extraConfig);
      await ports.patients.savePatient(sampleRecord);

      const systemActor = { kind: 'system' as const };

      // Round 1: PHQ-9 scheduled
      const state1 = await getCheckInState(patientActor, { patientId }, ports);
      expect(state1.ok).toBe(true);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
      await evaluatePatient(systemActor, { patientId }, ports);

      for (let i = 1; i <= 9; i++) {
        const pRes = await submitPhq9Answer(
          patientActor,
          { patientId, itemId: String(i), value: 0 },
          ports
        );
        if (pRes.ok && pRes.value.ruleRunNeeded) {
          await evaluatePatient(systemActor, { patientId }, ports);
        }
      }

      // Rounds 2 through 8
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

        await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
        await evaluatePatient(systemActor, { patientId }, ports);

        if (enableExtraItems && state.ok && state.value.extraItem) {
          const extraRes = await submitExtraAnswer(
            patientActor,
            { patientId, itemId: state.value.extraItem.id, value: 0 },
            ports
          );
          expect(extraRes.ok).toBe(true);
        }
        // 1c: Run evaluatePatient again after each extra answer in both runs
        await evaluatePatient(systemActor, { patientId }, ports);

        if (item.isPhq9) {
          for (let i = 1; i <= 9; i++) {
            // 1b: Answer self-harm item (item 9) with value > 0 (e.g. 1) to test crisis event comparison
            const phqVal = i === 9 ? 1 : 0;
            const phqRes = await submitPhq9Answer(
              patientActor,
              { patientId, itemId: String(i), value: phqVal },
              ports
            );
            if (phqRes.ok && phqRes.value.ruleRunNeeded) {
              await evaluatePatient(systemActor, { patientId }, ports);
            }
          }
        }
      }

      // Round 9: Low round (small dip)
      clock.setNow('2026-12-14T16:00:00.000Z');
      const state9 = await getCheckInState(patientActor, { patientId }, ports);
      expect(state9.ok).toBe(true);
      await submitTaps(patientActor, { patientId, mood: 1, interest: 1 }, ports);
      await evaluatePatient(systemActor, { patientId }, ports);

      if (enableExtraItems && state9.ok && state9.value.extraItem) {
        const extraRes = await submitExtraAnswer(
          patientActor,
          { patientId, itemId: state9.value.extraItem.id, value: 4 },
          ports
        );
        expect(extraRes.ok).toBe(true);
      }
      // 1c: Run evaluatePatient again after each extra answer in both runs
      await evaluatePatient(systemActor, { patientId }, ports);

      // Round 10: Back to normal
      clock.setNow('2026-12-17T16:00:00.000Z');
      const state10 = await getCheckInState(patientActor, { patientId }, ports);
      expect(state10.ok).toBe(true);
      await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
      await evaluatePatient(systemActor, { patientId }, ports);

      if (enableExtraItems && state10.ok && state10.value.extraItem) {
        const extraRes = await submitExtraAnswer(
          patientActor,
          { patientId, itemId: state10.value.extraItem.id, value: 1 },
          ports
        );
        expect(extraRes.ok).toBe(true);
      }
      // 1c: Run evaluatePatient again after each extra answer in both runs
      await evaluatePatient(systemActor, { patientId }, ports);

      // Rounds 11 & 12: Silence (missed)
      clock.setNow('2026-12-24T17:00:00.000Z');
      await closeElapsedRounds(systemActor, { patientId }, ports);
      await evaluatePatient(systemActor, { patientId }, ports);

      clock.setNow('2026-12-28T17:00:00.000Z');
      await closeElapsedRounds(systemActor, { patientId }, ports);
      await evaluatePatient(systemActor, { patientId }, ports);

      // 1a: Collect full stored objects without stripping any fields
      const storedRounds = await ports.rounds.getRounds(patientId);
      const warnings = await ports.warnings.getWarnings(patientId);
      const smallDips = await ports.smallDips.getSmallDips(patientId);
      const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
      const allAccessLogs = await ports.accessLog.getLogs(patientId);
      // Access log entries other than those written by submitExtraAnswer
      const accessLogs = allAccessLogs.filter(
        (log) => !(log.actor.kind === 'patient' && log.target.kind === 'answers')
      );

      return {
        ports,
        rounds: storedRounds,
        warnings,
        smallDips,
        crisisEvents,
        accessLogs,
      };
    }

    it('produces identical round statuses, warnings, small dips, and crisis events with extra items disabled vs enabled with answers given in every round', async () => {
      const disabledRun = await runDemoStorySimulation(false);
      const enabledRunWithAnswers = await runDemoStorySimulation(true);

      // 1a: Asserts full stored objects are identical between runs without stripping fields
      expect(enabledRunWithAnswers.rounds).toEqual(disabledRun.rounds);
      expect(enabledRunWithAnswers.warnings).toEqual(disabledRun.warnings);
      expect(enabledRunWithAnswers.smallDips).toEqual(disabledRun.smallDips);
      expect(enabledRunWithAnswers.crisisEvents).toEqual(disabledRun.crisisEvents);
      expect(enabledRunWithAnswers.accessLogs).toEqual(disabledRun.accessLogs);

      // Sanity check of the outcomes
      expect(disabledRun.warnings).toHaveLength(1);
      expect(disabledRun.warnings[0].kind).toBe('silence');
      expect(disabledRun.smallDips).toHaveLength(1);
      expect(disabledRun.smallDips[0].roundNumber).toBe(9);
      expect(disabledRun.rounds).toHaveLength(12);

      // 1b: Assert disabled run has exactly one crisis event
      expect(disabledRun.crisisEvents).toHaveLength(1);
      expect(disabledRun.crisisEvents[0].itemId).toBe('9');
      expect(disabledRun.crisisEvents[0].value).toBe(1);

      // 1d: Assert enabled run stored extra answer in every round offering one, disabled stored none
      const disabledExtraAnswers = await disabledRun.ports.extraAnswers.getExtraAnswers(patientId);
      expect(disabledExtraAnswers).toHaveLength(0);

      const enabledExtraAnswers = await enabledRunWithAnswers.ports.extraAnswers.getExtraAnswers(patientId);
      // Non-PHQ-9 answered rounds: rounds 2, 3, 4, 6, 7, 8, 10 -> count is 7
      const nonPhq9AnsweredRoundsCount = enabledRunWithAnswers.rounds.filter(
        (r) => r.status === 'answered' && !isScheduledPhq9Round(r.roundNumber)
      ).length;
      expect(nonPhq9AnsweredRoundsCount).toBe(7);
      expect(enabledExtraAnswers).toHaveLength(nonPhq9AnsweredRoundsCount);
    });
  });
});
