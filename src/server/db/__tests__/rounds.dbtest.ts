import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredRound } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createRoundRepository } from "../rounds";

describe("Round repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherId: string;
  let unscheduledId: string;
  const repo = () => createRoundRepository(createDbContext(prisma));

  const participant = (label: string, schedule: boolean) =>
    prisma.participant.create({
      data: {
        clinicId,
        label,
        source: "live",
        timeZone: "Europe/Helsinki",
        ...(schedule
          ? { enrolmentDate: "2026-11-16", scheduleDaysJson: "[1,4]", scheduleTime: "18:00" }
          : {}),
      },
    });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "rounds-dbtest-clinic", name: "Rounds" } })).id;
    patientId = (await participant("rounds-dbtest-main", true)).id;
    otherId = (await participant("rounds-dbtest-other", true)).id;
    unscheduledId = (await participant("rounds-dbtest-none", false)).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "rounds-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "rounds-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  const answered = (roundNumber: number, localDate: string): StoredRound => ({
    patientId,
    roundNumber,
    localDate,
    status: "answered",
    mood: 3,
    interest: 2,
    reminderSentAt: "2026-11-16T16:10:00.000Z",
    answeredAt: "2026-11-16T16:20:00.000Z",
  });

  it("reads an answered round back equal to what was saved", async () => {
    const round = answered(1, "2026-11-16");
    await repo().saveRound(round);
    expect(await repo().getRound(patientId, 1)).toEqual(round);
    expect(await repo().getRounds(patientId)).toEqual([round]);
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("keeps null scores and the own status of a Not today and a missed round", async () => {
    const base = { patientId, reminderSentAt: null, answeredAt: null, mood: null, interest: null };
    const notToday: StoredRound = { ...base, roundNumber: 1, localDate: "2026-11-16", status: "not_today" };
    const missed: StoredRound = { ...base, roundNumber: 2, localDate: "2026-11-19", status: "missed" };
    await repo().saveRound(notToday);
    await repo().saveRound(missed);
    expect(await repo().getRounds(patientId)).toEqual([notToday, missed]);
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("stores a round with only a reminder as open and reads it back with no status", async () => {
    const round: StoredRound = {
      patientId,
      roundNumber: 1,
      localDate: "2026-11-16",
      status: null,
      mood: null,
      interest: null,
      reminderSentAt: "2026-11-16T16:10:00.000Z",
      answeredAt: null,
    };
    await repo().saveRound(round);
    const row = await prisma.checkInRound.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.status).toBe("open");
    expect(await repo().getRound(patientId, 1)).toEqual(round);
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("replaces a saved round and makes no second row", async () => {
    await repo().saveRound({ patientId, roundNumber: 1, localDate: "2026-11-16", status: "not_today" });
    const round = answered(1, "2026-11-16");
    await repo().saveRound(round);
    expect(await prisma.checkInRound.count({ where: { participantId: patientId } })).toBe(1);
    expect(await repo().getRound(patientId, 1)).toEqual(round);
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("stores the clinic, the local date, the day index, the week and the planned time", async () => {
    await repo().saveRound(answered(1, "2026-11-16"));
    const row = await prisma.checkInRound.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.clinicId).toBe(clinicId);
    expect(row.date).toBe("2026-11-16");
    expect(row.dayIndex).toBe(1);
    expect(row.weekNumber).toBe(1);
    expect(row.scheduledAt.toISOString()).toBe("2026-11-16T16:00:00.000Z");
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("gives the rounds in round order and only those of the asked patient", async () => {
    await repo().saveRound(answered(2, "2026-11-19"));
    await repo().saveRound(answered(1, "2026-11-16"));
    await repo().saveRound({ ...answered(1, "2026-11-16"), patientId: otherId });
    const rounds = await repo().getRounds(patientId);
    expect(rounds.map((r) => r.roundNumber)).toEqual([1, 2]);
    expect(rounds.every((r) => r.patientId === patientId)).toBe(true);
    await prisma.checkInRound.deleteMany({ where: { participantId: { in: [patientId, otherId] } } });
  });

  it("gives null for a round that is not stored", async () => {
    expect(await repo().getRound(patientId, 7)).toBeNull();
  });

  it("reads a row with the status completed that other code wrote as answered", async () => {
    await prisma.checkInRound.create({
      data: {
        participantId: patientId,
        clinicId,
        scheduledAt: new Date("2026-11-16T16:00:00.000Z"),
        date: "2026-11-16",
        dayIndex: 1,
        weekNumber: 1,
        roundNumber: 1,
        status: "completed",
        moodScore: 4,
        interestScore: 1,
        respondedAt: new Date("2026-11-16T16:30:00.000Z"),
      },
    });
    expect(await repo().getRound(patientId, 1)).toEqual({
      patientId,
      roundNumber: 1,
      localDate: "2026-11-16",
      status: "answered",
      mood: 4,
      interest: 1,
      reminderSentAt: null,
      answeredAt: "2026-11-16T16:30:00.000Z",
    });
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("throws when a stored status is not known", async () => {
    await prisma.checkInRound.create({
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
    await expect(repo().getRound(patientId, 1)).rejects.toThrow("Unknown round status: strange");
    await expect(repo().getRounds(patientId)).rejects.toThrow("Unknown round status: strange");
    await prisma.checkInRound.deleteMany({ where: { participantId: patientId } });
  });

  it("throws when the patient is not known or has no schedule", async () => {
    await expect(repo().saveRound({ ...answered(1, "2026-11-16"), patientId: "rounds-dbtest-nobody" })).rejects.toThrow(
      "Patient not found"
    );
    await expect(repo().saveRound({ ...answered(1, "2026-11-16"), patientId: unscheduledId })).rejects.toThrow(
      "Patient has no schedule"
    );
  });
});
