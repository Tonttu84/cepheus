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
      if (!res.ok) return;
      expect(res.value).toBeCloseTo(1.0, 5);
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

    // Hand-worked test case where leaving missing hours out yields clearly different
    // numbers from treating them as zero, for each measure taking hourly data (IS, RA, IV).
    //
    // Setup: 7 days window (minValidDays = 7).
    // - Days 1..6: 12 hours of 0 (h0..11), 12 hours of 10 (h12..23).
    // - Day 7: 12 hours of 10 (h0..11), 4 hours null (h12..15, exactly 20 valid hours), 8 hours of 0 (h16..23).
    //
    // 1. IS (Interdaily Stability):
    //    - Valid samples N = 6 * 24 + 20 = 164 (84 tens, 80 zeros).
    //    - Grand mean = (84 * 10) / 164 = 210 / 41 ≈ 5.1219512.
    //    - denVariance = 80 * (0 - 210/41)^2 + 84 * (10 - 210/41)^2 = 6,888,000 / 1,681.
    //    - Clock hour means:
    //      h0..11 (12 hours): (6 * 0 + 1 * 10) / 7 = 10 / 7.
    //      h12..15 (4 hours): (6 * 10) / 6 = 10 (missing Day 7 omitted from sum and count!).
    //      h16..23 (8 hours): (6 * 10 + 1 * 0) / 7 = 60 / 7.
    //    - numRhythm = 12 * (10/7 - 210/41)^2 + 4 * (10 - 210/41)^2 + 8 * (60/7 - 210/41)^2
    //                = 29,164,000 / 82,369 (where 82,369 = 49 * 1681).
    //    - IS_correct = (N * numRhythm) / (24 * denVariance)
    //                 = (164 * 29,164,000) / (24 * 49 * 6,888,000)
    //                 = 4,782,896 / 8,100,288 ≈ 0.5904600.
    //    - If missing hours were 0: h12..15 mean would be 60/7, N=168, yielding IS_wrong = 25 / 49 ≈ 0.5102041.
    //
    // 2. RA (Relative Amplitude):
    //    - Hourly profile across 7 days:
    //      h0..11: 10 / 7 ≈ 1.4285714.
    //      h12..15: 60 / 6 = 10 = 70 / 7 (missing hours omitted).
    //      h16..23: 60 / 7 ≈ 8.5714286.
    //    - M10 (max 10 consecutive hours): hours 12..21 (4 hours of 10 and 6 hours of 60/7):
    //      sum = 4 * 10 + 6 * (60/7) = 640 / 7, M10 = 64 / 7 ≈ 9.1428571 (start hour 12).
    //    - L5 (min 5 consecutive hours): hours 0..4 (all 10/7): L5 = 10 / 7 ≈ 1.4285714 (start hour 0).
    //    - RA_correct = (M10 - L5) / (M10 + L5) = (64/7 - 10/7) / (64/7 + 10/7) = 54 / 74 = 27 / 37 ≈ 0.7297297.
    //    - If missing hours were 0: h12..15 mean would be 60/7, M10 = 60/7 ≈ 8.5714286, RA_wrong = 5 / 7 ≈ 0.7142857.
    //
    // 3. IV (Intradaily Variability):
    //    - Transitions: Days 1..6 have 6 intra-day (diff^2=100) and 5 inter-day (diff^2=100) steps.
    //      Day 6 h23 (10) -> Day 7 h0 (10) has diff=0.
    //      Day 7 h0..11 all 10 (diff=0). Steps h11->h12..h15->h16 involving null are skipped.
    //      h16..23 all 0 (diff=0).
    //    - diffSqSum = 11 * 100 = 1,100.
    //    - Valid transitions K = 167 - 5 = 162. N = 164. denVariance = 6,888,000 / 1,681.
    //    - IV_correct = (164 * 1,100 * 1,681) / (162 * 6,888,000) = 18,491 / 68,040 ≈ 0.2717666.
    //    - If missing hours were 0: step h11(10)->h12(0) adds 100 to diffSqSum (1,200), K=167, N=168,
    //      yielding IV_wrong = 48 / 167 ≈ 0.2874251.
    const dayRegular: (number | null)[] = [
      ...new Array(12).fill(0),
      ...new Array(12).fill(10),
    ];
    const dayWithMissing: (number | null)[] = [
      ...new Array(12).fill(10),
      null, null, null, null, // 4 missing hours -> exactly 20 valid hours
      ...new Array(8).fill(0),
    ];
    const rulingBDays: DayActivityInput[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        hourlyActivity: dayRegular,
      })),
      { date: "2026-03-07", hourlyActivity: dayWithMissing },
    ];

    it("accepts day with exactly 20 valid hours and leaves missing hours out of sums (IS)", () => {
      const res = computeInterdailyStability(rulingBDays);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // Exact hand-worked value: 4,782,896 / 8,100,288 ≈ 0.5904600
      // Treating missing hours as 0 gives 25 / 49 ≈ 0.5102041
      expect(res.value).toBeCloseTo(4782896 / 8100288, 5);
      expect(res.value).not.toBeCloseTo(25 / 49, 2);
    });

    it("accepts day with exactly 20 valid hours and leaves missing hours out of sums (RA)", () => {
      const res = computeRelativeAmplitude(rulingBDays);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // Exact hand-worked values:
      // M10 = 64 / 7 ≈ 9.142857 (vs 60 / 7 ≈ 8.571429 if missing were 0)
      // L5 = 10 / 7 ≈ 1.428571
      // RA = 27 / 37 ≈ 0.7297297 (vs 5 / 7 ≈ 0.7142857 if missing were 0)
      expect(res.value.m10).toBeCloseTo(64 / 7, 5);
      expect(res.value.m10StartHour).toBe(12);
      expect(res.value.l5).toBeCloseTo(10 / 7, 5);
      expect(res.value.l5StartHour).toBe(0);
      expect(res.value.relativeAmplitude).toBeCloseTo(27 / 37, 5);
      expect(res.value.relativeAmplitude).not.toBeCloseTo(5 / 7, 2);
    });

    it("accepts day with exactly 20 valid hours and leaves missing hours out of sums (IV)", () => {
      const res = computeIntradailyVariability(rulingBDays);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // Exact hand-worked value: 18,491 / 68,040 ≈ 0.2717666
      // Treating missing hours as 0 gives 48 / 167 ≈ 0.2874251
      expect(res.value).toBeCloseTo(18491 / 68040, 5);
      expect(res.value).not.toBeCloseTo(48 / 167, 2);
    });

    it("accepts day with exactly 20 valid hours and leaves missing hours out of sums (RhythmWindow)", () => {
      const windowDays: DayWindowInput[] = rulingBDays.map((d, i) => ({
        ...d,
        dayIndex: i + 1,
        sleepWakeGrid: normalSleepGrid,
      }));
      const res = computeRhythmWindow(windowDays);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.validDays).toBe(7);
      expect(res.value.interdailyStability).toBeCloseTo(4782896 / 8100288, 3);
      expect(res.value.relativeAmplitude).toBeCloseTo(27 / 37, 3);
      expect(res.value.intradailyVariability).toBeCloseTo(18491 / 68040, 3);
      expect(res.value.m10).toBeCloseTo(64 / 7, 2);
      expect(res.value.l5).toBeCloseTo(10 / 7, 2);
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
      expect(baselineRes.value.sampleCount).toBe(7);
      expect(baselineRes.value.mean).toBe(10);
      expect(baselineRes.value.sd).toBe(0);

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
