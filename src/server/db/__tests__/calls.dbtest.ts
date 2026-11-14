import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { createDbContext, type DbContext } from "../context";
import { createCallRepository } from "../calls";

describe("Call repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let ctx: DbContext;
  let clinicId: string;

  beforeAll(async () => {
    prisma = getPrisma();
    ctx = createDbContext(prisma);
    clinicId = (
      await prisma.clinic.create({ data: { code: "calls-dbtest-clinic", name: "Calls" } })
    ).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "calls-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "calls-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  async function newPatient(label: string): Promise<string> {
    const row = await prisma.participant.create({
      data: { label: `calls-dbtest-${label}`, source: "synthetic", clinicId },
    });
    return row.id;
  }

  it("reads back a call with a position", async () => {
    const patientId = await newPatient("position");
    const repo = createCallRepository(ctx);
    await repo.saveCall({ patientId, date: "2026-11-02", position: "before" });
    expect(await repo.getCalls(patientId)).toEqual([
      { patientId, date: "2026-11-02", position: "before" },
    ]);
  });

  it("reads back a call without a position and without a position key", async () => {
    const patientId = await newPatient("noposition");
    const repo = createCallRepository(ctx);
    await repo.saveCall({ patientId, date: "2026-11-02" });
    const [call] = await repo.getCalls(patientId);
    expect(call).toEqual({ patientId, date: "2026-11-02" });
    expect("position" in call).toBe(false);
  });

  it("stores the status completed and the clinic", async () => {
    const patientId = await newPatient("row");
    await createCallRepository(ctx).saveCall({ patientId, date: "2026-11-02", position: "after" });
    const row = await prisma.nurseCallRecord.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.status).toBe("completed");
    expect(row.clinicId).toBe(clinicId);
    expect(row.date).toBe("2026-11-02");
    expect(row.position).toBe("after");
  });

  it("does not return a call that was only requested", async () => {
    const patientId = await newPatient("requested");
    await prisma.nurseCallRecord.create({ data: { participantId: patientId, clinicId } });
    expect(await createCallRepository(ctx).getCalls(patientId)).toEqual([]);
  });

  it("returns calls in date order and only for the asked patient", async () => {
    const patientId = await newPatient("order");
    const otherId = await newPatient("other");
    const repo = createCallRepository(ctx);
    await repo.saveCall({ patientId, date: "2026-11-09" });
    await repo.saveCall({ patientId: otherId, date: "2026-11-05" });
    await repo.saveCall({ patientId, date: "2026-11-03", position: "before" });
    expect(await repo.getCalls(patientId)).toEqual([
      { patientId, date: "2026-11-03", position: "before" },
      { patientId, date: "2026-11-09" },
    ]);
  });

  it("throws Patient not found for an unknown patient", async () => {
    await expect(
      createCallRepository(ctx).saveCall({ patientId: "calls-dbtest-unknown", date: "2026-11-02" })
    ).rejects.toThrow("Patient not found");
  });

  it("saves a full nurse call record with outcome and reads it back", async () => {
    const patientId = await newPatient("full-call");
    const repo = createCallRepository(ctx);
    const saved = await repo.saveNurseCallRecord({
      patientId,
      status: "completed",
      outcomeTier: "rough_patch",
      actionTaken: "advice_and_medication_check",
      medicationChecked: true,
      watchNextRounds: 2,
      date: "2026-11-16",
      position: "after",
      staffUserId: "staff-1",
    });
    expect(saved.id).toBeDefined();
    expect(saved.outcomeTier).toBe("rough_patch");
    expect(saved.actionTaken).toBe("advice_and_medication_check");
    expect(saved.medicationChecked).toBe(true);
    expect(saved.watchNextRounds).toBe(2);

    const records = await repo.getNurseCallRecords(patientId);
    expect(records).toHaveLength(1);
    expect(records[0].outcomeTier).toBe("rough_patch");

    // Also verify getCalls returned it because it had date & completed status
    const calls = await repo.getCalls(patientId);
    expect(calls).toEqual([{ patientId, date: "2026-11-16", position: "after" }]);
  });
});
