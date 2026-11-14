import { describe, expect, it } from "vitest";
import {
  computeBaselineDeviation,
  computeInterdailyStability,
  computeIntradailyVariability,
  computePersonalBaseline,
  computeRelativeAmplitude,
  computeRhythmWindow,
  computeSleepRegularityIndex,
  DEFAULT_SIGNALS_CONFIG,
} from "../index";
import type { DayActivityInput, DaySleepInput, DayWindowInput } from "../types";

describe("Rulings a through f for missing and short data", () => {
  const normalDayHourly: number[] = [
    ...new Array(8).fill(0),
    ...new Array(10).fill(40),
    ...new Array(6).fill(10),
  ];
  const normalSleepGrid = "1".repeat(480) + "0".repeat(960);

  // Ruling a: A measure over fewer than seven valid days gives no value, with the reason.
  // Seven is a config value.
  describe("Ruling a: minimum valid days requirement", () => {
    it("IS gives no value with reason when valid days < 7", () => {
      const sixDays: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: normalDayHourly,
      }));
      const res = computeInterdailyStability(sixDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days");
        expect(res.error).toContain("found 6");
      }
    });

    it("IV gives no value with reason when valid days < 7", () => {
      const sixDays: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: normalDayHourly,
      }));
      const res = computeIntradailyVariability(sixDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days");
      }
    });

    it("RA gives no value with reason when valid days < 7", () => {
      const sixDays: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: normalDayHourly,
      }));
      const res = computeRelativeAmplitude(sixDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days");
      }
    });

    it("SRI gives no value with reason when days < 7", () => {
      const sixDays: DaySleepInput[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        sleepWakeGrid: normalSleepGrid,
      }));
      const res = computeSleepRegularityIndex(sixDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days");
      }
    });

    it("RhythmWindow gives no value with reason when valid days < 7", () => {
      const sixDays: DayWindowInput[] = Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        dayIndex: i + 1,
        hourlyActivity: normalDayHourly,
        sleepWakeGrid: normalSleepGrid,
      }));
      const res = computeRhythmWindow(sixDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days");
      }
    });

    it("Seven is a config value that can be overridden", () => {
      const fiveDays: DayActivityInput[] = Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: normalDayHourly,
      }));
      expect(DEFAULT_SIGNALS_CONFIG.minValidDays).toBe(7);
      const res = computeInterdailyStability(fiveDays, { minValidDays: 5 });
      expect(res.ok).toBe(true);
    });
  });

  // Ruling b: An hour with no data is missing, never zero.
  // A day with fewer than a configured number of valid hours (default 20 of 24) is not a valid day.
  // Missing hours in a valid day are left out of the sums, not filled in.
  describe("Ruling b: missing hours and day validity threshold", () => {
    it("treats day with 19 valid hours as invalid (< 20)", () => {
      const day19Hours: (number | null)[] = [
        ...new Array(5).fill(null), // 5 missing -> 19 valid
        ...new Array(19).fill(25),
      ];
      const days: DayActivityInput[] = [
        ...Array.from({ length: 6 }, (_, i) => ({
          date: `2026-03-0${i + 1}`,
          hourlyActivity: normalDayHourly,
        })),
        { date: "2026-03-07", hourlyActivity: day19Hours },
      ];
      const res = computeInterdailyStability(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Insufficient valid days: found 6");
      }
    });

    it("accepts day with exactly 20 valid hours and leaves missing hours out of sums", () => {
      const day20Hours: (number | null)[] = [
        null, null, null, null, // 4 missing hours
        ...new Array(8).fill(0),
        ...new Array(10).fill(40),
        ...new Array(2).fill(10),
      ]; // 20 valid hours
      const days: DayActivityInput[] = [
        ...Array.from({ length: 6 }, (_, i) => ({
          date: `2026-03-0${i + 1}`,
          hourlyActivity: normalDayHourly,
        })),
        { date: "2026-03-07", hourlyActivity: day20Hours },
      ];
      const res = computeInterdailyStability(days);
      expect(res.ok).toBe(true);
    });
  });

  // Ruling c: A measure whose formula would divide by zero (for example a completely flat signal)
  // gives no value, with the reason, never NaN or Infinity.
  describe("Ruling c: division by zero and flat signals", () => {
    const flatDay = new Array(24).fill(15);
    const flatDays: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-0${i + 1}`,
      hourlyActivity: flatDay,
    }));

    it("IS on flat signal returns error with reason, never NaN", () => {
      const res = computeInterdailyStability(flatDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/division by zero|zero variance|flat signal/i);
      }
    });

    it("IV on flat signal returns error with reason, never NaN", () => {
      const res = computeIntradailyVariability(flatDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/division by zero|zero variance|flat signal/i);
      }
    });

    it("RA on flat signal returns error with reason, never NaN", () => {
      const res = computeRelativeAmplitude(flatDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/flat signal|zero contrast|divide by zero/i);
      }
    });

    it("RA on all-zero signal returns error with reason, never NaN", () => {
      const zeroDays: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: new Array(24).fill(0),
      }));
      const res = computeRelativeAmplitude(zeroDays);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/flat signal|zero|divide by zero/i);
      }
    });
  });

  // Ruling d: The SRI uses only pairs of minutes where both days have data, and gives no value
  // when fewer than a configured share of pairs is usable.
  describe("Ruling d: SRI minute pair coverage requirement", () => {
    it("refuses SRI when usable minute pairs fall below configured share", () => {
      const days: DaySleepInput[] = [
        { date: "2026-03-01", sleepWakeGrid: normalSleepGrid },
        { date: "2026-03-02", sleepWakeGrid: normalSleepGrid },
        { date: "2026-03-03", sleepWakeGrid: null }, // missing
        { date: "2026-03-04", sleepWakeGrid: null }, // missing
        { date: "2026-03-05", sleepWakeGrid: normalSleepGrid },
        { date: "2026-03-06", sleepWakeGrid: normalSleepGrid },
        { date: "2026-03-07", sleepWakeGrid: normalSleepGrid },
      ];
      // In 7 days (6 possible transitions), missing days 3 and 4 break transitions 2->3, 3->4, 4->5.
      // Only 3 transitions remain (1->2, 5->6, 6->7) -> 3/6 = 50% usable < 70% threshold.
      const res = computeSleepRegularityIndex(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/usable minute pairs/i);
      }
    });
  });

  // Ruling e: A baseline from fewer than a configured number of values (default 7) gives no baseline;
  // a baseline with zero spread gives no z-score, with the reason.
  describe("Ruling e: baseline sample count and zero spread", () => {
    it("refuses baseline with fewer than 7 values", () => {
      const res = computePersonalBaseline([1, 2, 3, 4, 5, 6]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/insufficient sample count/i);
      }
    });

    it("refuses z-score when baseline standard deviation is zero", () => {
      const baselineRes = computePersonalBaseline([10, 10, 10, 10, 10, 10, 10]);
      expect(baselineRes.ok).toBe(true);
      if (!baselineRes.ok) return;

      const devRes = computeBaselineDeviation(baselineRes.value, 15);
      expect(devRes.ok).toBe(false);
      if (!devRes.ok) {
        expect(devRes.error).toMatch(/zero spread|standard deviation is zero/i);
      }
    });
  });

  // Ruling f: Inputs that are not finite numbers, negative activity, strings of the wrong length
  // or with other characters than the two states are refused with an error.
  describe("Ruling f: input validation errors", () => {
    it("refuses negative activity in hourly array", () => {
      const badHourly = new Array(24).fill(10);
      badHourly[4] = -0.5;
      const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: i === 0 ? badHourly : normalDayHourly,
      }));
      const res = computeInterdailyStability(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/negative/i);
      }
    });

    it("refuses NaN in hourly activity", () => {
      const badHourly = new Array(24).fill(10);
      badHourly[2] = NaN;
      const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: i === 0 ? badHourly : normalDayHourly,
      }));
      const res = computeInterdailyStability(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/finite/i);
      }
    });

    it("refuses hourly activity with wrong length", () => {
      const badHourly = new Array(23).fill(10); // 23 instead of 24
      const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: i === 0 ? badHourly : normalDayHourly,
      }));
      const res = computeInterdailyStability(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/24 entries/i);
      }
    });

    it("refuses sleep grid with length !== 1440", () => {
      const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        sleepWakeGrid: i === 0 ? "1".repeat(1000) : normalSleepGrid,
      }));
      const res = computeSleepRegularityIndex(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/1440/);
      }
    });

    it("refuses sleep grid with characters other than '0' and '1'", () => {
      const badGrid = "0".repeat(700) + "X" + "1".repeat(739);
      const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        sleepWakeGrid: i === 0 ? badGrid : normalSleepGrid,
      }));
      const res = computeSleepRegularityIndex(days);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/character/i);
      }
    });

    it("refuses non-finite numbers in baseline inputs", () => {
      const res = computePersonalBaseline([1, 2, 3, Infinity, 5, 6, 7]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/finite/i);
      }
    });
  });
});
