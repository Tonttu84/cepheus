import { describe, expect, it } from 'vitest';
import type { PatientActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { getCheckInState } from '../get-check-in-state';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';

describe('CheckInState and Taps Status (Points 4 and 5)', () => {
  const patientId = 'check-in-patient-1';
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

  it('CheckInState object has exactly the keys openRound, taps, isPhq9Due, phq9Progress, hasSuggestionWaiting', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const keys = Object.keys(res.value).sort();
    const expectedKeys = ['extraItem', 'hasSuggestionWaiting', 'isPhq9Due', 'openRound', 'phq9Progress', 'taps'].sort();
    expect(keys).toEqual(expectedKeys);

    // Duplicated and legacy keys must be removed
    expect(res.value).not.toHaveProperty('areTapsAnswered');
    expect(res.value).not.toHaveProperty('tapsAnswered');
    expect(res.value).not.toHaveProperty('phq9Due');
    expect(res.value).not.toHaveProperty('suggestionWaiting');
  });

  it('before either submission, taps is waiting', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect((res.value as unknown as { taps: string }).taps).toBe('waiting');
  });

  it('after submitTaps, taps is answered', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const tapRes = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );
    expect(tapRes.ok).toBe(true);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect((res.value as unknown as { taps: string }).taps).toBe('answered');
  });

  it('after submitNotToday, taps is not_today', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const notTodayRes = await submitNotToday(patientActor, { patientId }, ports);
    expect(notTodayRes.ok).toBe(true);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect((res.value as unknown as { taps: string }).taps).toBe('not_today');
  });

  it('when no round is open, taps is waiting', async () => {
    // Before enrolment / first round opens (e.g. 12:00 UTC on 2026-11-16)
    const { ports } = createFakePorts('2026-11-16T12:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.openRound).toBeNull();
    expect((res.value as unknown as { taps: string }).taps).toBe('waiting');
  });
  it('after "Not today" no PHQ-9 is due in that round, and it carries over to the next round', async () => {
    const { ports, clock } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const notToday = await submitNotToday(patientActor, { patientId }, ports);
    expect(notToday.ok).toBe(true);

    const sameRound = await getCheckInState(patientActor, { patientId }, ports);
    expect(sameRound.ok).toBe(true);
    if (!sameRound.ok) return;
    expect(sameRound.value.taps).toBe('not_today');
    expect(sameRound.value.isPhq9Due).toBe(false);
    expect(sameRound.value.phq9Progress).toBe('not_started');

    clock.setNow('2026-11-19T16:00:00.000Z');
    const nextRound = await getCheckInState(patientActor, { patientId }, ports);
    expect(nextRound.ok).toBe(true);
    if (!nextRound.ok) return;
    expect(nextRound.value.openRound?.number).toBe(2);
    expect(nextRound.value.isPhq9Due).toBe(true);
  });
});
