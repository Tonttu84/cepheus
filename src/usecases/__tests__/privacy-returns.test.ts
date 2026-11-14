import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { getCheckInState } from '../get-check-in-state';
import { submitTaps } from '../submit-taps';
import { submitNotToday } from '../submit-not-today';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { closeElapsedRounds } from '../close-elapsed-rounds';

describe('Privacy of Return Values (Ruling d)', () => {
  const patientId = 'patient-privacy';
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

  function assertNoForbiddenFields(obj: unknown) {
    expect(obj).toBeDefined();
    if (typeof obj !== 'object' || obj === null) return;

    const record = obj as Record<string, unknown>;
    const forbidden = [
      'total',
      'score',
      'kind',
      'roundKind',
      'baseline',
      'baselines',
      'warning',
      'warnings',
      'flag',
      'flags',
      'otherPatient',
    ];

    for (const key of Object.keys(record)) {
      expect(forbidden).not.toContain(key.toLowerCase());
      if (typeof record[key] === 'object' && record[key] !== null) {
        assertNoForbiddenFields(record[key]);
      }
    }
  }

  it('asserts getCheckInState returns no total, kind, baseline, warning, or flag', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await getCheckInState(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    assertNoForbiddenFields(res.value);
  });

  it('asserts submitTaps returns no total, kind, baseline, warning, or flag', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await submitTaps(
      patientActor,
      { patientId, mood: 1, interest: 1 },
      ports
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    assertNoForbiddenFields(res.value);
  });

  it('asserts submitNotToday returns no total, kind, baseline, warning, or flag', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await submitNotToday(patientActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    assertNoForbiddenFields(res.value);
  });

  it('asserts submitPhq9Answer returns no total, kind, baseline, warning, or flag', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // Submit all 9 to complete
    let lastRes: unknown;
    for (let i = 1; i <= 9; i++) {
      const res = await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 0 },
        ports
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      assertNoForbiddenFields(res.value);
      lastRes = res.value;
    }
    assertNoForbiddenFields(lastRes);
  });

  it('asserts closeElapsedRounds returns no total, kind, baseline, warning, or flag', async () => {
    const { ports } = createFakePorts('2026-11-25T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    assertNoForbiddenFields(res.value);
  });
});
