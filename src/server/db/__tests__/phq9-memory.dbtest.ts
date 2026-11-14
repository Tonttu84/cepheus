import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredPhq9 } from "@/usecases/ports";
import { InMemoryAnswerStore } from "../answer-store";
import { createDbContext } from "../context";
import { createPrismaPorts } from "../index";
import { PHQ9_COLUMNS } from "../phq9-columns";
import { createPhq9Repository } from "../phq9";

describe("PHQ-9 item answers kept in memory only (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;

  const threeAnswers: StoredPhq9["answers"] = [
    { id: "1", value: 1 },
    { id: "2", value: 0 },
    { id: "3", value: 3 },
  ];

  const unfinished = (): StoredPhq9 => ({
    patientId,
    roundNumber: 1,
    progress: "unfinished",
    answers: threeAnswers,
    total: null,
    completedAt: null,
    completedInRoundNumber: null,
    date: null,
  });

  const completed = (): StoredPhq9 => ({
    patientId,
    roundNumber: 1,
    progress: "completed",
    answers: ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((id) => ({ id, value: 1 })),
    total: 9,
    completedAt: "2026-11-16T16:40:00.000Z",
    completedInRoundNumber: 1,
    date: "2026-11-16",
  });

  const itemsOfRow = async () => {
    const row = await prisma.phq9Assessment.findFirstOrThrow({ where: { participantId: patientId } });
    return { row, items: PHQ9_COLUMNS.map((column) => row[column]) };
  };

  const clear = () => prisma.phq9Assessment.deleteMany({ where: { participantId: patientId } });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "phq9-memory-dbtest-clinic", name: "Memory" } })).id;
    patientId = (
      await prisma.participant.create({
        data: {
          clinicId,
          label: "phq9-memory-dbtest-main",
          source: "live",
          enrolmentDate: "2026-11-16",
          scheduleDaysJson: "[1,4]",
          scheduleTime: "18:00",
          timeZone: "Europe/Helsinki",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "phq9-memory-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "phq9-memory-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("writes nine empty item columns and reads the three answers back from memory", async () => {
    const memory = new InMemoryAnswerStore();
    const repo = createPhq9Repository(createDbContext(prisma, { storeItemAnswers: false, answerStore: memory }));

    await repo.savePhq9(unfinished());

    const { row, items } = await itemsOfRow();
    expect(row.status).toBe("in_progress");
    expect(items).toEqual(Array(9).fill(null));
    expect(await repo.getPhq9s(patientId)).toEqual([unfinished()]);
    expect(memory.get(patientId, "phq9", 1)).toEqual(threeAnswers);
    await clear();
  });

  it("gives an in-progress questionnaire with no answers after a restart (a fresh memory store)", async () => {
    const first = createPrismaPorts(prisma, { storeItemAnswers: false, answerStore: new InMemoryAnswerStore() });
    await first.phq9.savePhq9(unfinished());

    const restarted = createPrismaPorts(prisma, { storeItemAnswers: false, answerStore: new InMemoryAnswerStore() });

    expect(await restarted.phq9.getPhq9s(patientId)).toEqual([{ ...unfinished(), answers: [] }]);
    await clear();
  });

  it("keeps the total and dates of a completed questionnaire, no items, and forgets its answers", async () => {
    const memory = new InMemoryAnswerStore();
    const repo = createPhq9Repository(createDbContext(prisma, { storeItemAnswers: false, answerStore: memory }));

    await repo.savePhq9(unfinished());
    await repo.savePhq9(completed());

    const { row, items } = await itemsOfRow();
    expect(row.status).toBe("completed");
    expect(row.totalScore).toBe(9);
    expect(items).toEqual(Array(9).fill(null));
    expect(memory.get(patientId, "phq9", 1)).toBeUndefined();
    expect(memory.size()).toBe(0);
    expect(await repo.getPhq9s(patientId)).toEqual([{ ...completed(), answers: [] }]);
    await clear();
  });

  it("keeps neither a row nor answers in memory when the unit of work fails after the save", async () => {
    const memory = new InMemoryAnswerStore();
    const ctx = createDbContext(prisma, { storeItemAnswers: false, answerStore: memory });
    const repo = createPhq9Repository(ctx);

    await expect(
      ctx.unitOfWork.execute(async () => {
        await repo.savePhq9(unfinished());
        expect(await repo.getPhq9s(patientId)).toEqual([unfinished()]);
        throw new Error("fail after the save");
      })
    ).rejects.toThrow("fail after the save");

    expect(await prisma.phq9Assessment.count({ where: { participantId: patientId } })).toBe(0);
    expect(memory.get(patientId, "phq9", 1)).toBeUndefined();
  });

  it("applies the answers to memory only once the unit of work has committed", async () => {
    const memory = new InMemoryAnswerStore();
    const ctx = createDbContext(prisma, { storeItemAnswers: false, answerStore: memory });
    const repo = createPhq9Repository(ctx);

    await ctx.unitOfWork.execute(async () => {
      await repo.savePhq9(unfinished());
      expect(memory.get(patientId, "phq9", 1)).toBeUndefined();
    });

    expect(memory.get(patientId, "phq9", 1)).toEqual(threeAnswers);
    await clear();
  });

  it("keeps the deletion of the answers undone when the completing unit of work fails", async () => {
    const memory = new InMemoryAnswerStore();
    const ctx = createDbContext(prisma, { storeItemAnswers: false, answerStore: memory });
    const repo = createPhq9Repository(ctx);
    await repo.savePhq9(unfinished());

    await expect(
      ctx.unitOfWork.execute(async () => {
        await repo.savePhq9(completed());
        throw new Error("fail after completing");
      })
    ).rejects.toThrow("fail after completing");

    expect(memory.get(patientId, "phq9", 1)).toEqual(threeAnswers);
    expect(await repo.getPhq9s(patientId)).toEqual([unfinished()]);
    await clear();
  });

  it("writes the item columns and reads them back when the setting is on", async () => {
    const memory = new InMemoryAnswerStore();
    const repo = createPhq9Repository(createDbContext(prisma, { storeItemAnswers: true, answerStore: memory }));

    await repo.savePhq9(unfinished());

    const { items } = await itemsOfRow();
    expect(items).toEqual([1, 0, 3, null, null, null, null, null, null]);
    expect(memory.size()).toBe(0);
    const fresh = createPhq9Repository(
      createDbContext(prisma, { storeItemAnswers: true, answerStore: new InMemoryAnswerStore() })
    );
    expect(await fresh.getPhq9s(patientId)).toEqual([unfinished()]);
    await clear();
  });

  it("is off when nothing is passed: no item columns are written", async () => {
    const repo = createPhq9Repository(createDbContext(prisma, { answerStore: new InMemoryAnswerStore() }));
    await repo.savePhq9(unfinished());
    const { items } = await itemsOfRow();
    expect(items).toEqual(Array(9).fill(null));
    await clear();
  });
});
