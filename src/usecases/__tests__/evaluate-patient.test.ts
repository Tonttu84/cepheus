import { describe, expect, it, vi } from 'vitest';
import type { PatientActor, StaffActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { evaluatePatient } from '../evaluate-patient';
import { FakeWarningRepository } from '../testing/fake-ports';

describe('evaluatePatient Use Case', () => {
  const patientId = 'eval-patient-1';
  const clinicId = 'clinic-1';

  const systemActor: SystemActor = {
    kind: 'system',
  };

  const patientActor: PatientActor = {
    kind: 'patient',
    patientId,
    clinicId,
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

  it('refuses non-system actors from calling evaluatePatient', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const result = await evaluatePatient(patientActor, { patientId }, ports);
    expect(result.ok).toBe(false);
  });

  it('evaluatePatient run twice in a row stores nothing the second time', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Set up two missed rounds
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'missed',
    });
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'missed',
    });

    const first = await evaluatePatient(systemActor, { patientId }, ports);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.storedEffectsCount).toBe(1);

    const warningsAfterFirst = await ports.warnings.getWarnings(patientId);
    expect(warningsAfterFirst).toHaveLength(1);

    // Run second time in a row
    const second = await evaluatePatient(systemActor, { patientId }, ports);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.storedEffectsCount).toBe(0);

    const warningsAfterSecond = await ports.warnings.getWarnings(patientId);
    expect(warningsAfterSecond).toHaveLength(1);
    expect(warningsAfterSecond[0]).toEqual(warningsAfterFirst[0]);
  });

  it('two evaluatePatient runs interleaved against the fake store each effect once', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'missed',
    });
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'missed',
    });

    let secondRunTriggered = false;
    let secondPromise: Promise<unknown> | null = null;

    (ports.warnings as FakeWarningRepository).beforeSave = async () => {
      if (!secondRunTriggered) {
        secondRunTriggered = true;
        // Interleave the second evaluatePatient call
        secondPromise = evaluatePatient(systemActor, { patientId }, ports);
        // Small delay to ensure second request enters and waits for UoW lock
        await new Promise((r) => setTimeout(r, 10));
      }
    };

    const first = await evaluatePatient(systemActor, { patientId }, ports);
    expect(first.ok).toBe(true);
    const second = (await secondPromise!) as { ok: boolean; value: { storedEffectsCount: number } };
    expect(second.ok).toBe(true);

    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
  });

  it('evaluatePatient throws and no stored fact is lost', async () => {
    const { ports, unitOfWork } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'missed',
    });
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'missed',
    });

    // Make unit of work fail inside evaluatePatient
    unitOfWork.failNext = true;

    const result = await evaluatePatient(systemActor, { patientId }, ports);
    expect(result.ok).toBe(false);

    // Stored facts (rounds) are NOT lost
    const rounds = await ports.rounds.getRounds(patientId);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].status).toBe('missed');
    expect(rounds[1].status).toBe('missed');

    // No warning was stored because evaluation rolled back
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(0);
  });

  it('a stored warning with kind A; the rule now reports kind B for the same cause: nothing new is stored and the stored one is unchanged', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    // Round 1 is low (bottom option), Round 2 is missed.
    // The history evaluation rule will report a warning of kind 'mixed' caused by round 2.
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'answered',
      mood: 0,
      interest: 0,
    });
    await ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: '2026-11-19',
      status: 'missed',
    });

    // Pre-store small dip for round 1
    await ports.smallDips.saveSmallDip({
      patientId,
      roundNumber: 1,
      date: '2026-11-16',
      version: 1,
      causedBy: { type: 'round', roundNumber: 1, date: '2026-11-16' },
      shownAt: '2026-11-16T18:00:00.000Z',
    });

    // Pre-store a warning with kind 'silence' (kind A) for the exact same cause (round 2)
    const existingWarning = {
      patientId,
      kind: 'silence' as const,
      since: '2026-11-19',
      version: 1,
      causedBy: {
        type: 'round' as const,
        roundNumber: 2,
        date: '2026-11-19',
      },
      raisedAt: '2026-11-19T18:00:00.000Z',
    };
    await ports.warnings.saveWarning(existingWarning);

    // Evaluate patient (rule reports kind 'mixed' for round 2)
    const res = await evaluatePatient(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Nothing new should be stored
    expect(res.value.storedEffectsCount).toBe(0);
    expect(res.value.newEffects).toHaveLength(0);

    // The stored warning must be unchanged
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('silence');
    expect(warnings[0].raisedAt).toBe('2026-11-19T18:00:00.000Z');
    expect(warnings[0]).toEqual(existingWarning);
  });

  it('calls decideAccess before checking patientId and an invalid patientId returns an error and reads no patient data', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const getPatientSpy = vi.spyOn(ports.patients, 'getPatient');
    const getSwitchesSpy = vi.spyOn(ports.patients, 'getPatientAccessSwitches');

    // With staff actor and invalid patientId: decideAccess refuses first
    const staffActor: StaffActor = {
      kind: 'staff',
      staffId: 'nurse-1',
      clinicId,
      role: 'nurse',
    };
    const staffRes = await evaluatePatient(staffActor, { patientId: '' }, ports);
    expect(staffRes.ok).toBe(false);
    if (!staffRes.ok) {
      expect(staffRes.error).not.toBe('Invalid patientId'); // refused by decideAccess!
    }
    expect(getPatientSpy).not.toHaveBeenCalled();
    expect(getSwitchesSpy).not.toHaveBeenCalled();

    // With system actor and invalid patientId: returns Invalid patientId and reads no patient data
    const systemRes = await evaluatePatient(systemActor, { patientId: '' }, ports);
    expect(systemRes.ok).toBe(false);
    if (!systemRes.ok) {
      expect(systemRes.error).toBe('Invalid patientId');
    }
    expect(getPatientSpy).not.toHaveBeenCalled();
    expect(getSwitchesSpy).not.toHaveBeenCalled();
  });

  describe('patient suggestions on small dip', () => {
    it('a small dip creates one suggestion for the patient with simulated mark and matching text', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient({ ...sampleRecord, isSimulated: true });

      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const res = await evaluatePatient(systemActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.storedEffectsCount).toBe(1);
      const smallDips = await ports.smallDips.getSmallDips(patientId);
      expect(smallDips).toHaveLength(1);

      const suggestion = await ports.suggestions.getLatestSuggestion(patientId);
      expect(suggestion).not.toBeNull();
      expect(suggestion?.patientId).toBe(patientId);
      expect(suggestion?.reason).toBe('small_dip');
      expect(suggestion?.actionKey).toBe('short_walk');
      expect(suggestion?.actionTitle).toBe('Take a 10-minute walk outside');
      expect(suggestion?.effortTier).toBe('low');
      expect(suggestion?.status).toBe('shown');
      expect(suggestion?.isSimulated).toBe(true);
    });

    it('a second evaluation of the same dip creates no second suggestion', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const first = await evaluatePatient(systemActor, { patientId }, ports);
      expect(first.ok).toBe(true);
      const firstSug = await ports.suggestions.getLatestSuggestion(patientId);
      expect(firstSug).not.toBeNull();

      const second = await evaluatePatient(systemActor, { patientId }, ports);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.storedEffectsCount).toBe(0);

      const secondSug = await ports.suggestions.getLatestSuggestion(patientId);
      expect(secondSug?.id).toBe(firstSug?.id);
    });

    it('no dip creates no suggestion', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 3,
        interest: 3,
      });

      const res = await evaluatePatient(systemActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.storedEffectsCount).toBe(0);
      const smallDips = await ports.smallDips.getSmallDips(patientId);
      expect(smallDips).toHaveLength(0);

      const suggestion = await ports.suggestions.getLatestSuggestion(patientId);
      expect(suggestion).toBeNull();
    });

    it('a sustained drop still raises the warning exactly as before and creates no extra suggestion', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      // Round 1: low answers -> small dip
      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const res1 = await evaluatePatient(systemActor, { patientId }, ports);
      expect(res1.ok).toBe(true);
      const sugAfterRound1 = await ports.suggestions.getLatestSuggestion(patientId);
      expect(sugAfterRound1).not.toBeNull();
      const warningsAfterRound1 = await ports.warnings.getWarnings(patientId);
      expect(warningsAfterRound1).toHaveLength(0);

      // Round 2: low answers -> sustained drop raises warning
      await ports.rounds.saveRound({
        patientId,
        roundNumber: 2,
        localDate: '2026-11-19',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const res2 = await evaluatePatient(systemActor, { patientId }, ports);
      expect(res2.ok).toBe(true);
      if (!res2.ok) return;

      expect(res2.value.storedEffectsCount).toBe(1);
      const warningsAfterRound2 = await ports.warnings.getWarnings(patientId);
      expect(warningsAfterRound2).toHaveLength(1);
      expect(warningsAfterRound2[0].kind).toBe('low_answers');

      // The suggestion remains the single one from round 1
      const sugAfterRound2 = await ports.suggestions.getLatestSuggestion(patientId);
      expect(sugAfterRound2?.id).toBe(sugAfterRound1?.id);
    });

    it('a patient who chose "Not today" gets no new suggestion for the same dip', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const first = await evaluatePatient(systemActor, { patientId }, ports);
      expect(first.ok).toBe(true);
      const sug = await ports.suggestions.getLatestSuggestion(patientId);
      expect(sug).not.toBeNull();
      if (!sug) return;

      // Patient chose "Not today" (skipped)
      await ports.suggestions.updateSuggestionChoice(sug.id, 'skipped', '2026-11-16T19:00:00.000Z');
      const skippedSug = await ports.suggestions.getLatestSuggestion(patientId);
      expect(skippedSug?.status).toBe('skipped');

      // Re-evaluate the same dip
      const second = await evaluatePatient(systemActor, { patientId }, ports);
      expect(second.ok).toBe(true);

      // Still the same skipped suggestion, no new suggestion created
      const currentSug = await ports.suggestions.getLatestSuggestion(patientId);
      expect(currentSug?.id).toBe(sug.id);
      expect(currentSug?.status).toBe('skipped');
    });

    it('never more than one unanswered suggestion per patient when another dip occurs', async () => {
      const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
      await ports.patients.savePatient(sampleRecord);

      // Pre-seed an unanswered suggestion
      await ports.suggestions.saveSuggestion({
        id: 'sug-existing-unanswered',
        patientId,
        clinicId,
        createdAt: '2026-11-10T10:00:00.000Z',
        date: '2026-11-10',
        reason: 'practice',
        actionKey: 'short_walk',
        actionTitle: 'Take a 10-minute walk outside',
        actionDetail: 'Walk outside',
        effortTier: 'low',
        status: 'shown',
      });

      // Now a small dip occurs
      await ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: '2026-11-16',
        status: 'answered',
        mood: 0,
        interest: 0,
      });

      const res = await evaluatePatient(systemActor, { patientId }, ports);
      expect(res.ok).toBe(true);

      // Small dip is recorded
      const smallDips = await ports.smallDips.getSmallDips(patientId);
      expect(smallDips).toHaveLength(1);

      // But no new suggestion was created because one was already unanswered
      const latest = await ports.suggestions.getLatestSuggestion(patientId);
      expect(latest?.id).toBe('sug-existing-unanswered');
    });
  });
});
