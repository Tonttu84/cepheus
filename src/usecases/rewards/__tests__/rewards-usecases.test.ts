import { beforeEach, describe, expect, it } from "vitest";
import type { PatientActor, StaffActor, SystemActor } from "../../../domain/access/types";
import type { Schedule } from "../../../domain/rounds/types";
import { creditAnsweredRound } from "../credit-answered-round";
import { markTaskDone } from "../mark-task-done";
import { markTaskNotToday } from "../mark-task-not-today";
import { readPreferences, setPreferences } from "../preferences";
import { readAccount } from "../read-account";
import { readTodayTask } from "../read-today-task";
import { requestPayout, type RequestPayoutInput } from "../request-payout";
import type { RewardsPorts } from "../ports";
import { createFakeRewardsPorts, type FakeRewardsPorts } from "../testing/fake-ports";

describe("Rewards and Small Tasks Use Cases", () => {
  const patientId = "patient-001";
  const clinicId = "clinic-001";

  const patientActor: PatientActor = {
    kind: "patient",
    patientId,
    clinicId,
  };

  const otherPatientActor: PatientActor = {
    kind: "patient",
    patientId: "patient-999",
    clinicId,
  };

  const nurseActor: StaffActor = {
    kind: "staff",
    staffId: "nurse-001",
    clinicId,
    role: "nurse",
  };

  const adminActor: StaffActor = {
    kind: "staff",
    staffId: "admin-001",
    clinicId,
    role: "admin",
  };

  const systemActor: SystemActor = {
    kind: "system",
  };

  const helsinkiSchedule: Schedule = {
    weekdays: [2, 5], // Tuesday and Friday check-in days
    timeOfDay: "09:00",
    timeZone: "Europe/Helsinki",
    enrolmentDate: "2026-11-01",
  };

  let ports: FakeRewardsPorts;

  beforeEach(() => {
    // 2026-11-14 is a Saturday (non-check-in day)
    ports = createFakeRewardsPorts({
      clockTime: "2026-11-14T10:00:00.000Z",
    });
    // Set up patient schedule info
    ports.patients.setPatient({
      patientId,
      clinicId,
      schedule: helsinkiSchedule,
    });
  });

  describe("Rule 1: Money is whole cents in integers, configurable defaults", () => {
    it("credits exactly configured default amounts (100 cents round, 100 task, 1000 payout)", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const roundRes = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        ports
      );
      expect(roundRes.ok).toBe(true);
      if (roundRes.ok) {
        expect(roundRes.value.amountCents).toBe(100);
        expect(Number.isInteger(roundRes.value.amountCents)).toBe(true);
        expect(roundRes.value.balanceCents).toBe(100);
      }

      const taskRes = await markTaskDone(patientActor, { patientId }, ports);
      expect(taskRes.ok).toBe(true);
      if (taskRes.ok) {
        expect(taskRes.value.rewardCents).toBe(100);
        expect(Number.isInteger(taskRes.value.rewardCents)).toBe(true);
        expect(taskRes.value.balanceCents).toBe(200);
      }
    });

    it("uses non-default configured amounts without hard-coding", async () => {
      const customPorts = createFakeRewardsPorts({
        config: {
          answeredRoundRewardCents: 250,
          smallTaskRewardCents: 175,
          payoutThresholdCents: 500,
        },
        clockTime: "2026-11-14T10:00:00.000Z",
      });
      customPorts.patients.setPatient({
        patientId,
        clinicId,
        schedule: helsinkiSchedule,
      });
      customPorts.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const roundRes = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        customPorts
      );
      expect(roundRes.ok).toBe(true);
      if (roundRes.ok) {
        expect(roundRes.value.amountCents).toBe(250);
        expect(roundRes.value.balanceCents).toBe(250);
      }

      const taskRes = await markTaskDone(patientActor, { patientId }, customPorts);
      expect(taskRes.ok).toBe(true);
      if (taskRes.ok) {
        expect(taskRes.value.rewardCents).toBe(175);
        expect(taskRes.value.balanceCents).toBe(425);
      }
    });

    it("rejects configuration with floating point amounts", async () => {
      const floatPorts = createFakeRewardsPorts({
        config: {
          answeredRoundRewardCents: 100.5,
        },
      });
      await expect(
        readAccount(patientActor, { patientId }, floatPorts)
      ).rejects.toThrow(/positive integer whole cents/);
    });
  });

  describe("Rule 2: Append-only ledger, balance is sum >= 0, no penalties", () => {
    it("never takes away balance for 'Not today' or missed rounds", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });
      await creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, ports);

      // Patient skips today's small task with "Not today"
      const notTodayRes = await markTaskNotToday(patientActor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(true);
      if (notTodayRes.ok) {
        expect(notTodayRes.value.status).toBe("not_today");
        expect(notTodayRes.value.rewarded).toBe(false);
      }

      // Check ledger entries: no entry added for "Not today"
      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.length).toBe(1);
      expect(entries.every((e) => e.kind !== "payout")).toBe(true);

      // Balance unchanged
      const account = await readAccount(patientActor, { patientId }, ports);
      expect(account.ok).toBe(true);
      if (account.ok) {
        expect(account.value.balanceCents).toBe(100);
      }

      // Missed round earns nothing and penalises nothing
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 2,
        status: "missed",
      });
      const missedRes = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 2 },
        ports
      );
      expect(missedRes.ok).toBe(true);
      if (missedRes.ok) {
        expect(missedRes.value.rewarded).toBe(false);
        expect(missedRes.value.amountCents).toBe(0);
        expect(missedRes.value.balanceCents).toBe(100);
      }

      const accountAfter = await readAccount(patientActor, { patientId }, ports);
      expect(accountAfter.ok).toBe(true);
      if (accountAfter.ok) {
        expect(accountAfter.value.balanceCents).toBe(100);
      }
    });
  });

  describe("Rule 3: One reward per answered round, only 2-tap answered rounds earn it", () => {
    it("rewards only answered rounds and ignores 'not_today' rounds", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "not_today",
      });

      const res = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        ports
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.rewarded).toBe(false);
        expect(res.value.amountCents).toBe(0);
        expect(res.value.reason).toBe("round_not_answered");
      }
    });

    it("does not reward a second time when credit request is repeated", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const firstCall = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        ports
      );
      expect(firstCall.ok).toBe(true);
      if (firstCall.ok) {
        expect(firstCall.value.rewarded).toBe(true);
        expect(firstCall.value.isDuplicate).toBe(false);
        expect(firstCall.value.balanceCents).toBe(100);
      }

      // Repeated call for the exact same round
      const secondCall = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        ports
      );
      expect(secondCall.ok).toBe(true);
      if (secondCall.ok) {
        expect(secondCall.value.rewarded).toBe(false);
        expect(secondCall.value.isDuplicate).toBe(true);
        expect(secondCall.value.balanceCents).toBe(100);
      }

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.length).toBe(1);
    });

    it("the same round credited twice at once with Promise.all gives one entry and one reward", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const [res1, res2] = await Promise.all([
        creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, ports),
        creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, ports),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const rewardedCount = [res1, res2].filter((r) => r.ok && r.value.rewarded).length;
      const duplicateCount = [res1, res2].filter((r) => r.ok && r.value.isDuplicate).length;
      expect(rewardedCount).toBe(1);
      expect(duplicateCount).toBe(1);

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe(`round-${patientId}-1`);
    });

    it("the same task marked done twice at once with Promise.all gives one entry and one reward", async () => {
      const [res1, res2] = await Promise.all([
        markTaskDone(patientActor, { patientId }, ports),
        markTaskDone(patientActor, { patientId }, ports),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const rewardedCount = [res1, res2].filter((r) => r.ok && r.value.rewarded).length;
      expect(rewardedCount).toBe(1);

      const entries = await ports.ledger.getEntries(patientId);
      const taskEntries = entries.filter((e) => e.kind === "small_task");
      expect(taskEntries.length).toBe(1);
      expect(taskEntries[0].id).toBe(`task-reward-${patientId}-2026-11-14`);
    });

    it("handles concurrent requests where a fake unit of work lets both read before either writes, still ending with one entry", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      let activeExecutions = 0;
      let releaseBarrier: (() => void) | null = null;
      const bothEntered = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });

      const interleavingUow = {
        async execute<T>(fn: () => Promise<T>): Promise<T> {
          activeExecutions++;
          if (activeExecutions >= 2) {
            releaseBarrier?.();
          } else {
            await bothEntered;
          }
          return await fn();
        },
      };

      const customPorts: RewardsPorts = {
        ...ports,
        unitOfWork: interleavingUow,
      };

      const [res1, res2] = await Promise.all([
        creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, customPorts),
        creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, customPorts),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const rewardedCount = [res1, res2].filter((r) => r.ok && r.value.rewarded).length;
      const duplicateCount = [res1, res2].filter((r) => r.ok && r.value.isDuplicate).length;
      expect(rewardedCount).toBe(1);
      expect(duplicateCount).toBe(1);

      const entries = await customPorts.ledger.getEntries(patientId);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe(`round-${patientId}-1`);
    });
  });

  describe("Rule 4: Patient's time zone, midnight rollover and DST", () => {
    it("rewards at most one task per local day in Europe/Helsinki", async () => {
      // First task marked done on Saturday 2026-11-14
      const first = await markTaskDone(patientActor, { patientId }, ports);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.value.rewarded).toBe(true);
        expect(first.value.rewardCents).toBe(100);
        expect(first.value.balanceCents).toBe(100);
      }

      // Second task marked done on the same Saturday 2026-11-14
      const second = await markTaskDone(patientActor, { patientId }, ports);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.rewarded).toBe(false);
        expect(second.value.rewardCents).toBe(0);
        expect(second.value.balanceCents).toBe(100);
      }

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.filter((e) => e.kind === "small_task").length).toBe(1);
    });

    it("rewards tasks on both sides of midnight in Europe/Helsinki even if same UTC day", async () => {
      // Clock at 23:55 Helsinki time on 2026-11-14 (UTC 21:55:00 on 2026-11-14)
      ports.clock.setTime("2026-11-14T21:55:00.000Z");

      const taskBeforeMidnight = await markTaskDone(patientActor, { patientId }, ports);
      expect(taskBeforeMidnight.ok).toBe(true);
      if (taskBeforeMidnight.ok) {
        expect(taskBeforeMidnight.value.localDate).toBe("2026-11-14");
        expect(taskBeforeMidnight.value.rewarded).toBe(true);
        expect(taskBeforeMidnight.value.balanceCents).toBe(100);
      }

      // Clock advances 10 minutes to 00:05 Helsinki time on 2026-11-15 (UTC 22:05:00 on 2026-11-14!)
      // Sunday 2026-11-15 is also a non-check-in day
      ports.clock.setTime("2026-11-14T22:05:00.000Z");

      const taskAfterMidnight = await markTaskDone(patientActor, { patientId }, ports);
      expect(taskAfterMidnight.ok).toBe(true);
      if (taskAfterMidnight.ok) {
        expect(taskAfterMidnight.value.localDate).toBe("2026-11-15");
        expect(taskAfterMidnight.value.rewarded).toBe(true);
        expect(taskAfterMidnight.value.balanceCents).toBe(200);
      }

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.filter((e) => e.kind === "small_task").length).toBe(2);
    });

    it("handles daylight-saving spring forward change in Europe/Helsinki", async () => {
      // 2026-03-29 is Sunday (non-check-in day) spring forward
      ports.clock.setTime("2026-03-29T10:00:00.000Z");

      const res = await readTodayTask(patientActor, { patientId }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.offered).toBe(true);
        expect(res.value.localDate).toBe("2026-03-29");
      }
    });
  });

  describe("Rule 5: Payout moves threshold amount out, simulated flag", () => {
    it("refuses payout if balance is under threshold", async () => {
      // Initial balance is 0
      const payoutRes = await requestPayout(
        patientActor,
        { patientId, requestId: "req-1" },
        ports
      );
      expect(payoutRes.ok).toBe(false);
      if (!payoutRes.ok) {
        expect(payoutRes.error).toBe("insufficient_balance");
      }
    });

    it("pays out exactly threshold amount and sets isSimulated: true", async () => {
      // Credit 10 rounds to reach 1000 cents
      for (let r = 1; r <= 10; r++) {
        ports.rounds.setRoundOutcome(patientId, {
          roundNumber: r,
          status: "answered",
        });
        await creditAnsweredRound(patientActor, { patientId, roundNumber: r }, ports);
      }

      const accountBefore = await readAccount(patientActor, { patientId }, ports);
      expect(accountBefore.ok).toBe(true);
      if (accountBefore.ok) {
        expect(accountBefore.value.balanceCents).toBe(1000);
        expect(accountBefore.value.payoutAvailable).toBe(true);
        expect(accountBefore.value.centsToPayout).toBe(0);
      }

      const payout = await requestPayout(
        patientActor,
        { patientId, requestId: "req-payout-1" },
        ports
      );
      expect(payout.ok).toBe(true);
      if (payout.ok) {
        expect(payout.value.payoutCents).toBe(1000);
        expect(payout.value.newBalanceCents).toBe(0);
        expect(payout.value.isSimulated).toBe(true);
        expect(payout.value.entry.isSimulated).toBe(true);
        expect(payout.value.isDuplicate).toBe(false);
      }

      const accountAfter = await readAccount(patientActor, { patientId }, ports);
      expect(accountAfter.ok).toBe(true);
      if (accountAfter.ok) {
        expect(accountAfter.value.balanceCents).toBe(0);
        expect(accountAfter.value.payoutAvailable).toBe(false);
        expect(accountAfter.value.centsToPayout).toBe(1000);
      }
    });

    it("does not pay twice on repeated payout request with same requestId", async () => {
      for (let r = 1; r <= 10; r++) {
        ports.rounds.setRoundOutcome(patientId, {
          roundNumber: r,
          status: "answered",
        });
        await creditAnsweredRound(patientActor, { patientId, roundNumber: r }, ports);
      }

      const firstPayout = await requestPayout(
        patientActor,
        { patientId, requestId: "req-dup-1" },
        ports
      );
      expect(firstPayout.ok).toBe(true);

      const secondPayout = await requestPayout(
        patientActor,
        { patientId, requestId: "req-dup-1" },
        ports
      );
      expect(secondPayout.ok).toBe(true);
      if (secondPayout.ok) {
        expect(secondPayout.value.isDuplicate).toBe(true);
        expect(secondPayout.value.newBalanceCents).toBe(0);
      }

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.filter((e) => e.kind === "payout").length).toBe(1);
    });

    it("requires a non-empty, valid requestId and writes nothing if invalid", async () => {
      // Balance is 1000
      for (let r = 1; r <= 10; r++) {
        ports.rounds.setRoundOutcome(patientId, { roundNumber: r, status: "answered" });
        await creditAnsweredRound(patientActor, { patientId, roundNumber: r }, ports);
      }

      // Empty string requestId
      const emptyRes = await requestPayout(
        patientActor,
        { patientId, requestId: "" },
        ports
      );
      expect(emptyRes.ok).toBe(false);
      if (!emptyRes.ok) {
        expect(emptyRes.error).toMatch(/requestId/i);
      }

      // Whitespace-only requestId
      const whitespaceRes = await requestPayout(
        patientActor,
        { patientId, requestId: "   " },
        ports
      );
      expect(whitespaceRes.ok).toBe(false);
      if (!whitespaceRes.ok) {
        expect(whitespaceRes.error).toMatch(/requestId/i);
      }

      // Missing requestId
      const missingPayload: Record<string, unknown> = { patientId };
      const missingRes = await requestPayout(
        patientActor,
        missingPayload as unknown as RequestPayoutInput,
        ports
      );
      expect(missingRes.ok).toBe(false);
      if (!missingRes.ok) {
        expect(missingRes.error).toMatch(/requestId/i);
      }

      // Overly long requestId (> 128 chars)
      const longRes = await requestPayout(
        patientActor,
        { patientId, requestId: "a".repeat(129) },
        ports
      );
      expect(longRes.ok).toBe(false);
      if (!longRes.ok) {
        expect(longRes.error).toMatch(/requestId/i);
      }

      // Ledger has 0 payouts
      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.filter((e) => e.kind === "payout").length).toBe(0);
    });

    it("produces one payout entry with patient-derived id when same request is sent twice at the same moment", async () => {
      for (let r = 1; r <= 10; r++) {
        ports.rounds.setRoundOutcome(patientId, { roundNumber: r, status: "answered" });
        await creditAnsweredRound(patientActor, { patientId, roundNumber: r }, ports);
      }

      const [payout1, payout2] = await Promise.all([
        requestPayout(patientActor, { patientId, requestId: "req-concurrent-same" }, ports),
        requestPayout(patientActor, { patientId, requestId: "req-concurrent-same" }, ports),
      ]);

      expect(payout1.ok).toBe(true);
      expect(payout2.ok).toBe(true);

      const duplicateCount = [payout1, payout2].filter((p) => p.ok && p.value.isDuplicate).length;
      expect(duplicateCount).toBe(1);

      const entries = await ports.ledger.getEntries(patientId);
      const payouts = entries.filter((e) => e.kind === "payout");
      expect(payouts.length).toBe(1);
      expect(payouts[0].id).toBe(`payout-${patientId}-req-concurrent-same`);
    });

    it("never takes balance below zero when two different requests arrive together and balance covers only one", async () => {
      // Credit exactly 1000 cents (1 payout threshold)
      for (let r = 1; r <= 10; r++) {
        ports.rounds.setRoundOutcome(patientId, { roundNumber: r, status: "answered" });
        await creditAnsweredRound(patientActor, { patientId, roundNumber: r }, ports);
      }

      const [resA, resB] = await Promise.all([
        requestPayout(patientActor, { patientId, requestId: "payout-req-A" }, ports),
        requestPayout(patientActor, { patientId, requestId: "payout-req-B" }, ports),
      ]);

      const successCount = [resA, resB].filter((r) => r.ok).length;
      const insufficientCount = [resA, resB].filter(
        (r) => !r.ok && r.error === "insufficient_balance"
      ).length;

      expect(successCount).toBe(1);
      expect(insufficientCount).toBe(1);

      const entries = await ports.ledger.getEntries(patientId);
      const payouts = entries.filter((e) => e.kind === "payout");
      expect(payouts.length).toBe(1);

      const account = await readAccount(patientActor, { patientId }, ports);
      expect(account.ok).toBe(true);
      if (account.ok) {
        expect(account.value.balanceCents).toBe(0);
      }
    });
  });

  describe("Rule 6 & 7: Task preferences, short walk default, deterministic rotation", () => {
    it("offers short walk with no choice made", async () => {
      const todayTask = await readTodayTask(patientActor, { patientId }, ports);
      expect(todayTask.ok).toBe(true);
      if (todayTask.ok) {
        expect(todayTask.value.offered).toBe(true);
        expect(todayTask.value.task?.key).toBe("short_walk");
      }
    });

    it("allows person to set and update preferred tasks subset", async () => {
      const setRes = await setPreferences(
        patientActor,
        {
          patientId,
          preferredTaskKeys: ["breathing_space", "bright_light"],
        },
        ports
      );
      expect(setRes.ok).toBe(true);
      if (setRes.ok) {
        expect(setRes.value.preferredTaskKeys).toEqual([
          "breathing_space",
          "bright_light",
        ]);
        expect(setRes.value.effectiveTasks.map((t) => t.key)).toEqual([
          "breathing_space",
          "bright_light",
        ]);
      }

      const readRes = await readPreferences(patientActor, { patientId }, ports);
      expect(readRes.ok).toBe(true);
      if (readRes.ok) {
        expect(readRes.value.preferredTaskKeys).toEqual([
          "breathing_space",
          "bright_light",
        ]);
      }
    });

    it("offers the same task all day once shown, even if preferences change", async () => {
      // 1. Initial preference: default (short walk)
      const firstView = await readTodayTask(patientActor, { patientId }, ports);
      expect(firstView.ok).toBe(true);
      if (firstView.ok) {
        expect(firstView.value.task?.key).toBe("short_walk");
      }

      // 2. Patient changes preference to only social_contact
      await setPreferences(
        patientActor,
        { patientId, preferredTaskKeys: ["social_contact"] },
        ports
      );

      // 3. Second view on the same day: still returns short_walk!
      const secondView = await readTodayTask(patientActor, { patientId }, ports);
      expect(secondView.ok).toBe(true);
      if (secondView.ok) {
        expect(secondView.value.task?.key).toBe("short_walk");
      }
    });
  });

  describe("Rule 8: Task offered only on non-check-in days, self_report source", () => {
    it("refuses task offering and completion on check-in days", async () => {
      // 2026-11-10 is a Tuesday (weekday 2 in helsinkiSchedule: check-in day!)
      ports.clock.setTime("2026-11-10T10:00:00.000Z");

      const readRes = await readTodayTask(patientActor, { patientId }, ports);
      expect(readRes.ok).toBe(true);
      if (readRes.ok) {
        expect(readRes.value.offered).toBe(false);
        expect(readRes.value.reason).toBe("check_in_day");
      }

      const doneRes = await markTaskDone(patientActor, { patientId }, ports);
      expect(doneRes.ok).toBe(false);
      if (!doneRes.ok) {
        expect(doneRes.error).toBe("No task offered on check-in days");
      }

      const notTodayRes = await markTaskNotToday(patientActor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(false);
      if (!notTodayRes.ok) {
        expect(notTodayRes.error).toBe("No task offered on check-in days");
      }
    });

    it("records source as self_report when task is marked done", async () => {
      const doneRes = await markTaskDone(patientActor, { patientId }, ports);
      expect(doneRes.ok).toBe(true);
      if (doneRes.ok) {
        expect(doneRes.value.source).toBe("self_report");
        expect(doneRes.value.isSimulated).toBe(true);
      }
    });
  });

  describe("Rule 9: Patient actor only, staff and other patients refused", () => {
    it("refuses clinic nurse and clinic admin for all reward and task use cases", async () => {
      for (const staff of [nurseActor, adminActor]) {
        const readAcc = await readAccount(staff, { patientId }, ports);
        expect(readAcc.ok).toBe(false);
        if (!readAcc.ok) expect(readAcc.error).toBe("refused_staff_forbidden");

        const credit = await creditAnsweredRound(
          staff,
          { patientId, roundNumber: 1 },
          ports
        );
        expect(credit.ok).toBe(false);
        if (!credit.ok) expect(credit.error).toBe("refused_staff_forbidden");

        const readTask = await readTodayTask(staff, { patientId }, ports);
        expect(readTask.ok).toBe(false);
        if (!readTask.ok) expect(readTask.error).toBe("refused_staff_forbidden");

        const done = await markTaskDone(staff, { patientId }, ports);
        expect(done.ok).toBe(false);
        if (!done.ok) expect(done.error).toBe("refused_staff_forbidden");

        const notToday = await markTaskNotToday(staff, { patientId }, ports);
        expect(notToday.ok).toBe(false);
        if (!notToday.ok) expect(notToday.error).toBe("refused_staff_forbidden");

        const readPref = await readPreferences(staff, { patientId }, ports);
        expect(readPref.ok).toBe(false);
        if (!readPref.ok) expect(readPref.error).toBe("refused_staff_forbidden");

        const setPref = await setPreferences(
          staff,
          { patientId, preferredTaskKeys: ["short_walk"] },
          ports
        );
        expect(setPref.ok).toBe(false);
        if (!setPref.ok) expect(setPref.error).toBe("refused_staff_forbidden");

        const payout = await requestPayout(
          staff,
          { patientId, requestId: "req-payout" },
          ports
        );
        expect(payout.ok).toBe(false);
        if (!payout.ok) expect(payout.error).toBe("refused_staff_forbidden");
      }
    });

    it("refuses other patients from accessing or changing data", async () => {
      const readAcc = await readAccount(otherPatientActor, { patientId }, ports);
      expect(readAcc.ok).toBe(false);
      if (!readAcc.ok) expect(readAcc.error).toBe("refused_not_own_data");

      const setPref = await setPreferences(
        otherPatientActor,
        { patientId, preferredTaskKeys: ["short_walk"] },
        ports
      );
      expect(setPref.ok).toBe(false);
      if (!setPref.ok) expect(setPref.error).toBe("refused_not_own_data");
    });

    it("refuses system actor from accessing patient reward data", async () => {
      const readAcc = await readAccount(systemActor, { patientId }, ports);
      expect(readAcc.ok).toBe(false);
      if (!readAcc.ok) expect(readAcc.error).toBe("refused_patient_only");
    });
  });

  describe("Rule 10: Visible plain counts that never reset or go down", () => {
    it("tracks tasksDone and roundsAnswered counts without streak mechanics", async () => {
      // 1. Complete task on day 1
      ports.clock.setTime("2026-11-08T10:00:00.000Z"); // Sunday
      await markTaskDone(patientActor, { patientId }, ports);

      // 2. Answer round 1
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });
      await creditAnsweredRound(patientActor, { patientId, roundNumber: 1 }, ports);

      let summary = await readAccount(patientActor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.tasksDone).toBe(1);
        expect(summary.value.counts.roundsAnswered).toBe(1);
      }

      // 3. Mark task "Not today" on day 2: count does NOT go down
      ports.clock.setTime("2026-11-09T10:00:00.000Z"); // Monday
      await markTaskNotToday(patientActor, { patientId }, ports);

      summary = await readAccount(patientActor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.tasksDone).toBe(1);
      }

      // 4. Complete task on day 3: count increments to 2
      ports.clock.setTime("2026-11-11T10:00:00.000Z"); // Wednesday
      await markTaskDone(patientActor, { patientId }, ports);

      summary = await readAccount(patientActor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.tasksDone).toBe(2);
        expect(summary.value.counts.roundsAnswered).toBe(1);
      }
    });

    it("Done then Not today on the same local date leaves the record completed, the ledger unchanged and the count unchanged", async () => {
      // 1. Patient completes the task
      const doneRes = await markTaskDone(patientActor, { patientId }, ports);
      expect(doneRes.ok).toBe(true);
      if (doneRes.ok) {
        expect(doneRes.value.status).toBe("completed");
        expect(doneRes.value.rewarded).toBe(true);
        expect(doneRes.value.rewardCents).toBe(100);
      }

      const initialRecord = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(initialRecord?.status).toBe("completed");
      expect(initialRecord?.completedAt).toBeDefined();

      const accountBefore = await readAccount(patientActor, { patientId }, ports);
      expect(accountBefore.ok).toBe(true);
      if (accountBefore.ok) {
        expect(accountBefore.value.counts.tasksDone).toBe(1);
        expect(accountBefore.value.balanceCents).toBe(100);
      }

      // 2. Patient subsequently marks "Not today" on the same day
      const notTodayRes = await markTaskNotToday(patientActor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(true);
      if (notTodayRes.ok) {
        // Answers with completed state
        expect(notTodayRes.value.status).toBe("completed");
        expect(notTodayRes.value.rewarded).toBe(false);
      }

      // Record remains completed and was not overwritten
      const finalRecord = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(finalRecord?.status).toBe("completed");
      expect(finalRecord?.completedAt).toBe(initialRecord?.completedAt);

      // Ledger unchanged
      const ledgerEntries = await ports.ledger.getEntries(patientId);
      expect(ledgerEntries.length).toBe(1);

      // Visible count never went down
      const accountAfter = await readAccount(patientActor, { patientId }, ports);
      expect(accountAfter.ok).toBe(true);
      if (accountAfter.ok) {
        expect(accountAfter.value.counts.tasksDone).toBe(1);
        expect(accountAfter.value.balanceCents).toBe(100);
      }
    });

    it("Not today then Done on the same local date marks it completed and credits once", async () => {
      // 1. Patient first marks "Not today"
      const notTodayRes = await markTaskNotToday(patientActor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(true);
      if (notTodayRes.ok) {
        expect(notTodayRes.value.status).toBe("not_today");
        expect(notTodayRes.value.rewarded).toBe(false);
      }

      const recordBefore = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(recordBefore?.status).toBe("not_today");

      const accountBefore = await readAccount(patientActor, { patientId }, ports);
      expect(accountBefore.ok).toBe(true);
      if (accountBefore.ok) {
        expect(accountBefore.value.counts.tasksDone).toBe(0);
        expect(accountBefore.value.balanceCents).toBe(0);
      }

      // 2. Patient changes their mind and marks "Done" on the same day
      const doneRes = await markTaskDone(patientActor, { patientId }, ports);
      expect(doneRes.ok).toBe(true);
      if (doneRes.ok) {
        expect(doneRes.value.status).toBe("completed");
        expect(doneRes.value.rewarded).toBe(true);
        expect(doneRes.value.rewardCents).toBe(100);
        expect(doneRes.value.balanceCents).toBe(100);
      }

      const recordAfter = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(recordAfter?.status).toBe("completed");
      expect(recordAfter?.completedAt).toBeDefined();

      const accountAfter = await readAccount(patientActor, { patientId }, ports);
      expect(accountAfter.ok).toBe(true);
      if (accountAfter.ok) {
        expect(accountAfter.value.counts.tasksDone).toBe(1);
        expect(accountAfter.value.balanceCents).toBe(100);
      }
    });

    it("markTaskDone called again on an already completed task preserves original completion timestamps and changes nothing", async () => {
      // 1. Mark task done initially
      ports.clock.setTime("2026-11-14T10:00:00.000Z");
      const done1 = await markTaskDone(patientActor, { patientId }, ports);
      expect(done1.ok).toBe(true);
      if (done1.ok) {
        expect(done1.value.rewarded).toBe(true);
      }

      const record1 = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(record1?.completedAt).toBe("2026-11-14T10:00:00.000Z");
      expect(record1?.respondedAt).toBe("2026-11-14T10:00:00.000Z");

      // 2. Mark task done later that day
      ports.clock.setTime("2026-11-14T14:30:00.000Z");
      const done2 = await markTaskDone(patientActor, { patientId }, ports);
      expect(done2.ok).toBe(true);
      if (done2.ok) {
        expect(done2.value.rewarded).toBe(false);
        expect(done2.value.rewardCents).toBe(0);
        expect(done2.value.balanceCents).toBe(100);
      }

      const record2 = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(record2?.completedAt).toBe("2026-11-14T10:00:00.000Z");
      expect(record2?.respondedAt).toBe("2026-11-14T10:00:00.000Z");

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries.filter((e) => e.kind === "small_task").length).toBe(1);
    });
  });

  describe("Rule 11: Enabled configuration switch", () => {
    it("answers 'not enabled' and writes nothing across all use cases when enabled: false", async () => {
      const disabledPorts = createFakeRewardsPorts({
        config: { enabled: false },
        clockTime: "2026-11-14T10:00:00.000Z",
      });
      disabledPorts.patients.setPatient({
        patientId,
        clinicId,
        schedule: helsinkiSchedule,
      });

      const accRes = await readAccount(patientActor, { patientId }, disabledPorts);
      expect(accRes.ok).toBe(false);
      if (!accRes.ok) expect(accRes.error).toBe("not enabled");

      const creditRes = await creditAnsweredRound(
        patientActor,
        { patientId, roundNumber: 1 },
        disabledPorts
      );
      expect(creditRes.ok).toBe(false);
      if (!creditRes.ok) expect(creditRes.error).toBe("not enabled");

      const taskRes = await readTodayTask(patientActor, { patientId }, disabledPorts);
      expect(taskRes.ok).toBe(false);
      if (!taskRes.ok) expect(taskRes.error).toBe("not enabled");

      const doneRes = await markTaskDone(patientActor, { patientId }, disabledPorts);
      expect(doneRes.ok).toBe(false);
      if (!doneRes.ok) expect(doneRes.error).toBe("not enabled");

      const notTodayRes = await markTaskNotToday(
        patientActor,
        { patientId },
        disabledPorts
      );
      expect(notTodayRes.ok).toBe(false);
      if (!notTodayRes.ok) expect(notTodayRes.error).toBe("not enabled");

      const readPrefRes = await readPreferences(
        patientActor,
        { patientId },
        disabledPorts
      );
      expect(readPrefRes.ok).toBe(false);
      if (!readPrefRes.ok) expect(readPrefRes.error).toBe("not enabled");

      const setPrefRes = await setPreferences(
        patientActor,
        { patientId, preferredTaskKeys: ["short_walk"] },
        disabledPorts
      );
      expect(setPrefRes.ok).toBe(false);
      if (!setPrefRes.ok) expect(setPrefRes.error).toBe("not enabled");

      const payoutRes = await requestPayout(
        patientActor,
        { patientId, requestId: "req-payout" },
        disabledPorts
      );
      expect(payoutRes.ok).toBe(false);
      if (!payoutRes.ok) expect(payoutRes.error).toBe("not enabled");

      // Verify that absolutely nothing was written to ledger or taskRecords or preferences
      expect(disabledPorts.ledger.getAllEntries().length).toBe(0);
      expect(await disabledPorts.taskRecords.getHistory(patientId)).toEqual([]);
      expect(await disabledPorts.preferences.getPreferences(patientId)).toBeNull();
    });
  });
});
