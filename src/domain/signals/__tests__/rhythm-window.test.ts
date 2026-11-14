import { describe, expect, it } from "vitest";
import {
  computeMovingRhythmWindows,
  computeRhythmWindow,
} from "../rhythm-window";
import type { DayWindowInput } from "../types";

describe("computeRhythmWindow and computeMovingRhythmWindows", () => {
  const standardDayActivity: number[] = [
    ...new Array(8).fill(0), // 00..07 rest
    ...new Array(10).fill(50), // 08..17 active M10
    ...new Array(6).fill(10), // 18..23 evening
  ];
  const standardSleepGrid = "1".repeat(480) + "0".repeat(960); // 8h sleep

  const createDay = (index: number, overrides?: Partial<DayWindowInput>): DayWindowInput => ({
    date: `2026-02-${String(index).padStart(2, "0")}`,
    dayIndex: index,
    hourlyActivity: standardDayActivity,
    sleepWakeGrid: standardSleepGrid,
    sleepMidpointMin: 240, // 04:00
    wasoMinutes: 20,
    steps: 7500,
    isSimulated: true,
    ...overrides,
  });

  // Edge case 1: Exactly seven days
  it("succeeds with exactly seven valid days at the boundary", () => {
    const days: DayWindowInput[] = Array.from({ length: 7 }, (_, i) => createDay(i + 1));

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.windowDays).toBe(7);
    expect(result.value.validDays).toBe(7);
    expect(result.value.windowEndDate).toBe("2026-02-07");
    expect(result.value.dayIndex).toBe(7);
    expect(result.value.m10).toBeCloseTo(50.0, 2);
    expect(result.value.l5).toBeCloseTo(0.0, 2);
    expect(result.value.relativeAmplitude).toBeCloseTo(1.0, 3);
    expect(result.value.interdailyStability).toBeCloseTo(1.0, 3);
    expect(result.value.sri).toBeCloseTo(100.0, 2);
    expect(result.value.stepsMean).toBeCloseTo(7500, 1);
    expect(result.value.wasoMeanMin).toBeCloseTo(20, 1);
    expect(result.value.isSimulated).toBe(true);
  });

  // Edge case 2: Exactly six days (under ruling a: gives no value with reason)
  it("refuses a window with only six days under ruling a", () => {
    const days: DayWindowInput[] = Array.from({ length: 6 }, (_, i) => createDay(i + 1));

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days|fewer than/i);
  });

  // Edge case 3a: Gap in the middle of 7 calendar days -> only 6 valid days -> refused
  it("refuses a 7-day window when a day in the middle is invalid (< 20 hours)", () => {
    const invalidDayHourly = [
      ...new Array(8).fill(null), // 8 missing hours -> 16 valid hours (< 20)
      ...new Array(16).fill(20),
    ];
    const days: DayWindowInput[] = [
      ...Array.from({ length: 3 }, (_, i) => createDay(i + 1)),
      createDay(4, { hourlyActivity: invalidDayHourly }), // day 4 invalid
      ...Array.from({ length: 3 }, (_, i) => createDay(i + 5)),
    ];

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Edge case 3b: Gap in the middle of 8 calendar days with 7 valid days -> succeeds
  it("succeeds on 8 calendar days with a gap in the middle yielding 7 valid days", () => {
    const invalidDayHourly = [
      ...new Array(8).fill(null),
      ...new Array(16).fill(20),
    ];
    const days: DayWindowInput[] = [
      ...Array.from({ length: 3 }, (_, i) => createDay(i + 1)),
      createDay(4, { hourlyActivity: invalidDayHourly }), // gap in middle
      ...Array.from({ length: 4 }, (_, i) => createDay(i + 5)),
    ];

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.validDays).toBe(7);
    expect(result.value.windowDays).toBe(8);
    expect(result.value.interdailyStability).toBeCloseTo(1.0, 3);
    expect(result.value.relativeAmplitude).toBeCloseTo(1.0, 3);
    expect(result.value.m10).toBeCloseTo(50.0, 2);
    expect(result.value.l5).toBeCloseTo(0.0, 2);
    expect(result.value.sri).toBeCloseTo(100.0, 2);
  });

  // Edge case 4: M10 and L5 crossing midnight in window
  it("handles M10 and L5 crossing midnight within a window", () => {
    const nightShiftActivity: number[] = new Array(24).fill(10);
    // M10 crossing midnight: 21..23 and 0..6
    for (let h = 21; h < 24; h++) nightShiftActivity[h] = 60;
    for (let h = 0; h <= 6; h++) nightShiftActivity[h] = 60;
    // L5: 11..15
    for (let h = 11; h <= 15; h++) nightShiftActivity[h] = 1;

    const days: DayWindowInput[] = Array.from({ length: 7 }, (_, i) =>
      createDay(i + 1, { hourlyActivity: nightShiftActivity })
    );

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.m10).toBeCloseTo(60.0, 2);
    expect(result.value.l5).toBeCloseTo(1.0, 2);
    expect(result.value.relativeAmplitude).toBeCloseTo(59 / 61, 3);
  });

  // Baseline integration: computes raZScore, isZScore, sriZScore when baselines provided
  it("computes z-scores when personal baselines are supplied", () => {
    const days: DayWindowInput[] = Array.from({ length: 7 }, (_, i) => createDay(i + 1));

    const baselines = {
      raBaseline: { sampleCount: 14, mean: 0.90, sd: 0.05, median: 0.90, iqr: 0.04 },
      isBaseline: { sampleCount: 14, mean: 0.80, sd: 0.10, median: 0.80, iqr: 0.08 },
      sriBaseline: { sampleCount: 14, mean: 90.0, sd: 5.0, median: 90.0, iqr: 4.0 },
    };

    const result = computeRhythmWindow(days, baselines);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // RA is 1.0 -> (1.0 - 0.90) / 0.05 = 2.0
    expect(result.value.raZScore).toBeCloseTo(2.0, 2);
    // IS is 1.0 -> (1.0 - 0.80) / 0.10 = 2.0
    expect(result.value.isZScore).toBeCloseTo(2.0, 2);
    // SRI is 100 -> (100 - 90) / 5 = 2.0
    expect(result.value.sriZScore).toBeCloseTo(2.0, 2);
  });

  // computeMovingRhythmWindows across a 9-day sequence
  it("computes moving windows across a sequence of days", () => {
    const days: DayWindowInput[] = Array.from({ length: 9 }, (_, i) => createDay(i + 1));

    const windows = computeMovingRhythmWindows(days);
    // With 9 days and 7-day window size, there are 3 rolling windows (ending on day 7, 8, 9)
    expect(windows.length).toBe(3);
    for (const w of windows) {
      expect(w.ok).toBe(true);
      if (w.ok) {
        expect(w.value.validDays).toBe(7);
        expect(w.value.interdailyStability).toBeCloseTo(1.0, 3);
        expect(w.value.relativeAmplitude).toBeCloseTo(1.0, 3);
        expect(w.value.m10).toBeCloseTo(50.0, 2);
        expect(w.value.l5).toBeCloseTo(0.0, 2);
        expect(w.value.sri).toBeCloseTo(100.0, 2);
      }
    }
    if (windows[0].ok) expect(windows[0].value.dayIndex).toBe(7);
    if (windows[2].ok) expect(windows[2].value.dayIndex).toBe(9);
  });

  // Check from review finding 3: rhythm window calculation refuses when a clock hour has no data across all days
  it("refuses a rhythm window when a clock hour has no data across all days", () => {
    const missingHourActivity: (number | null)[] = [...standardDayActivity];
    missingHourActivity[3] = null; // hour 3 missing every day

    const days: DayWindowInput[] = Array.from({ length: 7 }, (_, i) =>
      createDay(i + 1, { hourlyActivity: missingHourActivity })
    );

    const result = computeRhythmWindow(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/profile|clock hour.*no.*data|incomplete/i);
  });
});
