import { beforeEach, describe, expect, it } from "vitest";
import type { PatientActor } from "../../../domain/access/types";
import type { Schedule } from "../../../domain/rounds/types";
import type { TaskKey } from "../../../domain/small-tasks/types";
import { creditAnsweredRound, creditCheckInRound } from "../credit-answered-round";
import { markTaskDone } from "../mark-task-done";
import { markTaskNotToday } from "../mark-task-not-today";
import { setPreferences } from "../preferences";
import { readAccount } from "../read-account";
import { readTodayTask } from "../read-today-task";
import { createFakeRewardsPorts, type FakeRewardsPorts } from "../testing/fake-ports";

describe("Rewards and Small Tasks Use Cases (D48, D38, D42)", () => {
  const patientId = "patient-001";
  const clinicId = "clinic-001";
  const actor: PatientActor = { kind: "patient", patientId, clinicId };

  const schedule: Schedule = {
    weekdays: [2, 5], // Tue, Fri check-ins
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
    ports.patients.setPatient({
      patientId,
      clinicId,
      schedule,
    });
  });

  describe("Gap 1: Missing credits & duplicate refusal (D48)", () => {
    it("credits an answered round once", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const res1 = await creditAnsweredRound(actor, { patientId, roundNumber: 1 }, ports);
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.value.rewarded).toBe(true);
        expect(res1.value.amountCents).toBe(100);
        expect(res1.value.balanceCents).toBe(100);
      }

      const res2 = await creditAnsweredRound(actor, { patientId, roundNumber: 1 }, ports);
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.value.rewarded).toBe(false); // Duplicate
        expect(res2.value.isDuplicate).toBe(true);
        expect(res2.value.balanceCents).toBe(100);
      }
    });

    it("shared creditCheckInRound credits answered round once and prevents duplicate on retry", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const res1 = await creditCheckInRound(actor, { patientId, roundNumber: 1 }, ports);
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.value.rewarded).toBe(true);
        expect(res1.value.balanceCents).toBe(100);
      }

      // Retry after save or duplicate call from another device
      const res2 = await creditCheckInRound(actor, { patientId, roundNumber: 1 }, ports);
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.value.rewarded).toBe(false);
        expect(res2.value.isDuplicate).toBe(true);
        expect(res2.value.balanceCents).toBe(100);
      }

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries).toHaveLength(1);
    });

    it("does not credit a missed round or 'not_today' round", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 2,
        status: "missed",
      });

      const res = await creditAnsweredRound(actor, { patientId, roundNumber: 2 }, ports);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.rewarded).toBe(false);
        expect(res.value.reason).toBe("round_not_answered");
        expect(res.value.balanceCents).toBe(0);
      }

      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 3,
        status: "not_today",
      });

      const resNotToday = await creditAnsweredRound(actor, { patientId, roundNumber: 3 }, ports);
      expect(resNotToday.ok).toBe(true);
      if (resNotToday.ok) {
        expect(resNotToday.value.rewarded).toBe(false);
        expect(resNotToday.value.balanceCents).toBe(0);
      }
    });

    it("concurrent calls for the same round credit exactly once", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });

      const [res1, res2] = await Promise.all([
        creditCheckInRound(actor, { patientId, roundNumber: 1 }, ports),
        creditCheckInRound(actor, { patientId, roundNumber: 1 }, ports),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const rewardedCount = [res1, res2].filter((r) => r.ok && r.value.rewarded).length;
      const duplicateCount = [res1, res2].filter((r) => r.ok && r.value.isDuplicate).length;
      expect(rewardedCount).toBe(1);
      expect(duplicateCount).toBe(1);

      const entries = await ports.ledger.getEntries(patientId);
      expect(entries).toHaveLength(1);
    });

    it("does not credit when disabled", async () => {
      const disabledPorts = createFakeRewardsPorts({ config: { enabled: false } });
      disabledPorts.rounds.setRoundOutcome(patientId, {
        roundNumber: 3,
        status: "answered",
      });

      const res = await creditAnsweredRound(actor, { patientId, roundNumber: 3 }, disabledPorts);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("not enabled");
      }
    });
  });

  describe("Gap 2: The walks count (D38, D42)", () => {
    it("readAccount returns walks count beside roundsAnswered count", async () => {
      ports.rounds.setRoundOutcome(patientId, {
        roundNumber: 1,
        status: "answered",
      });
      await creditCheckInRound(actor, { patientId, roundNumber: 1 }, ports);

      // Complete a short walk on Saturday 2026-11-14 (default task is short_walk)
      const walkRes = await markTaskDone(actor, { patientId }, ports);
      expect(walkRes.ok).toBe(true);
      if (walkRes.ok) {
        expect(walkRes.value.task.key).toBe("short_walk");
      }

      const summary = await readAccount(actor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.roundsAnswered).toBe(1);
        expect(summary.value.counts.walks).toBe(1);
        expect(summary.value.counts.tasksDone).toBe(1);
      }
    });

    it("walks count increments only for completed short_walk, not for other tasks", async () => {
      // Set preferences to breathing_space and bright_light
      await setPreferences(
        actor,
        { patientId, preferredTaskKeys: ["breathing_space", "bright_light"] },
        ports
      );

      // Complete breathing_space on Saturday 2026-11-14
      const taskRes = await markTaskDone(actor, { patientId }, ports);
      expect(taskRes.ok).toBe(true);
      if (taskRes.ok) {
        expect(taskRes.value.task.key).toBe("breathing_space");
      }

      const summary = await readAccount(actor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.tasksDone).toBe(1);
        expect(summary.value.counts.walks).toBe(0); // Not a walk!
      }
    });

    it("walks count never resets and never goes down on missed or Not today days", async () => {
      // Day 1 (Saturday 2026-11-14): complete a walk
      await markTaskDone(actor, { patientId }, ports);

      let summary = await readAccount(actor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.walks).toBe(1);
      }

      // Day 2 (Sunday 2026-11-15): mark Not today
      ports.clock.setTime("2026-11-15T10:00:00.000Z");
      await markTaskNotToday(actor, { patientId }, ports);

      summary = await readAccount(actor, { patientId }, ports);
      expect(summary.ok).toBe(true);
      if (summary.ok) {
        expect(summary.value.counts.walks).toBe(1); // Never reset, never decreased
      }
    });
  });

  describe("Gap 3: An undone task must have no effect (D48)", () => {
    it("readTodayTask does NOT save an 'offered' record in storage", async () => {
      const readRes = await readTodayTask(actor, { patientId }, ports);
      expect(readRes.ok).toBe(true);
      if (readRes.ok) {
        expect(readRes.value.offered).toBe(true);
        expect(readRes.value.status).toBe("offered");
        expect(readRes.value.task?.key).toBe("short_walk");
      }

      // Verify taskRecords has NO entry saved for today
      const stored = await ports.taskRecords.getTaskRecord(patientId, "2026-11-14");
      expect(stored).toBeNull();

      const history = await ports.taskRecords.getHistory(patientId);
      expect(history).toHaveLength(0);
    });

    it("viewing today's task and leaving it undone does not move rotation the next day", async () => {
      const preferred: TaskKey[] = ["short_walk", "breathing_space", "bright_light"];
      await setPreferences(actor, { patientId, preferredTaskKeys: preferred }, ports);

      // Day 1 (Saturday 2026-11-14): Patient views today's task
      const day1 = await readTodayTask(actor, { patientId }, ports);
      expect(day1.ok).toBe(true);
      if (day1.ok) {
        expect(day1.value.task?.key).toBe("short_walk");
      }

      // Patient does not complete it, does not click anything (leaves it undone)

      // Day 2 (Sunday 2026-11-15): Patient returns next day
      ports.clock.setTime("2026-11-15T10:00:00.000Z");
      const day2 = await readTodayTask(actor, { patientId }, ports);
      expect(day2.ok).toBe(true);
      if (day2.ok) {
        // Since Day 1 task was NOT done, the rotation MUST NOT have moved on!
        expect(day2.value.task?.key).toBe("short_walk");
      }
    });

    it("marking 'Not today' does not move rotation the next day (rotation moves ONLY when done)", async () => {
      const preferred: TaskKey[] = ["short_walk", "breathing_space", "bright_light"];
      await setPreferences(actor, { patientId, preferredTaskKeys: preferred }, ports);

      // Day 1 (Saturday 2026-11-14): Patient says Not today
      const notTodayRes = await markTaskNotToday(actor, { patientId }, ports);
      expect(notTodayRes.ok).toBe(true);

      // Day 2 (Sunday 2026-11-15): Patient returns next day
      ports.clock.setTime("2026-11-15T10:00:00.000Z");
      const day2 = await readTodayTask(actor, { patientId }, ports);
      expect(day2.ok).toBe(true);
      if (day2.ok) {
        // Rotation moves only when a task is completed, so Day 2 is still short_walk
        expect(day2.value.task?.key).toBe("short_walk");
      }
    });

    it("completing a task DOES advance the rotation the next day", async () => {
      const preferred: TaskKey[] = ["short_walk", "breathing_space", "bright_light"];
      await setPreferences(actor, { patientId, preferredTaskKeys: preferred }, ports);

      // Day 1 (Saturday 2026-11-14): Patient completes short_walk
      const doneRes = await markTaskDone(actor, { patientId }, ports);
      expect(doneRes.ok).toBe(true);
      if (doneRes.ok) {
        expect(doneRes.value.task.key).toBe("short_walk");
      }

      // Day 2 (Sunday 2026-11-15): Patient returns next day
      ports.clock.setTime("2026-11-15T10:00:00.000Z");
      const day2 = await readTodayTask(actor, { patientId }, ports);
      expect(day2.ok).toBe(true);
      if (day2.ok) {
        // Since Day 1 task WAS completed, rotation advances to index 1 -> breathing_space
        expect(day2.value.task?.key).toBe("breathing_space");
      }
    });
  });
});
