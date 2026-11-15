import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { PatientActor, StaffActor, SystemActor } from "@/domain/access";
import { getPrisma } from "@/lib/db";
import {
  closeElapsedRounds,
  evaluatePatient,
  getCheckInState,
  submitNotToday,
  submitPhq9Answer,
  submitTaps,
  type PatientRecord,
  type Ports,
} from "@/usecases";
import { FakeClock } from "@/usecases/testing";
import { createPrismaPorts } from "../index";

const CLINIC_CODE = "ports-dbtest-clinic";
const ROUND_1_OPEN = "2026-11-16T16:00:00.000Z";

describe("Use cases on the PostgreSQL ports (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  const systemActor: SystemActor = { kind: "system" };

  beforeAll(async () => {
    prisma = getPrisma();
    const clinic = await prisma.clinic.create({ data: { code: CLINIC_CODE, name: "Ports test clinic" } });
    clinicId = clinic.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { clinicId } });
    await prisma.accessLog.deleteMany({ where: { targetPatientId: { startsWith: "ports-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: CLINIC_CODE } });
    await prisma.$disconnect();
  });

  function recordFor(patientId: string): PatientRecord {
    return {
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
  }

  async function enrol(name: string): Promise<{
    ports: Ports;
    clock: FakeClock;
    patientId: string;
    actor: PatientActor;
  }> {
    const patientId = `ports-dbtest-${name}`;
    const clock = new FakeClock(ROUND_1_OPEN);
    const ports: Ports = { ...createPrismaPorts(prisma), clock };
    await ports.patients.savePatient(recordFor(patientId));
    return { ports, clock, patientId, actor: { kind: "patient", patientId, clinicId } };
  }

  async function answerPhq9Items(
    actor: PatientActor,
    ports: Ports,
    itemIds: readonly number[],
    value: number
  ): Promise<void> {
    for (const itemId of itemIds) {
      const res = await submitPhq9Answer(
        actor,
        { patientId: actor.patientId, itemId: String(itemId), value },
        ports
      );
      expect(res.ok).toBe(true);
    }
  }

  it("gives every storage port, a unit of work and a clock that tells the present time", () => {
    const ports = createPrismaPorts(prisma);
    const before = Date.now();
    const now = new Date(ports.clock.now()).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
    expect(ports.clock.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    for (const key of [
      "patients",
      "rounds",
      "phq9",
      "gad7",
      "calls",
      "warnings",
      "smallDips",
      "crisis",
      "baselineNotWell",
      "accessLog",
      "extraAnswers",
      "unitOfWork",
    ] as const) {
      expect(ports[key]).toBeDefined();
    }
  });

  it("stores the demo story: four weeks well, one small dip, recovery, then two silent rounds raise one warning", async () => {
    const { ports, clock, patientId, actor } = await enrol("story");

    const first = await getCheckInState(actor, { patientId }, ports);
    expect(first.ok && first.value.openRound?.number).toBe(1);
    expect(first.ok && first.value.isPhq9Due).toBe(true);

    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await answerPhq9Items(actor, ports, [1, 2, 3, 4, 5, 6, 7, 8, 9], 0);
    await evaluatePatient(systemActor, { patientId }, ports);

    const wellRounds = [
      { t: "2026-11-19T16:00:00.000Z", isPhq9: false },
      { t: "2026-11-23T16:00:00.000Z", isPhq9: false },
      { t: "2026-11-26T16:00:00.000Z", isPhq9: false },
      { t: "2026-11-30T16:00:00.000Z", isPhq9: true },
      { t: "2026-12-03T16:00:00.000Z", isPhq9: false },
      { t: "2026-12-07T16:00:00.000Z", isPhq9: false },
      { t: "2026-12-10T16:00:00.000Z", isPhq9: false },
    ];
    for (const round of wellRounds) {
      clock.setNow(round.t);
      expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
      if (round.isPhq9) await answerPhq9Items(actor, ports, [1, 2, 3, 4, 5, 6, 7, 8, 9], 0);
      await evaluatePatient(systemActor, { patientId }, ports);
    }
    expect(await ports.rounds.getRounds(patientId)).toHaveLength(8);
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(0);

    clock.setNow("2026-12-14T16:00:00.000Z");
    expect((await submitTaps(actor, { patientId, mood: 1, interest: 1 }, ports)).ok).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);
    const afterDip = await getCheckInState(actor, { patientId }, ports);
    expect(afterDip.ok && afterDip.value.hasSuggestionWaiting).toBe(true);
    const smallDips = await ports.smallDips.getSmallDips(patientId);
    expect(smallDips).toHaveLength(1);
    expect(smallDips[0].roundNumber).toBe(9);

    clock.setNow("2026-12-17T16:00:00.000Z");
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);

    clock.setNow("2026-12-24T17:00:00.000Z");
    expect((await closeElapsedRounds(systemActor, { patientId }, ports)).ok).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    clock.setNow("2026-12-28T17:00:00.000Z");
    expect((await closeElapsedRounds(systemActor, { patientId }, ports)).ok).toBe(true);
    await evaluatePatient(systemActor, { patientId }, ports);
    await evaluatePatient(systemActor, { patientId }, ports);

    const round11 = await ports.rounds.getRound(patientId, 11);
    const round12 = await ports.rounds.getRound(patientId, 12);
    expect(round11?.status).toBe("missed");
    expect(round12?.status).toBe("missed");
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe("silence");
    expect(warnings[0].since).toBe(round11?.localDate);
    expect(await ports.smallDips.getSmallDips(patientId)).toHaveLength(1);

    const flags = await prisma.clinicFlag.findMany({ where: { participantId: patientId } });
    expect(flags).toHaveLength(1);
    expect(flags[0].clinicId).toBe(clinicId);
    expect(flags[0].primaryArea).toBe("check_in");
  }, 60_000);

  it("raises the GAD-7 warning from a stored GAD-7 for a patient who has the GAD-7", async () => {
    const { ports, patientId, actor } = await enrol("gad7");
    await ports.patients.savePatient({ ...recordFor(patientId), questionnaires: ["phq9", "gad7"] });
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await ports.gad7!.saveGad7({
      patientId,
      roundNumber: 1,
      answers: ["1", "2", "3", "4", "5", "6", "7"].map((id) => ({ id, value: 3 })),
      total: 21,
      completedAt: "2026-11-16T16:30:00.000Z",
      date: "2026-11-16",
    });

    const evaluated = await evaluatePatient(systemActor, { patientId }, ports);

    expect(evaluated.ok).toBe(true);
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings.map((w) => w.kind)).toEqual(["gad7"]);
    expect(warnings[0].causedBy).toEqual({ type: "gad7", date: "2026-11-16" });
  });

  it("stores a self-harm answer with exactly one crisis event, and the later rule run raises the PHQ-9 warning and the baseline notice", async () => {
    const { ports, patientId, actor } = await enrol("crisis");
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await answerPhq9Items(actor, ports, [1, 2, 3, 4, 5, 6, 7, 8], 1);

    const last = await submitPhq9Answer(actor, { patientId, itemId: "9", value: 2 }, ports);
    expect(last.ok && last.value.showCrisisPath).toBe(true);
    expect(last.ok && last.value.progress).toBe("completed");

    const events = await ports.crisis.getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ roundNumber: 1, itemId: "9", value: 2, occurredAt: ROUND_1_OPEN });
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(0);

    const evaluated = await evaluatePatient(systemActor, { patientId }, ports);
    expect(evaluated.ok && evaluated.value.storedEffectsCount).toBe(2);
    const warnings = await ports.warnings.getWarnings(patientId);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe("phq9");
    expect(warnings[0].causedBy).toEqual({ type: "phq9", date: "2026-11-16" });
    expect(await ports.baselineNotWell.getNotices(patientId)).toHaveLength(1);
  });

  it("keeps nothing of a unit of work that fails, and the error still carries the crisis signal", async () => {
    const { ports, patientId, actor } = await enrol("rollback");
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);

    const failing: Ports = {
      ...ports,
      crisis: {
        ...ports.crisis,
        saveCrisisEvent: async () => {
          throw new Error("crisis storage is down");
        },
      },
    };
    const res = await submitPhq9Answer(actor, { patientId, itemId: "9", value: 3 }, failing);

    expect(res.ok).toBe(false);
    expect(!res.ok && res.showCrisisPath).toBe(true);
    expect(!res.ok && res.error).toBe("crisis storage is down");
    expect(await ports.phq9.getPhq9s(patientId)).toHaveLength(0);
    expect(await ports.crisis.getCrisisEvents(patientId)).toHaveLength(0);
  });

  it("lets only one of two submissions of the last PHQ-9 item at the same moment complete the questionnaire", async () => {
    const { ports, patientId, actor } = await enrol("race-phq9");
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await answerPhq9Items(actor, ports, [1, 2, 3, 4, 5, 6, 7, 8], 0);

    const results = await Promise.all([
      submitPhq9Answer(actor, { patientId, itemId: "9", value: 0 }, ports),
      submitPhq9Answer(actor, { patientId, itemId: "9", value: 0 }, ports),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    expect(refused && !refused.ok && refused.error).toBe(
      "Cannot submit PHQ-9 answer: PHQ-9 is already completed"
    );
    const stored = await ports.phq9.getPhq9s(patientId);
    expect(stored).toHaveLength(1);
    expect(stored[0].progress).toBe("completed");
  });

  it("stores each effect once when two rule runs for one patient start at the same moment", async () => {
    const { ports, patientId, actor } = await enrol("race-rule");
    expect((await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports)).ok).toBe(true);
    await answerPhq9Items(actor, ports, [1, 2, 3, 4, 5, 6, 7, 8, 9], 2);

    const runs = await Promise.all([
      evaluatePatient(systemActor, { patientId }, ports),
      evaluatePatient(systemActor, { patientId }, ports),
    ]);

    expect(runs.every((r) => r.ok)).toBe(true);
    const storedCounts = runs.map((r) => (r.ok ? r.value.storedEffectsCount : -1)).sort();
    expect(storedCounts).toEqual([0, 2]);
    expect(await ports.warnings.getWarnings(patientId)).toHaveLength(1);
    expect(await ports.baselineNotWell.getNotices(patientId)).toHaveLength(1);
  });

  it("stores one answer when the same taps arrive twice at the same moment, and a later Not today does not replace it", async () => {
    const { ports, patientId, actor } = await enrol("race-taps");

    const results = await Promise.all([
      submitTaps(actor, { patientId, mood: 2, interest: 4 }, ports),
      submitTaps(actor, { patientId, mood: 2, interest: 4 }, ports),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => (r.ok ? r.value.ruleRunNeeded : null)).sort()).toEqual([false, true]);

    expect((await submitNotToday(actor, { patientId }, ports)).ok).toBe(true);
    const rounds = await ports.rounds.getRounds(patientId);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ status: "answered", mood: 2, interest: 4 });
  });

  it("keeps the log entry of a refused nurse, and stores no answer", async () => {
    const { ports, patientId } = await enrol("refusal");
    const nurse: StaffActor = { kind: "staff", staffId: "ports-dbtest-nurse", clinicId, role: "nurse" };

    const res = await submitTaps(nurse, { patientId, mood: 3, interest: 3 }, ports);

    expect(res.ok).toBe(false);
    const logs = await ports.accessLog.getLogs(patientId);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actor: nurse,
      allowed: false,
      reason: "clinic_staff_forbidden_clinical_data",
    });
    expect(await ports.rounds.getRounds(patientId)).toHaveLength(0);
  });

  it("refuses a patient who has switched taking part off, and stores no answer", async () => {
    const { ports, patientId, actor } = await enrol("consent-off");
    await ports.patients.savePatient({
      ...recordFor(patientId),
      consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false },
    });

    const res = await submitTaps(actor, { patientId, mood: 3, interest: 3 }, ports);

    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("consent_required");
    expect(await ports.rounds.getRounds(patientId)).toHaveLength(0);
  });

  it("closes many elapsed rounds in one unit of work and sends one reminder for the open round", async () => {
    const { ports, clock, patientId } = await enrol("many-rounds");
    clock.setNow("2027-11-19T08:00:00.000Z");

    const res = await closeElapsedRounds(systemActor, { patientId }, ports);

    expect(res.ok).toBe(true);
    const rounds = await ports.rounds.getRounds(patientId);
    expect(rounds.length).toBeGreaterThan(100);
    expect(res.ok && res.value.closedRoundsCount).toBe(rounds.length - 1);
    expect(rounds.slice(0, -1).every((r) => r.status === "missed")).toBe(true);
    const open = rounds[rounds.length - 1];
    expect(open.status).toBeNull();
    expect(open.reminderSentAt).toBe("2027-11-19T08:00:00.000Z");
  }, 60_000);
});
