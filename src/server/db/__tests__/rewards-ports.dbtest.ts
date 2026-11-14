import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { PatientActor } from "@/domain/access/types";
import { createLedgerEntry } from "@/domain/rewards/ledger";
import { getPrisma } from "@/lib/db";
import { createPrismaPorts } from "../index";
import { createDbContext } from "../context";
import { createRewardLedgerRepository } from "../reward-ledger";
import { createPrismaRewardsPorts } from "../rewards-factory";
import {
  DuplicateLedgerEntryError,
  type RewardsPorts,
} from "@/usecases/rewards/ports";
import { creditAnsweredRound } from "@/usecases/rewards/credit-answered-round";
import { markTaskDone } from "@/usecases/rewards/mark-task-done";
import { markTaskNotToday } from "@/usecases/rewards/mark-task-not-today";
import { requestPayout } from "@/usecases/rewards/request-payout";
import { FakeClock } from "@/usecases/rewards/testing/fake-ports";

const CLINIC_CODE = "rewards-dbtest-clinic";
const SCHEDULE_START = "2026-11-16"; // Monday (check-in day)
const TUESDAY_ISO = "2026-11-17T10:00:00.000Z"; // Non check-in day

describe("Rewards and small tasks PostgreSQL storage (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;

  beforeAll(async () => {
    prisma = getPrisma();
    const clinic = await prisma.clinic.create({
      data: { code: CLINIC_CODE, name: "Rewards test clinic" },
    });
    clinicId = clinic.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { clinicId } });
    await prisma.clinic.deleteMany({ where: { code: CLINIC_CODE } });
    await prisma.$disconnect();
  });

  async function enrol(name: string, isSimulated = true): Promise<{
    patientId: string;
    actor: PatientActor;
    ports: RewardsPorts;
    clock: FakeClock;
  }> {
    const patientId = `rewards-dbtest-${name}`;
    await prisma.participant.create({
      data: {
        id: patientId,
        clinicId,
        label: `rewards-dbtest-${name}`,
        source: isSimulated ? "synthetic" : "live",
        isSimulated,
        enrolmentDate: SCHEDULE_START,
        scheduleDaysJson: "[1,4]", // Mon, Thu
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
        takingPart: true,
      },
    });

    const clock = new FakeClock("2026-11-16T18:00:00.000Z");
    const ports = {
      ...createPrismaRewardsPorts(prisma, {
        enabled: true,
        answeredRoundRewardCents: 100,
        smallTaskRewardCents: 50,
        payoutThresholdCents: 500,
        maxRewardedTasksPerLocalDay: 1,
      }),
      clock,
    };
    const actor: PatientActor = { kind: "patient", patientId, clinicId };
    return { patientId, actor, ports, clock };
  }

  it("gives every storage port, a unit of work and a clock that tells the present time", () => {
    const ports = createPrismaRewardsPorts(prisma);
    const before = Date.now();
    const now = new Date(ports.clock.now()).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
    expect(ports.clock.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    for (const key of [
      "ledger",
      "preferences",
      "taskRecords",
      "patients",
      "rounds",
      "clock",
      "unitOfWork",
    ] as const) {
      expect(ports[key]).toBeDefined();
    }
  });

  describe("Reward ledger repository", () => {
    it("appends and reads back in order; second entry with same id raises DuplicateLedgerEntryError and leaves one row; amounts are integers", async () => {
      const { patientId } = await enrol("ledger-basics");
      const ctx = createDbContext(prisma);
      const repo = createRewardLedgerRepository(ctx);

      const entry1 = createLedgerEntry({
        id: `entry-1-${patientId}`,
        patientId,
        kind: "answered_round",
        amountCents: 100,
        roundNumber: 1,
        createdAt: "2026-11-16T18:00:00.000Z",
      });
      const entry2 = createLedgerEntry({
        id: `entry-2-${patientId}`,
        patientId,
        kind: "small_task",
        amountCents: 50,
        taskKey: "short_walk",
        localDate: "2026-11-17",
        createdAt: "2026-11-17T10:00:00.000Z",
      });
      const entry3 = createLedgerEntry({
        id: `entry-3-${patientId}`,
        patientId,
        kind: "payout",
        amountCents: -150,
        requestId: "payout-req-1",
        createdAt: "2026-11-17T12:00:00.000Z",
      });

      await repo.appendEntry(entry1);
      await repo.appendEntry(entry2);
      await repo.appendEntry(entry3);

      const entries = await repo.getEntries(patientId);
      expect(entries).toHaveLength(3);
      expect(entries[0]?.id).toBe(entry1.id);
      expect(entries[1]?.id).toBe(entry2.id);
      expect(entries[2]?.id).toBe(entry3.id);

      for (const entry of entries) {
        expect(Number.isInteger(entry.amountCents)).toBe(true);
      }

      await expect(repo.appendEntry(entry1)).rejects.toThrow(DuplicateLedgerEntryError);

      const rowCount = await prisma.rewardLedgerEntry.count({
        where: { id: entry1.id },
      });
      expect(rowCount).toBe(1);

      expect(await repo.getEntryByRound(patientId, 1)).toEqual(entry1);
      expect(await repo.getEntryByTaskDate(patientId, "2026-11-17")).toEqual(entry2);
      expect(await repo.getEntryByRequestId(patientId, "payout-req-1")).toEqual(entry3);
    });
  });

  describe("Real use cases on Prisma ports", () => {
    it("the same round credited twice at once (Promise.all) gives one entry", async () => {
      const { patientId, actor, ports } = await enrol("round-twice");
      const basePorts = createPrismaPorts(prisma);

      await basePorts.rounds.saveRound({
        patientId,
        roundNumber: 1,
        localDate: "2026-11-16",
        status: "answered",
        mood: 3,
        interest: 3,
        answeredAt: "2026-11-16T18:30:00.000Z",
      });

      const [res1, res2] = await Promise.all([
        creditAnsweredRound(actor, { patientId, roundNumber: 1 }, ports),
        creditAnsweredRound(actor, { patientId, roundNumber: 1 }, ports),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);

      if (res1.ok && res2.ok) {
        const rewardedCount = [res1.value.rewarded, res2.value.rewarded].filter(Boolean).length;
        const duplicateCount = [res1.value.isDuplicate, res2.value.isDuplicate].filter(Boolean).length;
        expect(rewardedCount).toBe(1);
        expect(duplicateCount).toBe(1);
      }

      const rows = await prisma.rewardLedgerEntry.findMany({
        where: { participantId: patientId, roundNumber: 1 },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.amountCents).toBe(100);
    });

    it("the same task marked done twice at once gives one entry and one completed record", async () => {
      const { patientId, actor, ports, clock } = await enrol("task-twice");
      clock.setTime(TUESDAY_ISO);

      const [res1, res2] = await Promise.all([
        markTaskDone(actor, { patientId }, ports),
        markTaskDone(actor, { patientId }, ports),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);

      if (res1.ok && res2.ok) {
        const rewardedCount = [res1.value.rewarded, res2.value.rewarded].filter(Boolean).length;
        expect(rewardedCount).toBe(1);
        expect(res1.value.status).toBe("completed");
        expect(res2.value.status).toBe("completed");
      }

      const ledgerRows = await prisma.rewardLedgerEntry.findMany({
        where: { participantId: patientId, localDate: "2026-11-17" },
      });
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]?.amountCents).toBe(50);

      const recordRows = await prisma.taskRecord.findMany({
        where: { participantId: patientId, localDate: "2026-11-17" },
      });
      expect(recordRows).toHaveLength(1);
      expect(recordRows[0]?.status).toBe("completed");
    });

    it("two different payout requests at once with a balance that covers one give one payout and insufficient_balance", async () => {
      const { patientId, actor, ports } = await enrol("payout-concurrency");

      for (let r = 1; r <= 5; r++) {
        await ports.ledger.appendEntry(
          createLedgerEntry({
            id: `seed-round-${patientId}-${r}`,
            patientId,
            kind: "answered_round",
            amountCents: 100,
            roundNumber: r,
            createdAt: `2026-11-1${r}T18:00:00.000Z`,
          })
        );
      }

      const [resA, resB] = await Promise.all([
        requestPayout(actor, { patientId, requestId: "req-alpha" }, ports),
        requestPayout(actor, { patientId, requestId: "req-beta" }, ports),
      ]);

      const successResults = [resA, resB].filter((r) => r.ok);
      const failedResults = [resA, resB].filter((r) => !r.ok);

      expect(successResults).toHaveLength(1);
      expect(failedResults).toHaveLength(1);

      if (!resA.ok) {
        expect(resA.error).toBe("insufficient_balance");
      }
      if (!resB.ok) {
        expect(resB.error).toBe("insufficient_balance");
      }

      const payoutRows = await prisma.rewardLedgerEntry.findMany({
        where: { participantId: patientId, kind: "payout" },
      });
      expect(payoutRows).toHaveLength(1);
      expect(payoutRows[0]?.amountCents).toBe(-500);

      const allEntries = await ports.ledger.getEntries(patientId);
      const finalBalance = allEntries.reduce((sum, e) => sum + e.amountCents, 0);
      expect(finalBalance).toBe(0);
      expect(finalBalance).toBeGreaterThanOrEqual(0);
    });

    it("'Done' then 'Not today' on the same local date leaves the record completed", async () => {
      const { patientId, actor, ports, clock } = await enrol("done-then-not-today");
      clock.setTime(TUESDAY_ISO);

      const doneRes = await markTaskDone(actor, { patientId }, ports);
      expect(doneRes.ok).toBe(true);

      const notTodayRes = await markTaskNotToday(actor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(true);
      if (notTodayRes.ok) {
        expect(notTodayRes.value.status).toBe("completed");
        expect(notTodayRes.value.rewarded).toBe(false);
      }

      const record = await ports.taskRecords.getTaskRecord(patientId, "2026-11-17");
      expect(record?.status).toBe("completed");
    });

    it("a failed unit of work leaves no row", async () => {
      const { patientId, ports } = await enrol("failed-uow");

      await expect(
        ports.unitOfWork.execute(async () => {
          await ports.ledger.appendEntry(
            createLedgerEntry({
              id: `rollback-${patientId}`,
              patientId,
              kind: "answered_round",
              amountCents: 100,
              roundNumber: 1,
              createdAt: "2026-11-16T18:00:00.000Z",
            })
          );
          throw new Error("Simulated unit-of-work failure");
        })
      ).rejects.toThrow("Simulated unit-of-work failure");

      const rows = await prisma.rewardLedgerEntry.findMany({
        where: { participantId: patientId },
      });
      expect(rows).toHaveLength(0);
    });

    it("a simulated participant's rows are marked simulated", async () => {
      const sim = await enrol("sim-patient", true);
      const live = await enrol("live-patient", false);

      await sim.ports.ledger.appendEntry(
        createLedgerEntry({
          id: `sim-ledger-${sim.patientId}`,
          patientId: sim.patientId,
          kind: "answered_round",
          amountCents: 100,
          roundNumber: 1,
          createdAt: "2026-11-16T18:00:00.000Z",
        })
      );
      await sim.ports.preferences.savePreferences(sim.patientId, ["short_walk"]);
      await sim.ports.taskRecords.saveTaskRecord({
        id: `sim-record-${sim.patientId}`,
        patientId: sim.patientId,
        localDate: "2026-11-17",
        taskKey: "short_walk",
        status: "completed",
        source: "self_report",
        isSimulated: true,
      });

      await live.ports.ledger.appendEntry(
        createLedgerEntry({
          id: `live-ledger-${live.patientId}`,
          patientId: live.patientId,
          kind: "answered_round",
          amountCents: 100,
          roundNumber: 1,
          createdAt: "2026-11-16T18:00:00.000Z",
        })
      );
      await live.ports.preferences.savePreferences(live.patientId, ["bright_light"]);
      await live.ports.taskRecords.saveTaskRecord({
        id: `live-record-${live.patientId}`,
        patientId: live.patientId,
        localDate: "2026-11-17",
        taskKey: "bright_light",
        status: "completed",
        source: "self_report",
        isSimulated: true,
      });

      const simLedger = await prisma.rewardLedgerEntry.findUniqueOrThrow({
        where: { id: `sim-ledger-${sim.patientId}` },
      });
      const simPref = await prisma.taskPreference.findUniqueOrThrow({
        where: { participantId: sim.patientId },
      });
      const simTask = await prisma.taskRecord.findUniqueOrThrow({
        where: { participantId_localDate: { participantId: sim.patientId, localDate: "2026-11-17" } },
      });

      expect(simLedger.isSimulated).toBe(true);
      expect(simPref.isSimulated).toBe(true);
      expect(simTask.isSimulated).toBe(true);

      const liveLedger = await prisma.rewardLedgerEntry.findUniqueOrThrow({
        where: { id: `live-ledger-${live.patientId}` },
      });
      const livePref = await prisma.taskPreference.findUniqueOrThrow({
        where: { participantId: live.patientId },
      });
      const liveTask = await prisma.taskRecord.findUniqueOrThrow({
        where: { participantId_localDate: { participantId: live.patientId, localDate: "2026-11-17" } },
      });

      expect(liveLedger.isSimulated).toBe(false);
      expect(livePref.isSimulated).toBe(false);
      expect(liveTask.isSimulated).toBe(false);
    });

    it("deleting the participant removes their rows", async () => {
      const { patientId, ports } = await enrol("cascade-delete");

      await ports.ledger.appendEntry(
        createLedgerEntry({
          id: `cascade-ledger-${patientId}`,
          patientId,
          kind: "answered_round",
          amountCents: 100,
          roundNumber: 1,
          createdAt: "2026-11-16T18:00:00.000Z",
        })
      );
      await ports.preferences.savePreferences(patientId, ["pleasant_activity"]);
      await ports.taskRecords.saveTaskRecord({
        id: `cascade-record-${patientId}`,
        patientId,
        localDate: "2026-11-17",
        taskKey: "pleasant_activity",
        status: "offered",
        source: "self_report",
        isSimulated: true,
      });

      await prisma.participant.delete({ where: { id: patientId } });

      expect(await prisma.rewardLedgerEntry.count({ where: { participantId: patientId } })).toBe(0);
      expect(await prisma.taskPreference.count({ where: { participantId: patientId } })).toBe(0);
      expect(await prisma.taskRecord.count({ where: { participantId: patientId } })).toBe(0);
    });
  });
});
