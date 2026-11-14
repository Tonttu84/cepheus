import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { PatientRecord, Ports } from "@/usecases/ports";
import { InMemoryAnswerStore } from "../answer-store";
import { createPrismaPorts } from "../index";

describe("The simulated mark on rows written through the ports (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let ports: Ports;

  const recordFor = (patientId: string): PatientRecord => ({
    patientId,
    clinicId,
    schedule: { weekdays: [1, 4], timeOfDay: "18:00", timeZone: "Europe/Helsinki", enrolmentDate: "2026-11-16" },
    consent: { taking_part: true, methods: { ring: false, camera: false }, rule_check: true },
  });

  const createParticipant = (id: string, isSimulated: boolean) =>
    prisma.participant.create({
      data: {
        id,
        clinicId,
        label: "simulated-dbtest",
        source: isSimulated ? "synthetic" : "live",
        isSimulated,
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
      },
    });

  async function writeOneOfEach(patientId: string): Promise<void> {
    const cause = { type: "round" as const, roundNumber: 1, date: "2026-11-16" };
    await ports.rounds.saveRound({ patientId, roundNumber: 1, localDate: "2026-11-16", status: "answered", mood: 3, interest: 3 });
    await ports.phq9.savePhq9({ patientId, roundNumber: 1, progress: "unfinished", answers: [{ id: "1", value: 1 }] });
    await ports.gad7!.saveGad7({ patientId, roundNumber: 1, answers: [{ id: "1", value: 1 }] });
    await ports.calls.saveCall({ patientId, date: "2026-11-16" });
    await ports.warnings.saveWarning({
      patientId,
      kind: "silence",
      since: "2026-11-16",
      version: 1,
      causedBy: cause,
      raisedAt: "2026-11-16T17:00:00.000Z",
    });
    await ports.smallDips.saveSmallDip({
      patientId,
      roundNumber: 1,
      date: "2026-11-16",
      version: 1,
      causedBy: cause,
      shownAt: "2026-11-16T17:00:00.000Z",
    });
    await ports.crisis.saveCrisisEvent({
      patientId,
      roundNumber: 1,
      itemId: "9",
      value: 1,
      occurredAt: "2026-11-16T17:00:00.000Z",
    });
    await ports.baselineNotWell.saveNotice({
      patientId,
      version: 1,
      causedBy: { type: "phq9", date: "2026-11-16" },
      notifiedAt: "2026-11-16T17:00:00.000Z",
    });
    await ports.extraAnswers.saveExtraAnswer({
      patientId,
      roundNumber: 1,
      itemId: "extra-1",
      value: 2,
      answeredAt: "2026-11-16T17:00:00.000Z",
    });
  }

  async function marksOf(participantId: string) {
    const where = { where: { participantId }, select: { isSimulated: true } };
    const tables = {
      checkInRound: await prisma.checkInRound.findMany(where),
      phq9Assessment: await prisma.phq9Assessment.findMany(where),
      gad7Assessment: await prisma.gad7Assessment.findMany(where),
      nurseCallRecord: await prisma.nurseCallRecord.findMany(where),
      clinicFlag: await prisma.clinicFlag.findMany(where),
      smallDip: await prisma.smallDip.findMany(where),
      crisisEvent: await prisma.crisisEvent.findMany(where),
      baselineNotice: await prisma.baselineNotice.findMany(where),
      extraAnswer: await prisma.extraAnswer.findMany(where),
    };
    return Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map((r) => r.isSimulated)]));
  }

  const everyTable = (mark: boolean) =>
    Object.fromEntries(
      [
        "checkInRound",
        "phq9Assessment",
        "gad7Assessment",
        "nurseCallRecord",
        "clinicFlag",
        "smallDip",
        "crisisEvent",
        "baselineNotice",
        "extraAnswer",
      ].map((name) => [name, [mark]])
    );

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "simulated-dbtest-clinic", name: "Simulated" } })).id;
    ports = createPrismaPorts(prisma, { storeItemAnswers: false, answerStore: new InMemoryAnswerStore() });
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { id: { startsWith: "simulated-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "simulated-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("copies a simulated patient's mark onto every row the repositories create", async () => {
    await createParticipant("simulated-dbtest-sim", true);
    await writeOneOfEach("simulated-dbtest-sim");
    expect(await marksOf("simulated-dbtest-sim")).toEqual(everyTable(true));
  });

  it("marks the rows of a live patient as not simulated", async () => {
    await createParticipant("simulated-dbtest-live", false);
    await writeOneOfEach("simulated-dbtest-live");
    expect(await marksOf("simulated-dbtest-live")).toEqual(everyTable(false));
  });

  it("keeps a simulated patient simulated when the patient is saved again", async () => {
    await createParticipant("simulated-dbtest-resave", true);
    await ports.patients.savePatient(recordFor("simulated-dbtest-resave"));
    const row = await prisma.participant.findUniqueOrThrow({ where: { id: "simulated-dbtest-resave" } });
    expect(row.isSimulated).toBe(true);
  });

  it("creates a new patient as not simulated, since the patient record cannot say otherwise", async () => {
    await ports.patients.savePatient(recordFor("simulated-dbtest-new"));
    const row = await prisma.participant.findUniqueOrThrow({ where: { id: "simulated-dbtest-new" } });
    expect(row.isSimulated).toBe(false);
  });
});
