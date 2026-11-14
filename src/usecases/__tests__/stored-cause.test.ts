import { describe, expect, it } from 'vitest';
import type { PatientActor, SystemActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { evaluatePatient } from '../evaluate-patient';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { submitTaps } from '../submit-taps';

describe('Stored cause of a rule effect', () => {
  const patientId = 'cause-patient-1';
  const clinicId = 'clinic-1';
  const patientActor: PatientActor = { kind: 'patient', patientId, clinicId };
  const systemActor: SystemActor = { kind: 'system' };

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

  it('a warning and a notice caused by a PHQ-9 are stored with its date and without its total', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);
    for (let i = 1; i <= 9; i++) {
      await submitPhq9Answer(patientActor, { patientId, itemId: String(i), value: 2 }, ports);
    }

    const evalRes = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evalRes.ok).toBe(true);

    const warnings = await ports.warnings.getWarnings(patientId);
    const notices = await ports.baselineNotWell.getNotices(patientId);
    expect(warnings).toHaveLength(1);
    expect(notices).toHaveLength(1);
    expect(warnings[0].causedBy).toEqual({ type: 'phq9', date: '2026-11-16' });
    expect(notices[0].causedBy).toEqual({ type: 'phq9', date: '2026-11-16' });
  });
});
