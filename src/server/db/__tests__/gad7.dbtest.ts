import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredGad7 } from "@/usecases/ports";
import { InMemoryAnswerStore } from "../answer-store";
import { createDbContext, type DbContextOptions } from "../context";
import { createGad7Repository } from "../gad7";
import { GAD7_COLUMNS } from "../gad7-columns";

describe("GAD-7 repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherId: string;

  const repo = (options: DbContextOptions) => createGad7Repository(createDbContext(prisma, options));
  const clear = () => prisma.gad7Assessment.deleteMany({ where: { participantId: { in: [patientId, otherId] } } });
  const itemsOfRow = async (roundNumber = 1) => {
    const row = await prisma.gad7Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientId, roundNumber } },
    });
    return { row, items: GAD7_COLUMNS.map((column) => row[column]) };
  };

  const participant = (label: string, isSimulated = false) =>
    prisma.participant.create({
      data: {
        clinicId,
        label,
        source: "live",
        isSimulated,
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
      },
    });

  const unfinished = (roundNumber = 1): StoredGad7 => ({
    patientId,
    roundNumber,
    answers: [
      { id: "1", value: 2 },
      { id: "4", value: 1 },
    ],
    total: null,
    completedAt: null,
    date: null,
  });

  const completed = (roundNumber = 1): StoredGad7 => ({
    patientId,
    roundNumber,
    answers: ["1", "2", "3", "4", "5", "6", "7"].map((id) => ({ id, value: 2 })),
    total: 14,
    completedAt: "2026-11-16T16:40:00.000Z",
    date: "2026-11-16",
  });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "gad7-dbtest-clinic", name: "Gad7" } })).id;
    patientId = (await participant("gad7-dbtest-main")).id;
    otherId = (await participant("gad7-dbtest-other", true)).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "gad7-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "gad7-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("with item answers off, writes seven empty item columns and reads the answers back from memory", async () => {
    const memory = new InMemoryAnswerStore();
    await repo({ answerStore: memory }).saveGad7(unfinished());

    const { row, items } = await itemsOfRow();
    expect(items).toEqual(Array(7).fill(null));
    expect(row.status).toBe("in_progress");
    expect(row.clinicId).toBe(clinicId);
    expect(row.date).toBe("2026-11-16");
    expect(row.scheduledAt.toISOString()).toBe("2026-11-16T16:00:00.000Z");
    expect(await repo({ answerStore: memory }).getGad7s(patientId)).toEqual([unfinished()]);
    expect(await repo({ answerStore: new InMemoryAnswerStore() }).getGad7s(patientId)).toEqual([
      { ...unfinished(), answers: [] },
    ]);
    await clear();
  });

  it("with item answers off, keeps the total and date of a completed one, no items, and forgets its answers", async () => {
    const memory = new InMemoryAnswerStore();
    await repo({ answerStore: memory }).saveGad7(unfinished());
    await repo({ answerStore: memory }).saveGad7(completed());

    const { row, items } = await itemsOfRow();
    expect(row.status).toBe("completed");
    expect(row.totalScore).toBe(14);
    expect(items).toEqual(Array(7).fill(null));
    expect(memory.size()).toBe(0);
    expect(await repo({ answerStore: memory }).getGad7s(patientId)).toEqual([{ ...completed(), answers: [] }]);
    await clear();
  });

  it("with item answers off, keeps neither a row nor answers when the unit of work fails after the save", async () => {
    const memory = new InMemoryAnswerStore();
    const ctx = createDbContext(prisma, { answerStore: memory });
    await expect(
      ctx.unitOfWork.execute(async () => {
        await createGad7Repository(ctx).saveGad7(unfinished());
        throw new Error("fail after the save");
      })
    ).rejects.toThrow("fail after the save");
    expect(await prisma.gad7Assessment.count({ where: { participantId: patientId } })).toBe(0);
    expect(memory.size()).toBe(0);
  });

  it("with item answers on, writes the item columns and reads them back", async () => {
    await repo({ storeItemAnswers: true, answerStore: new InMemoryAnswerStore() }).saveGad7(unfinished());
    const { items } = await itemsOfRow();
    expect(items).toEqual([2, null, null, 1, null, null, null]);
    const fresh = repo({ storeItemAnswers: true, answerStore: new InMemoryAnswerStore() });
    expect(await fresh.getGad7s(patientId)).toEqual([unfinished()]);
    await fresh.saveGad7(completed());
    expect(await fresh.getGad7s(patientId)).toEqual([completed()]);
    await clear();
  });

  it("gives the questionnaires in round order and only those of the asked patient", async () => {
    const r = repo({ answerStore: new InMemoryAnswerStore() });
    await r.saveGad7(completed(2));
    await r.saveGad7(completed(1));
    await r.saveGad7({ ...completed(1), patientId: otherId });
    const stored = await r.getGad7s(patientId);
    expect(stored.map((g) => g.roundNumber)).toEqual([1, 2]);
    expect(stored.every((g) => g.patientId === patientId)).toBe(true);
    await clear();
  });

  it("gives an empty list when no GAD-7 is stored", async () => {
    expect(await repo({}).getGad7s(patientId)).toEqual([]);
  });

  it("throws when the patient is not known", async () => {
    await expect(repo({}).saveGad7({ ...unfinished(), patientId: "gad7-dbtest-nobody" })).rejects.toThrow(
      "Patient not found"
    );
  });

  it("is removed with its patient and keeps its row when the clinic goes", async () => {
    const r = repo({ answerStore: new InMemoryAnswerStore() });
    const clinic = await prisma.clinic.create({ data: { code: "gad7-dbtest-gone", name: "Gone" } });
    const lone = await prisma.participant.create({
      data: {
        clinicId: clinic.id,
        label: "gad7-dbtest-lone",
        source: "live",
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
      },
    });
    await r.saveGad7({ ...completed(), patientId: lone.id });

    await prisma.clinic.delete({ where: { id: clinic.id } });
    const kept = await prisma.gad7Assessment.findFirstOrThrow({ where: { participantId: lone.id } });
    expect(kept.clinicId).toBeNull();

    await prisma.participant.delete({ where: { id: lone.id } });
    expect(await prisma.gad7Assessment.count({ where: { participantId: lone.id } })).toBe(0);
  });
});
