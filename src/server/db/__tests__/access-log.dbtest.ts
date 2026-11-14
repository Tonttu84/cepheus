import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredAccessLogEntry } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createAccessLogRepository } from "../access-log";

describe("Access log repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  function entryFor(patientId: string, overrides: Partial<StoredAccessLogEntry> = {}): StoredAccessLogEntry {
    return {
      actor: { kind: "patient", patientId, clinicId: "accesslog-dbtest-clinic" },
      action: "read",
      target: { kind: "answers", patientId, clinicId: "accesslog-dbtest-clinic" },
      purpose: "self_access",
      allowed: true,
      reason: "allowed",
      timestamp: "2026-11-14T10:00:00.000Z",
      ...overrides,
    };
  }

  beforeAll(() => {
    prisma = getPrisma();
  });

  afterAll(async () => {
    await prisma.accessLog.deleteMany({
      where: { targetPatientId: { startsWith: "accesslog-dbtest-" } },
    });
    await prisma.participant.deleteMany({ where: { id: { startsWith: "accesslog-dbtest-" } } });
    await prisma.$disconnect();
  });

  it("reads back entries of a patient actor, a staff actor and the system actor equal to what was appended", async () => {
    const repo = createAccessLogRepository(createDbContext(prisma));
    const id = "accesslog-dbtest-actors";
    const entries: StoredAccessLogEntry[] = [
      entryFor(id, { timestamp: "2026-11-14T10:00:01.000Z" }),
      entryFor(id, {
        actor: { kind: "staff", staffId: "accesslog-dbtest-staff", clinicId: "accesslog-dbtest-clinic", role: "nurse" },
        purpose: "care",
        timestamp: "2026-11-14T10:00:02.000Z",
      }),
      entryFor(id, {
        actor: { kind: "system" },
        target: { kind: "flags", patientId: id },
        allowed: false,
        reason: "consent_required",
        timestamp: "2026-11-14T10:00:03.000Z",
      }),
    ];
    for (const entry of entries) await repo.appendLog(entry);
    expect(await repo.getLogs(id)).toEqual(entries);
  });

  it("reads back an entry with a target method", async () => {
    const repo = createAccessLogRepository(createDbContext(prisma));
    const id = "accesslog-dbtest-method";
    const entry = entryFor(id, { target: { kind: "readings", patientId: id, method: "ring" } });
    await repo.appendLog(entry);
    expect(await repo.getLogs(id)).toEqual([entry]);
  });

  it("gives only the entries of the asked patient, oldest first", async () => {
    const repo = createAccessLogRepository(createDbContext(prisma));
    const idA = "accesslog-dbtest-order-a";
    const idB = "accesslog-dbtest-order-b";
    const late = entryFor(idA, { timestamp: "2026-11-14T12:00:00.000Z" });
    const early = entryFor(idA, { timestamp: "2026-11-14T11:00:00.000Z" });
    await repo.appendLog(late);
    await repo.appendLog(entryFor(idB));
    await repo.appendLog(early);
    expect(await repo.getLogs(idA)).toEqual([early, late]);
  });

  it("stores an entry that names a patient id with no stored participant, with a null patient code", async () => {
    const repo = createAccessLogRepository(createDbContext(prisma));
    const id = "accesslog-dbtest-missing";
    await repo.appendLog(entryFor(id));
    const rows = await prisma.accessLog.findMany({ where: { targetPatientId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].patientCode).toBeNull();
  });

  it("holds the participant code of a stored participant and keeps the entry after the participant is deleted", async () => {
    const repo = createAccessLogRepository(createDbContext(prisma));
    const id = "accesslog-dbtest-coded";
    await prisma.participant.create({
      data: { id, label: "Test", source: "live", participantCode: "accesslog-dbtest-code" },
    });
    await repo.appendLog(entryFor(id));
    const rows = await prisma.accessLog.findMany({ where: { targetPatientId: id } });
    expect(rows[0].patientCode).toBe("accesslog-dbtest-code");
    await prisma.participant.delete({ where: { id } });
    expect(await repo.getLogs(id)).toHaveLength(1);
  });

  it("does not store an entry appended inside a unit of work that throws", async () => {
    const ctx = createDbContext(prisma);
    const repo = createAccessLogRepository(ctx);
    const id = "accesslog-dbtest-rollback";
    await expect(
      ctx.unitOfWork.execute(async () => {
        await repo.appendLog(entryFor(id));
        throw new Error("stop this unit");
      })
    ).rejects.toThrow("stop this unit");
    expect(await repo.getLogs(id)).toEqual([]);
  });

  it("keeps an entry appended outside a unit of work when a later unit of work throws", async () => {
    const ctx = createDbContext(prisma);
    const repo = createAccessLogRepository(ctx);
    const id = "accesslog-dbtest-outside";
    await repo.appendLog(entryFor(id));
    await expect(
      ctx.unitOfWork.execute(async () => {
        throw new Error("stop this unit");
      })
    ).rejects.toThrow("stop this unit");
    expect(await repo.getLogs(id)).toHaveLength(1);
  });
});
