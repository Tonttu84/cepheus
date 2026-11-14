import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitTaps } from '../submit-taps';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { evaluatePatient } from '../evaluate-patient';

describe('Crisis Rule & Unit of Work Rollback', () => {
  const patientId = 'crisis-patient-1';
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

  it.each([1, 2, 3])(
    'stores a crisis event at once and returns crisis signal when self-harm item 9 is answered with %i as first answer',
    async (value) => {
      const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      // Answer taps first to unlock PHQ-9
      await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

      // Submit item 9 as the first answer of unfinished PHQ-9
      const result = await submitPhq9Answer(
        patientActor,
        { patientId, itemId: '9', value },
        ports
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.showCrisisPath).toBe(true);
      expect(result.value.progress).toBe('unfinished');
      expect(result.value.ruleRunNeeded).toBe(false);

      // Crisis event is stored immediately
      const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
      expect(crisisEvents).toHaveLength(1);
      expect(crisisEvents[0].itemId).toBe('9');
      expect(crisisEvents[0].value).toBe(value);
      expect(crisisEvents[0].roundNumber).toBe(1);

      // PHQ-9 has only 1 answer stored and progress is unfinished
      const currentPhq9 = await ports.phq9.getCurrentPhq9(patientId);
      expect(currentPhq9?.progress).toBe('unfinished');
      expect(currentPhq9?.answers).toHaveLength(1);
      expect(currentPhq9?.answers[0]).toEqual({ id: '9', value });
    }
  );

  it('does not store a crisis event and does not show crisis signal when item 9 is answered with 0', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

    const result = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 0 },
      ports
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.showCrisisPath).toBe(false);

    const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
    expect(crisisEvents).toHaveLength(0);
  });

  it('keeps the stored crisis event even when self-harm answer is changed from 2 back to 0', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

    // Answer with 2 first: crisis triggered
    const firstRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 2 },
      ports
    );
    expect(firstRes.ok).toBe(true);
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(1);

    // Now change answer back to 0: crisis event must NOT be removed
    const secondRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 0 },
      ports
    );
    expect(secondRes.ok).toBe(true);

    const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
    expect(crisisEvents).toHaveLength(1);
    expect(crisisEvents[0].value).toBe(2);

    const currentPhq9 = await ports.phq9.getCurrentPhq9(patientId);
    expect(currentPhq9?.answers.find((a) => a.id === '9')?.value).toBe(0);
  });

  it('the same self-harm answer submitted twice gives one crisis event', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

    const firstRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 2 },
      ports
    );
    expect(firstRes.ok).toBe(true);
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(1);

    // Re-submit identical answer
    const secondRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 2 },
      ports
    );
    expect(secondRes.ok).toBe(true);
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(1);
  });

  it('changing self-harm answer from one non-zero value to another stores no second event', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

    const firstRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 1 },
      ports
    );
    expect(firstRes.ok).toBe(true);
    const events1 = await ports.crisis.getCrisisEvents(patientId);
    expect(events1).toHaveLength(1);
    expect(events1[0].value).toBe(1);

    // Change answer to 3
    const secondRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 3 },
      ports
    );
    expect(secondRes.ok).toBe(true);
    const events2 = await ports.crisis.getCrisisEvents(patientId);
    expect(events2).toHaveLength(1);
    expect(events2[0].value).toBe(1); // remains the original first event value
  });

  it('storing fails and the result is an error that still carries the crisis signal', async () => {
    const { ports, unitOfWork } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 2, interest: 2 }, ports);

    // Inject failure into unit of work
    unitOfWork.failNext = true;

    const res = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 2 },
      ports
    );

    // Call failed, but error STILL carries the crisis signal!
    expect(res.ok).toBe(false);
    expect((res as { showCrisisPath?: boolean }).showCrisisPath).toBe(true);

    // Neither the crisis event nor the PHQ-9 answer was persisted
    const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
    expect(crisisEvents).toHaveLength(0);

    const currentPhq9 = await ports.phq9.getCurrentPhq9(patientId);
    expect(currentPhq9).toBeNull();
  });

  it('a self-harm answer as the last PHQ-9 item is stored with its completion and exactly one crisis event without the rule having run, and a later evaluatePatient raises what the rule requires', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // Answer items 1..8 with 1 each (total so far = 8)
    for (let i = 1; i <= 8; i++) {
      const res = await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 1 },
        ports
      );
      expect(res.ok).toBe(true);
    }

    // Submit self-harm item 9 with value 2 (total becomes 10 >= 10 cut-off)
    const lastRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 2 },
      ports
    );

    expect(lastRes.ok).toBe(true);
    if (!lastRes.ok) return;
    expect(lastRes.value.showCrisisPath).toBe(true);
    expect(lastRes.value.progress).toBe('completed');
    expect(lastRes.value.ruleRunNeeded).toBe(true);

    // Exactly one crisis event stored
    const crisisEvents = await ports.crisis.getCrisisEvents(patientId);
    expect(crisisEvents).toHaveLength(1);
    expect(crisisEvents[0].itemId).toBe('9');
    expect(crisisEvents[0].value).toBe(2);

    // PHQ-9 is stored and completed
    const currentPhq9 = await ports.phq9.getCurrentPhq9(patientId);
    expect(currentPhq9?.progress).toBe('completed');
    expect(currentPhq9?.total).toBe(10);

    // IMPORTANT: The rule has NOT run yet!
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    // Now a later evaluatePatient call raises what the rule requires!
    const evalRes = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes.ok).toBe(true);
    if (!evalRes.ok) return;
    expect(evalRes.value.storedEffectsCount).toBe(2);

    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('phq9');

    const notices = await ports.baselineNotWell.getNotices(patientId);
    expect(notices).toHaveLength(1);

    // Still exactly one crisis event
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(1);
  });
});
