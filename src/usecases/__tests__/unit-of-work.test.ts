import { describe, expect, it } from 'vitest';
import type { PatientActor } from '../../domain/access';
import type { PatientRecord } from '../ports';
import { createFakePorts } from '../testing';
import { submitPhq9Answer } from '../submit-phq9-answer';
import { submitTaps } from '../submit-taps';
import { FakePhq9Repository } from '../testing/fake-ports';

describe('Unit Of Work', () => {
  const patientId = 'patient-uow';
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

  it('prevents interleaving: two submissions of the last PHQ-9 item result in only one completion', async () => {
    const { ports } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);
    await submitTaps(patientActor, { patientId, mood: 3, interest: 3 }, ports);

    // Answer items 1-8
    for (let i = 1; i <= 8; i++) {
      await submitPhq9Answer(
        patientActor,
        { patientId, itemId: String(i), value: 0 },
        ports
      );
    }

    let secondAttemptStarted = false;
    const secondAttemptPromise: Promise<unknown>[] = [];

    // Hook to run the second request between read and write of the first
    (ports.phq9 as FakePhq9Repository).beforeSave = async () => {
      if (!secondAttemptStarted) {
        secondAttemptStarted = true;
        // Start the second submission of the last item
        secondAttemptPromise.push(
          submitPhq9Answer(
            patientActor,
            { patientId, itemId: '9', value: 0 },
            ports
          )
        );
        // Add a small delay to ensure the second request enters UoW and waits at the lock
        await new Promise((r) => setTimeout(r, 10));
      }
    };

    // First submission of the last item
    const firstRes = await submitPhq9Answer(
      patientActor,
      { patientId, itemId: '9', value: 0 },
      ports
    );

    const secondRes = (await secondAttemptPromise[0]) as { ok: boolean, error?: string };

    // One should succeed, the other should fail because PHQ-9 is already completed
    expect(firstRes.ok).toBe(true);
    expect(secondRes.ok).toBe(false);
    expect((secondRes as { error?: string }).error).toMatch(/PHQ-9 is already completed/);

    const phq9s = await ports.phq9.getPhq9s(patientId);
    expect(phq9s.length).toBe(1);
    expect(phq9s[0].progress).toBe('completed');
  });

  it('undoes a partial write if a failure is injected after the first write', async () => {
    const { ports, unitOfWork } = createFakePorts('2026-11-16T16:00:00.000Z');
    await ports.patients.savePatient(sampleRecord);
    
    // Inject a failure that will trigger right after work() finishes
    unitOfWork.failNext = true;

    const res = await submitTaps(
      patientActor,
      { patientId, mood: 3, interest: 3 },
      ports
    );

    expect(res.ok).toBe(false);
    
    // Assert nothing of that unit remains
    const rounds = await ports.rounds.getRounds(patientId);
    expect(rounds.length).toBe(0);
    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs.length).toBe(0); // since we rolled back
  });
});
