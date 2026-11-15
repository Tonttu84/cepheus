import { beforeEach, describe, expect, it } from "vitest";
import type { PatientActor, StaffActor } from "@/domain/access";
import { setSwitch, resetSettings } from "@/server/api/settings";
import { createFakePorts } from "@/usecases/testing";
import type { Ports } from "@/usecases/ports";
import { getExpressivityShowcase } from "../get-expressivity-showcase";

const CLINIC_ID = "clinic-1";
const PATIENT_ID = "patient-1";

describe("getExpressivityShowcase use case", () => {
  let ports: Ports;
  const staffActor: StaffActor = {
    kind: "staff",
    staffId: "nurse-1",
    clinicId: CLINIC_ID,
    role: "nurse",
  };
  const patientActor: PatientActor = {
    kind: "patient",
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
  };

  beforeEach(async () => {
    resetSettings();
    const fake = createFakePorts();
    ports = fake.ports;

    // Save patient with taking_part, camera consent, and facial_movement_usual_range permission
    await ports.patients.savePatient({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
      consent: {
        taking_part: true,
        methods: { ring: false, camera: true },
        rule_check: true,
        facial_movement_usual_range: true,
      },
    });

    // Seed 6 camera readings with various placeholder numbers on other fields
    // Only expressivityScore should be read and used!
    const readings = [0.2, 0.25, 0.3, 0.35, 0.4, 0.32];
    for (let i = 0; i < readings.length; i++) {
      await ports.camera?.saveCameraReading({
        patientId: PATIENT_ID,
        date: `2026-11-0${i + 1}`,
        dayIndex: i,
        taskId: "check_in_clip_60s",
        durationSec: 60,
        sampleRateHz: 10,
        effectiveFps: 30,
        faceDetectedRatio: 0.95,
        expressivityScore: readings[i],
        // Other fields contain placeholders or extreme values:
        smileFraction: 0,
        yawSdDeg: 999,
        pitchSdDeg: -999,
        angularPathDegPerMin: 120,
      });
    }
  });

  it("refuses access when actor is not staff", async () => {
    setSwitch("expressivityShowcase", true);
    const result = await getExpressivityShowcase(
      patientActor,
      { patientId: PATIENT_ID },
      ports
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/staff/i);
    }
  });

  it("returns evaluated range when all 3 conditions hold (module on, camera consent on, permission on)", async () => {
    setSwitch("expressivityShowcase", true);
    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: PATIENT_ID },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe("within_usual_range");
      if (result.value && result.value.status !== "insufficient_history") {
        expect(result.value.sampleCount).toBe(5); // 5 historical readings
        expect(result.value.mean).toBeCloseTo(0.3, 2);
      }
    }
  });

  it("returns null when module switch is off", async () => {
    setSwitch("expressivityShowcase", false);
    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: PATIENT_ID },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it("returns null when patient camera consent is off", async () => {
    setSwitch("expressivityShowcase", true);
    // Turn camera consent off
    await ports.patients.savePatient({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
      consent: {
        taking_part: true,
        methods: { ring: false, camera: false },
        rule_check: true,
        facial_movement_usual_range: true,
      },
    });

    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: PATIENT_ID },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it("returns null when patient permission is off (or withdrawn)", async () => {
    setSwitch("expressivityShowcase", true);
    // Turn facial_movement_usual_range permission off
    await ports.patients.savePatient({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
      consent: {
        taking_part: true,
        methods: { ring: false, camera: true },
        rule_check: true,
        facial_movement_usual_range: false,
      },
    });

    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: PATIENT_ID },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it("returns insufficient_history when fewer than 5 past readings exist", async () => {
    setSwitch("expressivityShowcase", true);
    const fewPatient = "patient-few";
    await ports.patients.savePatient({
      patientId: fewPatient,
      clinicId: CLINIC_ID,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
      consent: {
        taking_part: true,
        methods: { ring: false, camera: true },
        rule_check: true,
        facial_movement_usual_range: true,
      },
    });

    // Save only 3 readings (2 past + 1 latest)
    for (let i = 0; i < 3; i++) {
      await ports.camera?.saveCameraReading({
        patientId: fewPatient,
        date: `2026-11-0${i + 1}`,
        dayIndex: i,
        taskId: "check_in_clip_60s",
        durationSec: 60,
        sampleRateHz: 10,
        effectiveFps: 30,
        faceDetectedRatio: 0.95,
        expressivityScore: 0.25 + i * 0.05,
        smileFraction: 0,
        yawSdDeg: 1,
        pitchSdDeg: 1,
        angularPathDegPerMin: 100,
      });
    }

    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: fewPatient },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe("insufficient_history");
      if (result.value && result.value.status === "insufficient_history") {
        expect(result.value.count).toBe(2);
        expect(result.value.minimum).toBe(5);
      }
    }
  });

  it("leaves out readings with NaN and 1.5 expressivity scores among good readings", async () => {
    setSwitch("expressivityShowcase", true);
    const noisyPatient = "patient-noisy";
    await ports.patients.savePatient({
      patientId: noisyPatient,
      clinicId: CLINIC_ID,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "18:00",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-11-16",
      },
      consent: {
        taking_part: true,
        methods: { ring: false, camera: true },
        rule_check: true,
        facial_movement_usual_range: true,
      },
    });

    // 6 valid readings (5 past + 1 latest) with a NaN and a 1.5 interspersed
    const scores = [0.2, Number.NaN, 0.25, 1.5, 0.3, 0.35, 0.4, 0.32];
    for (let i = 0; i < scores.length; i++) {
      await ports.camera?.saveCameraReading({
        patientId: noisyPatient,
        date: `2026-11-${String(i + 1).padStart(2, "0")}`,
        dayIndex: i,
        taskId: "check_in_clip_60s",
        durationSec: 60,
        sampleRateHz: 10,
        effectiveFps: 30,
        faceDetectedRatio: 0.95,
        expressivityScore: scores[i],
        smileFraction: 0,
        yawSdDeg: 1,
        pitchSdDeg: 1,
        angularPathDegPerMin: 100,
      });
    }

    const result = await getExpressivityShowcase(
      staffActor,
      { patientId: noisyPatient },
      ports
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe("within_usual_range");
      if (result.value && result.value.status !== "insufficient_history") {
        expect(result.value.sampleCount).toBe(5);
        expect(result.value.mean).toBeCloseTo(0.3, 2);
      }
    }
  });
});
