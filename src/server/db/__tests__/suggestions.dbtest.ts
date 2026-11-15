import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredSuggestion } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createSuggestionRepository } from "../suggestions";

describe("Suggestion repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherPatientId: string;
  const CLINIC_CODE = "sug-dbtest-clinic";

  const repo = () => createSuggestionRepository(createDbContext(prisma));

  beforeAll(async () => {
    prisma = getPrisma();
    const clinic = await prisma.clinic.create({
      data: { code: CLINIC_CODE, name: "Suggestions test clinic" },
    });
    clinicId = clinic.id;

    const p1 = await prisma.participant.create({
      data: {
        clinicId,
        label: "sug-dbtest-p1",
        source: "live",
        timeZone: "Europe/Helsinki",
      },
    });
    patientId = p1.id;

    const p2 = await prisma.participant.create({
      data: {
        clinicId,
        label: "sug-dbtest-p2",
        source: "live",
        timeZone: "Europe/Helsinki",
      },
    });
    otherPatientId = p2.id;
  });

  afterAll(async () => {
    await prisma.patientSuggestion.deleteMany({
      where: { participantId: { in: [patientId, otherPatientId] } },
    });
    await prisma.participant.deleteMany({
      where: { label: { startsWith: "sug-dbtest-" } },
    });
    await prisma.clinic.deleteMany({ where: { code: CLINIC_CODE } });
    await prisma.$disconnect();
  });

  const suggestion = (id: string, overrides: Partial<StoredSuggestion> = {}): StoredSuggestion => ({
    id,
    patientId,
    clinicId,
    createdAt: "2026-11-16T10:00:00.000Z",
    date: "2026-11-16",
    dayIndex: 1,
    reason: "practice",
    actionKey: "short_walk",
    actionTitle: "Take a 10-minute walk outside",
    actionDetail: "Step outside for ten minutes at an easy pace.",
    effortTier: "low",
    status: "shown",
    respondedAt: null,
    armType: "intervention",
    nextCheckInDelta: null,
    isSimulated: true,
    ...overrides,
  });

  it("returns null when no suggestions exist for a patient", async () => {
    expect(await repo().getLatestSuggestion(patientId)).toBeNull();
    expect(await repo().getSuggestion("non-existent-id")).toBeNull();
  });

  it("saves a suggestion and reads it back by id and as latest", async () => {
    const sug = suggestion("sug-1");
    await repo().saveSuggestion(sug);

    const byId = await repo().getSuggestion("sug-1");
    expect(byId).toEqual(sug);

    const latest = await repo().getLatestSuggestion(patientId);
    expect(latest).toEqual(sug);
  });

  it("returns the newest suggestion when multiple suggestions exist", async () => {
    const sugEarlier = suggestion("sug-earlier", {
      createdAt: "2026-11-15T09:00:00.000Z",
      date: "2026-11-15",
    });
    const sugLater = suggestion("sug-later", {
      createdAt: "2026-11-17T09:00:00.000Z",
      date: "2026-11-17",
      actionKey: "breathing_space",
      actionTitle: "Take a 3-minute slow breathing pause",
    });

    await repo().saveSuggestion(sugEarlier);
    await repo().saveSuggestion(sugLater);

    const latest = await repo().getLatestSuggestion(patientId);
    expect(latest?.id).toBe("sug-later");
    expect(latest?.actionKey).toBe("breathing_space");
  });

  it("updates suggestion choice status and respondedAt", async () => {
    const sug = suggestion("sug-choice", {
      createdAt: "2026-11-18T10:00:00.000Z",
      date: "2026-11-18",
    });
    await repo().saveSuggestion(sug);

    const respondedAt = "2026-11-18T11:30:00.000Z";
    await repo().updateSuggestionChoice("sug-choice", "accepted", respondedAt);

    const updated = await repo().getSuggestion("sug-choice");
    expect(updated?.status).toBe("accepted");
    expect(updated?.respondedAt).toBe(respondedAt);
  });

  it("rolls back suggestion changes when unit of work fails", async () => {
    const ctx = createDbContext(prisma);
    const repoWithCtx = createSuggestionRepository(ctx);
    const sug = suggestion("sug-rollback", {
      createdAt: "2026-11-19T10:00:00.000Z",
      date: "2026-11-19",
    });

    await expect(
      ctx.unitOfWork.execute(async () => {
        await repoWithCtx.saveSuggestion(sug);
        throw new Error("injected rollback failure");
      })
    ).rejects.toThrow("injected rollback failure");

    expect(await repo().getSuggestion("sug-rollback")).toBeNull();
  });
});
