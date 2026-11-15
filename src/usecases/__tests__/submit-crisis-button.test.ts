import { describe, expect, it } from "vitest";
import type { PatientActor, StaffActor } from "@/domain/access";
import { CRISIS_RESOURCES } from "@/lib/constants";
import type { PatientRecord } from "../ports";
import { submitCrisisButton } from "../submit-crisis-button";
import { createFakePorts } from "../testing";

describe("Submit Crisis Button Use Case", () => {
  const patientId = "patient-crisis-1";
  const clinicId = "clinic-1";

  const patientActor: PatientActor = {
    kind: "patient",
    patientId,
    clinicId,
  };

  const otherPatientActor: PatientActor = {
    kind: "patient",
    patientId: "patient-other",
    clinicId,
  };

  const nurseActor: StaffActor = {
    kind: "staff",
    staffId: "nurse-1",
    clinicId,
    role: "nurse",
  };

  const sampleRecord: PatientRecord = {
    patientId,
    clinicId,
    schedule: {
      weekdays: [1, 4],
      timeOfDay: "18:00",
      timeZone: "Europe/Helsinki",
      enrolmentDate: "2026-11-16",
    },
    consent: {
      taking_part: true,
      methods: { ring: false, camera: false },
      rule_check: false,
    },
  };

  it("records one crisis event for the current round and returns crisis path and resources", async () => {
    const pressTime = "2026-11-16T18:00:00.000Z";
    const { ports } = createFakePorts(pressTime);
    await ports.patients.savePatient(sampleRecord);

    const result = await submitCrisisButton(
      patientActor,
      { patientId, time: pressTime },
      ports
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.saved).toBe(true);
    expect(result.showCrisisPath).toBe(true);
    expect(result.crisisResources).toEqual(CRISIS_RESOURCES);
    expect(result.value.saved).toBe(true);
    expect(result.value.showCrisisPath).toBe(true);
    expect(result.value.crisisResources).toEqual(CRISIS_RESOURCES);
    expect(result.value.roundNumber).toBe(1);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      patientId,
      roundNumber: 1,
      itemId: "crisis_button",
      value: 1,
      occurredAt: pressTime,
    });
  });

  it("records crisis event and returns crisis path when consent is paused", async () => {
    const pressTime = "2026-11-16T18:00:00.000Z";
    const { ports } = createFakePorts(pressTime);
    await ports.patients.savePatient({
      ...sampleRecord,
      consent: {
        taking_part: false,
        methods: { ring: false, camera: false },
        rule_check: false,
      },
    });

    const result = await submitCrisisButton(
      patientActor,
      { patientId, time: pressTime },
      ports
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.saved).toBe(true);
    expect(result.showCrisisPath).toBe(true);
    expect(result.crisisResources).toEqual(CRISIS_RESOURCES);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0].itemId).toBe("crisis_button");
  });

  it("shows crisis path and crisis resources when access is refused, storing nothing", async () => {
    const pressTime = "2026-11-16T18:00:00.000Z";
    const { ports } = createFakePorts(pressTime);
    await ports.patients.savePatient(sampleRecord);

    const nurseResult = await submitCrisisButton(
      nurseActor,
      { patientId, time: pressTime },
      ports
    );
    expect(nurseResult.ok).toBe(false);
    expect(nurseResult.showCrisisPath).toBe(true);
    expect(nurseResult.crisisResources).toEqual(CRISIS_RESOURCES);
    expect(nurseResult.saved).toBe(false);

    const otherResult = await submitCrisisButton(
      otherPatientActor,
      { patientId, time: pressTime },
      ports
    );
    expect(otherResult.ok).toBe(false);
    expect(otherResult.showCrisisPath).toBe(true);
    expect(otherResult.crisisResources).toEqual(CRISIS_RESOURCES);
    expect(otherResult.saved).toBe(false);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(0);

    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => !l.allowed)).toBe(true);
  });

  it("reports not saved on storage failure while still returning the crisis path and resources", async () => {
    const pressTime = "2026-11-16T18:00:00.000Z";
    const { ports, unitOfWork } = createFakePorts(pressTime);
    await ports.patients.savePatient(sampleRecord);

    unitOfWork.failNext = true;

    const result = await submitCrisisButton(
      patientActor,
      { patientId, time: pressTime },
      ports
    );

    expect(result.ok).toBe(false);
    expect(result.saved).toBe(false);
    expect(result.showCrisisPath).toBe(true);
    expect(result.crisisResources).toEqual(CRISIS_RESOURCES);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(0);
  });

  it("never records more than one crisis event per round and never changes an existing one", async () => {
    const firstPress = "2026-11-16T18:00:00.000Z";
    const secondPress = "2026-11-16T18:05:00.000Z";
    const { ports } = createFakePorts(firstPress);
    await ports.patients.savePatient(sampleRecord);

    const res1 = await submitCrisisButton(
      patientActor,
      { patientId, time: firstPress },
      ports
    );
    expect(res1.ok).toBe(true);

    const res2 = await submitCrisisButton(
      patientActor,
      { patientId, time: secondPress },
      ports
    );
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.saved).toBe(true);
    expect(res2.showCrisisPath).toBe(true);
    expect(res2.crisisResources).toEqual(CRISIS_RESOURCES);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0].occurredAt).toBe(firstPress);
    expect(events[0].itemId).toBe("crisis_button");
  });

  it("handles two presses at once without duplicate events", async () => {
    const time1 = "2026-11-16T18:00:00.000Z";
    const time2 = "2026-11-16T18:00:01.000Z";
    const { ports } = createFakePorts(time1);
    await ports.patients.savePatient(sampleRecord);

    const [res1, res2] = await Promise.all([
      submitCrisisButton(patientActor, { patientId, time: time1 }, ports),
      submitCrisisButton(patientActor, { patientId, time: time2 }, ports),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res1.showCrisisPath).toBe(true);
    expect(res2.showCrisisPath).toBe(true);
    expect(res1.crisisResources).toEqual(CRISIS_RESOURCES);
    expect(res2.crisisResources).toEqual(CRISIS_RESOURCES);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0].itemId).toBe("crisis_button");
    expect(events[0].value).toBe(1);
  });

  it("resolves the latest round when no round is open, or defaults to 1", async () => {
    const beforeRound1 = "2026-11-15T12:00:00.000Z"; // Sunday before round 1 opens on Monday 18:00
    const { ports } = createFakePorts(beforeRound1);
    await ports.patients.savePatient(sampleRecord);

    await ports.rounds.saveRound({
      patientId,
      roundNumber: 3,
      localDate: "2026-11-15",
      status: "answered",
      mood: 3,
      interest: 2,
    });

    const result = await submitCrisisButton(
      patientActor,
      { patientId, time: beforeRound1 },
      ports
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.roundNumber).toBe(3);

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0].roundNumber).toBe(3);
  });

  it("returns crisis path and resources on invalid patientId", async () => {
    const { ports } = createFakePorts();
    const result = await submitCrisisButton(
      patientActor,
      { patientId: "", time: "2026-11-16T18:00:00.000Z" },
      ports
    );

    expect(result.ok).toBe(false);
    expect(result.saved).toBe(false);
    expect(result.showCrisisPath).toBe(true);
    expect(result.crisisResources).toEqual(CRISIS_RESOURCES);
  });
});
