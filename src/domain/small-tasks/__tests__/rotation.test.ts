import { describe, expect, it } from "vitest";
import type { Schedule } from "../../rounds/types";
import {
  createTaskRecord,
  determineOfferedTask,
  isCheckInDay,
} from "../rotation";
import type { TaskKey, TaskRecord } from "../types";

describe("Small Tasks Rotation & Offering Domain Logic", () => {
  const helsinkiSchedule: Schedule = {
    weekdays: [2, 5], // Tuesday and Friday check-in days
    timeOfDay: "09:00",
    timeZone: "Europe/Helsinki",
    enrolmentDate: "2026-11-01",
  };

  describe("Rule 4: Patient's time zone, both sides of midnight in Europe/Helsinki and DST", () => {
    it("distinguishes calendar days on both sides of midnight in Europe/Helsinki", () => {
      // 2026-11-14 23:55 local Helsinki time is UTC 2026-11-14 21:55 (Helsinki is UTC+2 in winter)
      const beforeMidnightUtc = "2026-11-14T21:55:00.000Z";
      const before = isCheckInDay(beforeMidnightUtc, helsinkiSchedule);
      expect(before.localDate).toBe("2026-11-14");

      // 2026-11-15 00:05 local Helsinki time is UTC 2026-11-14 22:05 (still 2026-11-14 in UTC!)
      const afterMidnightUtc = "2026-11-14T22:05:00.000Z";
      const after = isCheckInDay(afterMidnightUtc, helsinkiSchedule);
      expect(after.localDate).toBe("2026-11-15");

      // Verify they are two different days in the patient's time zone
      expect(before.localDate).not.toBe(after.localDate);
    });

    it("correctly identifies dates across spring forward DST change in Europe/Helsinki", () => {
      // Spring forward in Europe/Helsinki occurs on Sunday 2026-03-29 (UTC+2 -> UTC+3)
      // At 2026-03-29 01:50 UTC (03:50 EET -> transitioning to 04:50 EEST):
      const springDayUtc = "2026-03-29T01:50:00.000Z";
      const spring = isCheckInDay(springDayUtc, helsinkiSchedule);
      expect(spring.localDate).toBe("2026-03-29");

      // 24 hours later (2026-03-30 in EEST):
      const nextDayUtc = "2026-03-30T01:50:00.000Z";
      const nextDay = isCheckInDay(nextDayUtc, helsinkiSchedule);
      expect(nextDay.localDate).toBe("2026-03-30");
    });

    it("correctly identifies dates across fall back DST change in Europe/Helsinki", () => {
      // Fall back in Europe/Helsinki occurs on Sunday 2026-10-25 (UTC+3 -> UTC+2)
      const fallDayUtc = "2026-10-25T01:30:00.000Z";
      const fall = isCheckInDay(fallDayUtc, helsinkiSchedule);
      expect(fall.localDate).toBe("2026-10-25");

      const nextDayUtc = "2026-10-26T01:30:00.000Z";
      const nextDay = isCheckInDay(nextDayUtc, helsinkiSchedule);
      expect(nextDay.localDate).toBe("2026-10-26");
    });
  });

  describe("Rule 7: Deterministic rotation over history, default to short walk, same all day", () => {
    it("offers short walk with no choice made (empty or null preferences)", () => {
      const taskEmpty = determineOfferedTask({
        preferredKeys: [],
        history: [],
        localDate: "2026-11-14",
      });
      expect(taskEmpty.key).toBe("short_walk");

      const taskNull = determineOfferedTask({
        preferredKeys: null,
        history: [],
        localDate: "2026-11-14",
      });
      expect(taskNull.key).toBe("short_walk");
    });

    it("rotates deterministically through preferred tasks based on distinct prior history dates", () => {
      const preferred: TaskKey[] = ["short_walk", "breathing_space", "bright_light"];

      // Day 1 (no prior history): index 0 -> short_walk
      const task1 = determineOfferedTask({
        preferredKeys: preferred,
        history: [],
        localDate: "2026-11-14",
      });
      expect(task1.key).toBe("short_walk");

      // Day 2 (1 prior day): index 1 -> breathing_space
      const historyDay1: TaskRecord[] = [
        createTaskRecord({
          id: "r1",
          patientId: "p1",
          localDate: "2026-11-14",
          taskKey: "short_walk",
          status: "completed",
        }),
      ];
      const task2 = determineOfferedTask({
        preferredKeys: preferred,
        history: historyDay1,
        localDate: "2026-11-15",
      });
      expect(task2.key).toBe("breathing_space");

      // Day 3 (2 prior days): index 2 -> bright_light
      const historyDay2: TaskRecord[] = [
        ...historyDay1,
        createTaskRecord({
          id: "r2",
          patientId: "p1",
          localDate: "2026-11-15",
          taskKey: "breathing_space",
          status: "completed",
        }),
      ];
      const task3 = determineOfferedTask({
        preferredKeys: preferred,
        history: historyDay2,
        localDate: "2026-11-16",
      });
      expect(task3.key).toBe("bright_light");

      // Day 4 (3 prior days): index 0 -> short_walk (rotation loops)
      const historyDay3: TaskRecord[] = [
        ...historyDay2,
        createTaskRecord({
          id: "r3",
          patientId: "p1",
          localDate: "2026-11-16",
          taskKey: "bright_light",
          status: "not_today",
        }),
      ];
      const task4 = determineOfferedTask({
        preferredKeys: preferred,
        history: historyDay3,
        localDate: "2026-11-17",
      });
      expect(task4.key).toBe("short_walk");
    });

    it("gives the exact same offer for identical inputs (no randomness)", () => {
      const preferred: TaskKey[] = ["breathing_space", "social_contact"];
      const history: TaskRecord[] = [
        createTaskRecord({
          id: "r1",
          patientId: "p1",
          localDate: "2026-11-10",
          taskKey: "breathing_space",
          status: "completed",
        }),
      ];

      const run1 = determineOfferedTask({
        preferredKeys: preferred,
        history,
        localDate: "2026-11-14",
      });
      const run2 = determineOfferedTask({
        preferredKeys: preferred,
        history,
        localDate: "2026-11-14",
      });
      expect(run1.key).toBe(run2.key);
    });

    it("offers the exact same task all day once shown, even if preferences change", () => {
      const historyWithTodayShown: TaskRecord[] = [
        createTaskRecord({
          id: "r-today",
          patientId: "p1",
          localDate: "2026-11-14",
          taskKey: "bright_light",
          status: "offered",
        }),
      ];

      // Even if user changes preferences to only social_contact
      const task = determineOfferedTask({
        preferredKeys: ["social_contact"],
        history: historyWithTodayShown,
        localDate: "2026-11-14",
      });
      expect(task.key).toBe("bright_light");
    });
  });

  describe("Rule 8: Only offered on non-check-in days, self_report source", () => {
    it("identifies check-in days vs non-check-in days", () => {
      // 2026-11-10 is a Tuesday (weekday 2 in helsinkiSchedule: check-in day)
      const tuesdayUtc = "2026-11-10T10:00:00.000Z";
      expect(isCheckInDay(tuesdayUtc, helsinkiSchedule).isCheckIn).toBe(true);

      // 2026-11-11 is a Wednesday (weekday 3: non-check-in day)
      const wednesdayUtc = "2026-11-11T10:00:00.000Z";
      expect(isCheckInDay(wednesdayUtc, helsinkiSchedule).isCheckIn).toBe(false);

      // 2026-11-13 is a Friday (weekday 5 in helsinkiSchedule: check-in day)
      const fridayUtc = "2026-11-13T10:00:00.000Z";
      expect(isCheckInDay(fridayUtc, helsinkiSchedule).isCheckIn).toBe(true);

      // 2026-11-14 is a Saturday (weekday 6: non-check-in day)
      const saturdayUtc = "2026-11-14T10:00:00.000Z";
      expect(isCheckInDay(saturdayUtc, helsinkiSchedule).isCheckIn).toBe(false);
    });

    it("creates task records with source: self_report and isSimulated: true", () => {
      const record = createTaskRecord({
        id: "tr1",
        patientId: "p1",
        localDate: "2026-11-14",
        taskKey: "short_walk",
        status: "completed",
        completedAt: "2026-11-14T15:00:00.000Z",
      });

      expect(record.source).toBe("self_report");
      expect(record.isSimulated).toBe(true);
      expect(record.status).toBe("completed");
    });
  });
});
