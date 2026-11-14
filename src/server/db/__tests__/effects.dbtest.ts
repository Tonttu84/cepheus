import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredBaselineNotWellNotice, StoredSmallDip, StoredWarning } from "@/usecases/ports";
import { StoredDataError } from "../errors";
import { createDbContext, type DbContext } from "../context";
import {
  createBaselineNotWellRepository,
  createSmallDipRepository,
  createWarningRepository,
} from "../effects";

describe("Effect repositories (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let ctx: DbContext;
  let clinicId: string;
  let patientA: string;
  let patientB: string;

  beforeAll(async () => {
    prisma = getPrisma();
    ctx = createDbContext(prisma);
    const clinic = await prisma.clinic.create({
      data: { code: "effects-dbtest-clinic", name: "Effects" },
    });
    clinicId = clinic.id;
    patientA = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-a", source: "synthetic", clinicId },
      })
    ).id;
    patientB = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-b", source: "synthetic", clinicId },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "effects-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "effects-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  function warning(patientId: string, overrides: Partial<StoredWarning> = {}): StoredWarning {
    return {
      patientId,
      kind: "low_answers",
      since: "2026-11-01",
      version: 2,
      causedBy: { type: "round", roundNumber: 4, date: "2026-11-03" },
      raisedAt: "2026-11-03T10:00:00.000Z",
      ...overrides,
    };
  }

  function dip(patientId: string): StoredSmallDip {
    return {
      patientId,
      roundNumber: 3,
      date: "2026-11-02",
      version: 2,
      causedBy: { type: "gad7", date: "2026-11-02" },
      shownAt: "2026-11-02T09:00:00.000Z",
    };
  }

  function notice(patientId: string): StoredBaselineNotWellNotice {
    return {
      patientId,
      version: 1,
      causedBy: { type: "phq9", date: "2026-11-01" },
      notifiedAt: "2026-11-01T08:00:00.000Z",
    };
  }

  it("reads back a warning caused by a round", async () => {
    const repo = createWarningRepository(ctx);
    const saved = warning(patientA);
    await repo.saveWarning(saved);
    expect(await repo.getWarnings(patientA)).toEqual([saved]);
  });

  it("reads back a warning caused by a PHQ-9 with only the keys type and date", async () => {
    const repo = createWarningRepository(ctx);
    const saved = warning(patientB, {
      kind: "phq9",
      causedBy: { type: "phq9", date: "2026-11-05" },
    });
    await repo.saveWarning(saved);
    const [read] = await repo.getWarnings(patientB);
    expect(read).toEqual(saved);
    expect(Object.keys(read.causedBy).sort()).toEqual(["date", "type"]);
  });

  it("stores the clinic, the area, the status and no score in the flag row", async () => {
    const row = await prisma.clinicFlag.findFirstOrThrow({
      where: { participantId: patientB, triggerKind: "phq9" },
    });
    expect(row.clinicId).toBe(clinicId);
    expect(row.primaryArea).toBe("check_in");
    expect(row.broadAreasJson).toBe('["check_in"]');
    expect(row.status).toBe("open");
    expect(row.ruleVersion).toBe(2);
    expect(row.sinceDate).toBe("2026-11-01");
    expect(row.causeType).toBe("phq9");
    expect(row.causeRoundNumber).toBeNull();
    expect(row.causeDate).toBe("2026-11-05");
  });

  it("returns warnings oldest first and never changes the first row on a second save", async () => {
    const patient = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-order", source: "synthetic", clinicId },
      })
    ).id;
    const repo = createWarningRepository(ctx);
    const newer = warning(patient, { raisedAt: "2026-11-09T10:00:00.000Z", since: "2026-11-08" });
    const older = warning(patient, { raisedAt: "2026-11-03T10:00:00.000Z" });
    await repo.saveWarning(newer);
    await repo.saveWarning(older);
    const before = await prisma.clinicFlag.findMany({ where: { participantId: patient } });
    expect(await repo.getWarnings(patient)).toEqual([older, newer]);
    await repo.saveWarning(older);
    const after = await prisma.clinicFlag.findMany({ where: { participantId: patient } });
    expect(after).toHaveLength(3);
    for (const row of before) {
      expect(after).toContainEqual(row);
    }
  });

  it("does not return a flag without a cause as a warning", async () => {
    const patient = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-nocause", source: "synthetic", clinicId },
      })
    ).id;
    await prisma.clinicFlag.create({
      data: {
        participantId: patient,
        clinicId,
        sinceDate: "2026-11-01",
        triggerKind: "sustained_dip",
        primaryArea: "check_in",
        broadAreasJson: '["check_in"]',
      },
    });
    expect(await createWarningRepository(ctx).getWarnings(patient)).toEqual([]);
  });

  it("reads back a small dip", async () => {
    const repo = createSmallDipRepository(ctx);
    const saved = dip(patientA);
    await repo.saveSmallDip(saved);
    expect(await repo.getSmallDips(patientA)).toEqual([saved]);
  });

  it("reads back a baseline notice", async () => {
    const repo = createBaselineNotWellRepository(ctx);
    const saved = notice(patientA);
    await repo.saveNotice(saved);
    expect(await repo.getNotices(patientA)).toEqual([saved]);
  });

  it("returns the small dips and the notices oldest first", async () => {
    const patient = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-order2", source: "synthetic", clinicId },
      })
    ).id;
    const dips = createSmallDipRepository(ctx);
    const notices = createBaselineNotWellRepository(ctx);
    const lateDip = { ...dip(patient), shownAt: "2026-11-05T09:00:00.000Z" };
    const earlyDip = dip(patient);
    const lateNotice = { ...notice(patient), notifiedAt: "2026-11-05T09:00:00.000Z" };
    const earlyNotice = notice(patient);
    await dips.saveSmallDip(lateDip);
    await dips.saveSmallDip(earlyDip);
    await notices.saveNotice(lateNotice);
    await notices.saveNotice(earlyNotice);
    expect(await dips.getSmallDips(patient)).toEqual([earlyDip, lateDip]);
    expect(await notices.getNotices(patient)).toEqual([earlyNotice, lateNotice]);
  });

  it("returns only the rows of the asked patient", async () => {
    expect(await createWarningRepository(ctx).getWarnings(patientA)).toEqual([warning(patientA)]);
    expect(await createSmallDipRepository(ctx).getSmallDips(patientB)).toEqual([]);
    expect(await createBaselineNotWellRepository(ctx).getNotices(patientB)).toEqual([]);
  });

  it("does not store a save inside a unit of work that throws", async () => {
    const patient = (
      await prisma.participant.create({
        data: { label: "effects-dbtest-rollback", source: "synthetic", clinicId },
      })
    ).id;
    await expect(
      ctx.unitOfWork.execute(async () => {
        await createWarningRepository(ctx).saveWarning(warning(patient));
        await createSmallDipRepository(ctx).saveSmallDip(dip(patient));
        await createBaselineNotWellRepository(ctx).saveNotice(notice(patient));
        throw new Error("stop this unit");
      })
    ).rejects.toThrow("stop this unit");
    expect(await createWarningRepository(ctx).getWarnings(patient)).toEqual([]);
    expect(await createSmallDipRepository(ctx).getSmallDips(patient)).toEqual([]);
    expect(await createBaselineNotWellRepository(ctx).getNotices(patient)).toEqual([]);
  });

  it("throws Patient not found for an unknown patient", async () => {
    await expect(
      createWarningRepository(ctx).saveWarning(warning("effects-dbtest-unknown"))
    ).rejects.toThrow("Patient not found");
    await expect(
      createSmallDipRepository(ctx).saveSmallDip(dip("effects-dbtest-unknown"))
    ).rejects.toThrow("Patient not found");
    await expect(
      createBaselineNotWellRepository(ctx).saveNotice(notice("effects-dbtest-unknown"))
    ).rejects.toThrow("Patient not found");
  });
  it("refuses a stored cause that is not a valid cause with a named error", async () => {
    const base = {
      participantId: patientA,
      clinicId,
      roundNumber: 1,
      date: "2026-11-02",
      ruleVersion: 1,
      shownAt: new Date("2026-11-02T09:00:00.000Z"),
    };
    for (const cause of [
      { causeType: "round", causeRoundNumber: null, causeDate: "2026-11-02" },
      { causeType: "strange", causeRoundNumber: null, causeDate: "2026-11-02" },
      { causeType: "phq9", causeRoundNumber: null, causeDate: "" },
    ]) {
      await prisma.smallDip.create({ data: { ...base, ...cause } });
      await expect(createSmallDipRepository(ctx).getSmallDips(patientA)).rejects.toBeInstanceOf(StoredDataError);
      await prisma.smallDip.deleteMany({ where: { participantId: patientA } });
    }
  });
});
