import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listClinicFlags } from "@/server/api/clinic-flags";
import {
  CLINIC_ID,
  OTHER_CLINIC_ID,
  patientRecord,
  setUpRoutes,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";
import type { StaffActor } from "@/domain/access";
import type { StoredWarning } from "@/usecases/ports";
import { acknowledgeCrisisEvent, evaluatePatient } from "@/usecases";
import type { FakeHomeMonitoringRepository } from "@/usecases/testing/fake-ports";

const STAFF_ACTOR: StaffActor = {
  kind: "staff",
  staffId: "staff-nurse-1",
  clinicId: CLINIC_ID,
  role: "nurse",
};

const OTHER_STAFF_ACTOR: StaffActor = {
  kind: "staff",
  staffId: "staff-other-1",
  clinicId: OTHER_CLINIC_ID,
  role: "nurse",
};

describe("Clinic Flags with Rule Facts and Home Monitoring Supporting Lines", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("returns latest total and change from previous total for a PHQ-9 warning", async () => {
    const patientId = "patient-phq9-change";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.phq9.savePhq9({
      patientId,
      roundNumber: 1,
      progress: "completed",
      total: 8,
      date: "2026-11-02",
      answers: [],
    });
    await fake.ports.phq9.savePhq9({
      patientId,
      roundNumber: 3,
      progress: "completed",
      total: 14,
      date: "2026-11-16",
      answers: [],
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "phq9",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "phq9", date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.patientId).toBe(patientId);
    expect(flag.warningKind).toBe("phq9");
    expect(flag.facts).toBeDefined();
    expect(flag.facts?.latestTotal).toBe(14);
    expect(flag.facts?.previousTotal).toBe(8);
    expect(flag.facts?.change).toBe(6);
    expect(flag.facts?.isFirstMeasurement).toBe(false);
  });

  it("returns isFirstMeasurement: true and null change when PHQ-9 warning is the first measurement", async () => {
    const patientId = "patient-phq9-first";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.phq9.savePhq9({
      patientId,
      roundNumber: 1,
      progress: "completed",
      total: 15,
      date: "2026-11-16",
      answers: [],
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "phq9",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "phq9", date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.warningKind).toBe("phq9");
    expect(flag.facts?.latestTotal).toBe(15);
    expect(flag.facts?.previousTotal).toBeNull();
    expect(flag.facts?.change).toBeNull();
    expect(flag.facts?.isFirstMeasurement).toBe(true);
  });

  it("returns latest total and change for a GAD-7 warning", async () => {
    const patientId = "patient-gad7";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.gad7!.saveGad7({
      patientId,
      roundNumber: 1,
      total: 5,
      date: "2026-11-02",
      answers: [],
    });
    await fake.ports.gad7!.saveGad7({
      patientId,
      roundNumber: 3,
      total: 12,
      date: "2026-11-16",
      answers: [],
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "gad7",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "gad7", date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.warningKind).toBe("gad7");
    expect(flag.facts?.latestTotal).toBe(12);
    expect(flag.facts?.previousTotal).toBe(5);
    expect(flag.facts?.change).toBe(7);
  });

  it("returns roundsUnderBaseline for a low_answers warning", async () => {
    const patientId = "patient-low-answers";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: "2026-11-16",
      status: "answered",
      mood: 0,
      interest: 0,
    });
    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: "2026-11-19",
      status: "answered",
      mood: 0,
      interest: 0,
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "low_answers",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
      raisedAt: "2026-11-19T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.warningKind).toBe("low_answers");
    expect(flag.facts?.roundsUnderBaseline).toBe(2);
  });

  it("returns missed rounds count and since date for a silence warning", async () => {
    const patientId = "patient-silence";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: "2026-11-16",
      status: "missed",
    });
    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: "2026-11-19",
      status: "missed",
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "silence",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
      raisedAt: "2026-11-19T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.warningKind).toBe("silence");
    expect(flag.facts?.missedRoundsCount).toBe(2);
    expect(flag.facts?.missedSince).toBe("2026-11-16");
  });

  it("returns both roundsUnderBaseline and missedRoundsCount for a mixed warning", async () => {
    const patientId = "patient-mixed";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 1,
      localDate: "2026-11-16",
      status: "answered",
      mood: 0,
      interest: 0,
    });
    await fake.ports.rounds.saveRound({
      patientId,
      roundNumber: 2,
      localDate: "2026-11-19",
      status: "missed",
    });

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "mixed",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
      raisedAt: "2026-11-19T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.warningKind).toBe("mixed");
    expect(flag.facts?.roundsUnderBaseline).toBe(1);
    expect(flag.facts?.missedRoundsCount).toBe(1);
  });

  it("indicates whether a crisis event is open for the patient", async () => {
    const patientId = "patient-crisis";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
        consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "silence",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
      raisedAt: "2026-11-19T18:00:00.000Z",
    });

    // Case 1: unacknowledged crisis event is open
    await fake.ports.crisis.saveCrisisEvent({
      patientId,
      roundNumber: 1,
      itemId: "phq9_item9",
      value: 2,
      occurredAt: "2026-11-16T18:00:00.000Z",
      acknowledgedAt: null,
    });

    const flags1 = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(flags1[0].facts?.hasOpenCrisisEvent).toBe(true);

    // Case 2: acknowledged crisis event
    await acknowledgeCrisisEvent(
      STAFF_ACTOR,
      { patientId, roundNumber: 1 },
      fake.ports
    );

    const flags2 = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(flags2[0].facts?.hasOpenCrisisEvent).toBe(false);
  });

  it("gives a nurse of another clinic nothing", async () => {
    const patientId = "patient-own";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];
    fake.clinicPatients[OTHER_CLINIC_ID] = [];

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "silence",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const otherFlags = await listClinicFlags(OTHER_STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(otherFlags).toEqual([]);
  });

  it("leaves facts empty when a warning has no kind or numbers (older flag)", async () => {
    const patientId = "patient-old";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    await fake.ports.warnings.saveWarning({
      patientId,
      kind: undefined as unknown as StoredWarning["kind"],
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const flags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].facts?.latestTotal).toBeUndefined();
    expect(flags[0].facts?.roundsUnderBaseline).toBeUndefined();
    expect(flags[0].facts?.missedRoundsCount).toBeUndefined();
  });

  it("does not invent made-up numbers when a silence, low_answers, or mixed warning has no matching rounds in storage", async () => {
    const patientId = "patient-no-matching-rounds";
    await fake.ports.patients.savePatient(
      patientRecord({
        patientId,
        clinicId: CLINIC_ID,
      })
    );
    fake.clinicPatients[CLINIC_ID] = [patientId];

    // Silence warning with 0 missed rounds in storage
    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "silence",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const silenceFlags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(silenceFlags[0].facts?.missedRoundsCount).toBeUndefined();

    // Low answers warning with 0 low rounds in storage
    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "low_answers",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const lowFlags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(lowFlags[0].facts?.roundsUnderBaseline).toBeUndefined();

    // Mixed warning with 0 matching rounds in storage
    await fake.ports.warnings.saveWarning({
      patientId,
      kind: "mixed",
      since: "2026-11-16",
      version: 1,
      causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
      raisedAt: "2026-11-16T18:00:00.000Z",
    });

    const mixedFlags = await listClinicFlags(STAFF_ACTOR, {
      ports: fake.ports,
      clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
      resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
    });
    expect(mixedFlags[0].facts?.roundsUnderBaseline).toBeUndefined();
    expect(mixedFlags[0].facts?.missedRoundsCount).toBeUndefined();
  });

  describe("Home monitoring supporting lines", () => {
    it("includes wearable worn line, rhythm shift line, and check done line when consent is on", async () => {
      const patientId = "patient-monitored";
      await fake.ports.patients.savePatient(
        patientRecord({
          patientId,
          clinicId: CLINIC_ID,
          consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: true },
        })
      );
      fake.clinicPatients[CLINIC_ID] = [patientId];

      // Add home monitoring data to fake repository
      const fakeHome = fake.ports.homeMonitoring as FakeHomeMonitoringRepository;
      fakeHome.ringDays[patientId] = [
        { date: "2026-11-16", ringActive: true },
        { date: "2026-11-17", ringActive: true },
        { date: "2026-11-18", ringActive: true },
        { date: "2026-11-19", ringActive: true },
        { date: "2026-11-20", ringActive: true },
        { date: "2026-11-21", ringActive: true },
        { date: "2026-11-22", ringActive: false },
      ];
      fakeHome.rhythmWindows[patientId] = [
        { windowEndDate: "2026-11-22", sriZScore: -1.8, raZScore: -0.2 },
      ];
      fakeHome.cameraReadings[patientId] = [
        { date: "2026-11-18", source: "camera_expressivity" },
      ];

      await fake.ports.warnings.saveWarning({
        patientId,
        kind: "silence",
        since: "2026-11-16",
        version: 1,
        causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
        raisedAt: "2026-11-19T18:00:00.000Z",
      });

      const flags = await listClinicFlags(STAFF_ACTOR, {
        ports: fake.ports,
        clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
        resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
      });

      expect(flags).toHaveLength(1);
      const facts = flags[0].facts;
      expect(facts?.supportingLines).toBeDefined();
      expect(facts?.supportingLines).toHaveLength(3);
      expect(facts?.supportingLines?.[0]).toBe("ring worn on 6 of 7 days during the missed rounds");
      expect(facts?.supportingLines?.[1]).toBe("sleep regularity shifted against earlier weeks");
      expect(facts?.supportingLines?.[2]).toBe("camera check done during this time");
    });

    it("gives NO supporting lines when measuring consent is off", async () => {
      const patientId = "patient-no-consent-methods";
      await fake.ports.patients.savePatient(
        patientRecord({
          patientId,
          clinicId: CLINIC_ID,
          consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
        })
      );
      fake.clinicPatients[CLINIC_ID] = [patientId];

      const fakeHome = fake.ports.homeMonitoring as FakeHomeMonitoringRepository;
      fakeHome.ringDays[patientId] = [
        { date: "2026-11-16", ringActive: true },
        { date: "2026-11-17", ringActive: true },
      ];
      fakeHome.rhythmWindows[patientId] = [
        { windowEndDate: "2026-11-22", sriZScore: -2.0 },
      ];
      fakeHome.cameraReadings[patientId] = [
        { date: "2026-11-18", source: "camera_expressivity" },
      ];

      await fake.ports.warnings.saveWarning({
        patientId,
        kind: "silence",
        since: "2026-11-16",
        version: 1,
        causedBy: { type: "round", roundNumber: 2, date: "2026-11-19" },
        raisedAt: "2026-11-19T18:00:00.000Z",
      });

      const flags = await listClinicFlags(STAFF_ACTOR, {
        ports: fake.ports,
        clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
        resolveDevicePatient: async () => ({ patientId, clinicId: CLINIC_ID }),
      });

      expect(flags).toHaveLength(1);
      expect(flags[0].facts?.supportingLines).toEqual([]);
    });

    it("never shows monitoring data of another patient", async () => {
      const patientA = "patient-isolation-a";
      const patientB = "patient-isolation-b";
      await fake.ports.patients.savePatient(
        patientRecord({
          patientId: patientA,
          clinicId: CLINIC_ID,
          consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: true },
        })
      );
      await fake.ports.patients.savePatient(
        patientRecord({
          patientId: patientB,
          clinicId: CLINIC_ID,
          consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: true },
        })
      );
      fake.clinicPatients[CLINIC_ID] = [patientA];

      // Add monitoring data only for patientB
      const fakeHome = fake.ports.homeMonitoring as FakeHomeMonitoringRepository;
      fakeHome.ringDays[patientB] = [{ date: "2026-11-16", ringActive: true }];
      fakeHome.rhythmWindows[patientB] = [{ windowEndDate: "2026-11-16", sriZScore: -2.5 }];
      fakeHome.cameraReadings[patientB] = [{ date: "2026-11-16", source: "arduino_uno_q" }];

      await fake.ports.warnings.saveWarning({
        patientId: patientA,
        kind: "silence",
        since: "2026-11-16",
        version: 1,
        causedBy: { type: "round", roundNumber: 1, date: "2026-11-16" },
        raisedAt: "2026-11-16T18:00:00.000Z",
      });

      const flags = await listClinicFlags(STAFF_ACTOR, {
        ports: fake.ports,
        clinicPatientIds: async (c) => fake.clinicPatients[c] ?? [],
        resolveDevicePatient: async () => ({ patientId: patientA, clinicId: CLINIC_ID }),
      });

      expect(flags).toHaveLength(1);
      // Patient A has no monitoring data of their own, so supporting lines are empty
      expect(flags[0].facts?.supportingLines).toEqual([]);
    });

    it("rule output is identical with and without monitoring data", async () => {
      const patientId = "patient-rule-invariance";
      await fake.ports.patients.savePatient(
        patientRecord({
          patientId,
          clinicId: CLINIC_ID,
          consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: true },
        })
      );

      // Add 2 low check-ins
      await fake.ports.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: "2026-11-16",
        status: "answered",
        mood: 0,
        interest: 0,
      });
      await fake.ports.rounds.saveRound({
        patientId,
        roundNumber: 2,
        localDate: "2026-11-19",
        status: "answered",
        mood: 0,
        interest: 0,
      });

      // Run evaluatePatient without monitoring data
      const eval1 = await evaluatePatient({ kind: "system" }, { patientId }, fake.ports);
      expect(eval1.ok).toBe(true);
      const warningsWithoutMonitoring = await fake.ports.warnings.getWarnings(patientId);

      // Add rich monitoring data
      const fakeHome = fake.ports.homeMonitoring as FakeHomeMonitoringRepository;
      fakeHome.ringDays[patientId] = [
        { date: "2026-11-16", ringActive: true },
        { date: "2026-11-17", ringActive: true },
      ];
      fakeHome.rhythmWindows[patientId] = [{ windowEndDate: "2026-11-19", sriZScore: -3.0 }];
      fakeHome.cameraReadings[patientId] = [{ date: "2026-11-16", source: "arduino_uno_q" }];

      // Reset warnings to test evaluation again with monitoring data present
      // evaluatePatient only reads rounds, phq9, gad7, calls, not monitoring
      const eval2 = await evaluatePatient({ kind: "system" }, { patientId }, fake.ports);
      expect(eval2.ok).toBe(true);
      const warningsWithMonitoring = await fake.ports.warnings.getWarnings(patientId);

      expect(warningsWithMonitoring).toEqual(warningsWithoutMonitoring);
    });
  });
});
