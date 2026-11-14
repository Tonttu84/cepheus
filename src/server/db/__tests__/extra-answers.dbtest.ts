import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredExtraAnswer } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createExtraAnswerRepository } from "../extra-answers";

describe("Extra answer repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherId: string;
  const repo = () => createExtraAnswerRepository(createDbContext(prisma));

  const answer = (roundNumber: number, value = 2): StoredExtraAnswer => ({
    patientId,
    roundNumber,
    itemId: "extra_sleep",
    value,
    answeredAt: "2026-11-16T16:20:00.000Z",
  });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "extra-dbtest-clinic", name: "Extra" } })).id;
    const data = { clinicId, source: "live" };
    patientId = (await prisma.participant.create({ data: { ...data, label: "extra-dbtest-main" } })).id;
    otherId = (await prisma.participant.create({ data: { ...data, label: "extra-dbtest-other" } })).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "extra-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "extra-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("reads an answer back equal to what was saved", async () => {
    await repo().saveExtraAnswer(answer(1));
    expect(await repo().getExtraAnswer(patientId, 1)).toEqual(answer(1));
    expect(await repo().getExtraAnswers(patientId)).toEqual([answer(1)]);
    await prisma.extraAnswer.deleteMany({ where: { participantId: patientId } });
  });

  it("gives null when the answer is missing", async () => {
    expect(await repo().getExtraAnswer(patientId, 9)).toBeNull();
  });

  it("replaces the answer of a round and makes no second row", async () => {
    await repo().saveExtraAnswer(answer(1, 1));
    await repo().saveExtraAnswer(answer(1, 4));
    expect(await prisma.extraAnswer.count({ where: { participantId: patientId } })).toBe(1);
    expect((await repo().getExtraAnswer(patientId, 1))?.value).toBe(4);
    await prisma.extraAnswer.deleteMany({ where: { participantId: patientId } });
  });

  it("gives the answers in round order and only those of the asked patient", async () => {
    await repo().saveExtraAnswer(answer(3));
    await repo().saveExtraAnswer(answer(1));
    await repo().saveExtraAnswer({ ...answer(2), patientId: otherId });
    const answers = await repo().getExtraAnswers(patientId);
    expect(answers.map((a) => a.roundNumber)).toEqual([1, 3]);
    await prisma.extraAnswer.deleteMany({ where: { participantId: { in: [patientId, otherId] } } });
  });

  it("stores the clinic on the row", async () => {
    await repo().saveExtraAnswer(answer(1));
    const row = await prisma.extraAnswer.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.clinicId).toBe(clinicId);
    await prisma.extraAnswer.deleteMany({ where: { participantId: patientId } });
  });
});
