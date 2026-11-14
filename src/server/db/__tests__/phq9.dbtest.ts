import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredPhq9 } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createPhq9Repository } from "../phq9";

describe("PHQ-9 repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherId: string;
  const repo = () => createPhq9Repository(createDbContext(prisma, { storeItemAnswers: true }));
  const clear = () => prisma.phq9Assessment.deleteMany({ where: { participantId: { in: [patientId, otherId] } } });

  const participant = (label: string) =>
    prisma.participant.create({
      data: {
        clinicId,
        label,
        source: "live",
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
      },
    });

  const unfinished = (roundNumber = 1): StoredPhq9 => ({
    patientId,
    roundNumber,
    progress: "unfinished",
    answers: [
      { id: "1", value: 1 },
      { id: "2", value: 0 },
      { id: "3", value: 3 },
    ],
    total: null,
    completedAt: null,
    completedInRoundNumber: null,
    date: null,
  });

  const completed = (roundNumber = 1, completedIn = 1): StoredPhq9 => ({
    patientId,
    roundNumber,
    progress: "completed",
    answers: ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((id) => ({ id, value: 1 })),
    total: 9,
    completedAt: "2026-11-16T16:40:00.000Z",
    completedInRoundNumber: completedIn,
    date: "2026-11-16",
  });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "phq9-dbtest-clinic", name: "Phq9" } })).id;
    patientId = (await participant("phq9-dbtest-main")).id;
    otherId = (await participant("phq9-dbtest-other")).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "phq9-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "phq9-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("reads an unfinished questionnaire back equal to what was saved", async () => {
    await repo().savePhq9(unfinished());
    expect(await repo().getPhq9s(patientId)).toEqual([unfinished()]);
    await clear();
  });

  it("stores an unfinished questionnaire as in progress with the date, the planned time and empty items", async () => {
    await repo().savePhq9(unfinished());
    const row = await prisma.phq9Assessment.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.status).toBe("in_progress");
    expect(row.clinicId).toBe(clinicId);
    expect(row.date).toBe("2026-11-16");
    expect(row.scheduledAt.toISOString()).toBe("2026-11-16T16:00:00.000Z");
    expect([row.item1Interest, row.item2Mood, row.item3Sleep]).toEqual([1, 0, 3]);
    expect([
      row.item4Energy,
      row.item5Appetite,
      row.item6SelfWorth,
      row.item7Concentration,
      row.item8Psychomotor,
      row.item9SelfHarm,
    ]).toEqual([null, null, null, null, null, null]);
    await clear();
  });

  it("replaces the row when the questionnaire is saved again with nine answers", async () => {
    await repo().savePhq9(unfinished());
    await repo().savePhq9(completed());
    expect(await prisma.phq9Assessment.count({ where: { participantId: patientId } })).toBe(1);
    expect(await repo().getPhq9s(patientId)).toEqual([completed()]);
    await clear();
  });

  it("keeps the round of the questionnaire and the round where it was completed apart", async () => {
    await repo().savePhq9(completed(1, 3));
    const [stored] = await repo().getPhq9s(patientId);
    expect(stored.roundNumber).toBe(1);
    expect(stored.completedInRoundNumber).toBe(3);
    await clear();
  });

  it("gives the unfinished questionnaire as the current one when an older completed one exists", async () => {
    await repo().savePhq9(completed(1));
    await repo().savePhq9(unfinished(2));
    expect((await repo().getCurrentPhq9(patientId))?.roundNumber).toBe(2);
    await clear();
  });

  it("gives the newest questionnaire as the current one when all are completed", async () => {
    await repo().savePhq9(completed(2));
    await repo().savePhq9(completed(1));
    expect((await repo().getCurrentPhq9(patientId))?.roundNumber).toBe(2);
    await clear();
  });

  it("gives null as the current questionnaire when none is stored", async () => {
    expect(await repo().getCurrentPhq9(patientId)).toBeNull();
  });

  it("reads a missed row that other code wrote as not started with no answers and no date", async () => {
    await prisma.phq9Assessment.create({
      data: {
        participantId: patientId,
        clinicId,
        scheduledAt: new Date("2026-11-16T16:00:00.000Z"),
        date: "2026-11-16",
        dayIndex: 1,
        weekNumber: 1,
        roundNumber: 1,
        status: "missed",
      },
    });
    expect(await repo().getPhq9s(patientId)).toEqual([
      {
        patientId,
        roundNumber: 1,
        progress: "not_started",
        answers: [],
        total: null,
        completedAt: null,
        completedInRoundNumber: null,
        date: null,
      },
    ]);
    await clear();
  });

  it("throws when a stored status is not known", async () => {
    await prisma.phq9Assessment.create({
      data: {
        participantId: patientId,
        scheduledAt: new Date("2026-11-16T16:00:00.000Z"),
        date: "2026-11-16",
        dayIndex: 1,
        weekNumber: 1,
        roundNumber: 1,
        status: "strange",
      },
    });
    await expect(repo().getPhq9s(patientId)).rejects.toThrow("Unknown PHQ-9 status: strange");
    await clear();
  });

  it("gives the questionnaires in round order and only those of the asked patient", async () => {
    await repo().savePhq9(unfinished(2));
    await repo().savePhq9(unfinished(1));
    await repo().savePhq9({ ...unfinished(1), patientId: otherId });
    const stored = await repo().getPhq9s(patientId);
    expect(stored.map((p) => p.roundNumber)).toEqual([1, 2]);
    expect(stored.every((p) => p.patientId === patientId)).toBe(true);
    await clear();
  });

  it("throws when the patient is not known", async () => {
    await expect(repo().savePhq9({ ...unfinished(), patientId: "phq9-dbtest-nobody" })).rejects.toThrow(
      "Patient not found"
    );
  });
});
