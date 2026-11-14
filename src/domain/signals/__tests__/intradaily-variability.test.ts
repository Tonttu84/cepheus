import { describe, expect, it } from "vitest";
import { computeIntradailyVariability } from "../intradaily-variability";
import type { DayActivityInput } from "../types";

describe("computeIntradailyVariability (IV)", () => {
  // Hand-worked case 1a: Hourly alternating pattern [1, 2, 3, 2] repeating (IV = 2.0).
  // Pattern: 1, 2, 3, 2 repeating for 7 days (168 hours).
  // Mean: 2.0.
  // Deviations: -1, 0, +1, 0. Squared deviations: 1, 0, 1, 0. Mean squared deviation = 0.5.
  // Total variance sum = 168 * 0.5 = 84.
  // Consecutive differences:
  // (2-1)=1, (3-2)=1, (2-3)=-1, (1-2)=-1.
  // Every consecutive step has diff^2 = 1.
  // There are 167 consecutive differences, sum = 167 * 1 = 167.
  // Numerator = N * sum(diff^2) = 168 * 167.
  // Denominator = (N - 1) * sum(variance) = 167 * 84 = 167 * (168 * 0.5).
  // IV = (168 * 167) / (167 * 84) = 168 / 84 = 2.0.
  it("yields exact IV of 2.0 for a signal that alternates each hour with period 4", () => {
    const cycle = [1, 2, 3, 2];
    const singleDay: number[] = [];
    for (let h = 0; h < 24; h++) singleDay.push(cycle[h % 4]);

    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(2.0, 5);
  });

  // Hand-worked case 1b: Signal that strictly alternates high-low every hour [0, 2, 0, 2...] (IV = 4.0).
  // Mean: 1.0. Squared deviations from mean = (0-1)^2 = 1 and (2-1)^2 = 1.
  // Total variance sum = N * 1 = 168.
  // Consecutive diffs: always +2 or -2, diff^2 = 4.
  // Sum of diff^2 = (N - 1) * 4 = 167 * 4.
  // Numerator = N * (N - 1) * 4 = 168 * 167 * 4.
  // Denominator = (N - 1) * N * 1 = 167 * 168.
  // IV = (168 * 167 * 4) / (167 * 168) = 4.0.
  it("yields exact IV of 4.0 for a strictly alternating high-low hourly signal", () => {
    const singleDay: number[] = Array.from({ length: 24 }, (_, h) => (h % 2 === 0 ? 0 : 2));
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(4.0, 5);
  });

  // Hand-worked case 2: Slowly changing signal (IV near 0).
  // 7 days where the first 84 hours are 10, and the remaining 84 hours are 0.
  // Mean = 5.0. Total variance sum = 168 * (5)^2 = 4,200.
  // Only 1 transition changes (from 10 to 0), diff = -10, diff^2 = 100.
  // All other 166 transitions have diff = 0.
  // Sum of diff^2 = 100.
  // Numerator = 168 * 100 = 16,800.
  // Denominator = 167 * 4,200 = 701,400.
  // IV = 16,800 / 701,400 = 0.02395... close to 0.
  it("yields IV near 0 for a slowly changing signal", () => {
    const dayHigh = new Array(24).fill(10);
    const dayLow = new Array(24).fill(0);
    const days: DayActivityInput[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        date: `2026-01-0${i + 1}`,
        dayIndex: i + 1,
        hourlyActivity: dayHigh,
      })),
      {
        date: "2026-01-04",
        dayIndex: 4,
        hourlyActivity: [...new Array(12).fill(10), ...new Array(12).fill(0)],
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        date: `2026-01-0${i + 5}`,
        dayIndex: i + 5,
        hourlyActivity: dayLow,
      })),
    ];

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(0.024, 3);
    expect(result.value).toBeLessThan(0.05);
  });

  // Ruling a: Window with fewer than 7 valid days gives no value with reason.
  it("refuses windows with fewer than 7 valid days", () => {
    const singleDay = new Array(24).fill(5);
    singleDay[0] = 10;
    const days: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling b: Day with fewer than 20 valid hours is invalid; missing hours skipped in differences.
  it("rejects days with fewer than 20 valid hours under ruling b", () => {
    const validDay = new Array(24).fill(5);
    validDay[0] = 10;
    const invalidDay: (number | null)[] = [
      ...new Array(6).fill(null),
      ...new Array(18).fill(5),
    ];

    const days: DayActivityInput[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        date: `2026-01-0${i + 1}`,
        dayIndex: i + 1,
        hourlyActivity: validDay,
      })),
      {
        date: "2026-01-07",
        dayIndex: 7,
        hourlyActivity: invalidDay,
      },
    ];

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling c: Flat signal has zero variance -> gives no value with reason (division by zero).
  it("refuses flat signal with zero variance under ruling c", () => {
    const flatDay = new Array(24).fill(8);
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: flatDay,
    }));

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/zero variance|flat signal|divide by zero/i);
  });

  // Ruling f: Non-finite or negative activity refused with an error.
  it("refuses non-finite or negative activity with an error", () => {
    const badDay = new Array(24).fill(5);
    badDay[2] = -1;
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: i === 0 ? badDay : new Array(24).fill(5),
    }));

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/negative/i);
  });

  // Hand-worked case: 8 days with 7 valid and 1 invalid in the middle (Day 4, index 3).
  // Demonstrates that invalid days must not be joined end-to-end across a gap.
  //
  // Setup:
  // - Days 1, 2, 3 (indices 0, 1, 2): valid. Each day has 12 hours of 0 followed by 12 hours of 10.
  // - Day 4 (index 3): invalid (all 24 hours null).
  // - Days 5, 6, 7, 8 (indices 4, 5, 6, 7): valid. Each day has 12 hours of 0 followed by 12 hours of 10.
  // Total valid days = 7 (meets minValidDays = 7).
  // Total valid hours N = 7 * 24 = 168 (84 zeros, 84 tens).
  // Grand mean = (84 * 0 + 84 * 10) / 168 = 5.0.
  // Variance denominator sum = 84 * (0 - 5)^2 + 84 * (10 - 5)^2 = 84 * 25 + 84 * 25 = 4,200.
  //
  // Transitions in correct calculation (gap preserved, no transition across Day 4):
  // - Block 1 (Days 1..3, 72 hours): 71 transitions.
  //   3 intra-day steps (h11->h12: 0->10, diff^2 = 100) + 2 inter-day steps (h23->h0: 10->0, diff^2 = 100).
  //   Total diff^2 sum in Block 1 = 5 * 100 = 500.
  // - Across Day 4 (all null): transitions Day 3 h23 -> Day 4 h0 and Day 4 h23 -> Day 5 h0 are null -> 0 transitions.
  // - Block 2 (Days 5..8, 96 hours): 95 transitions.
  //   4 intra-day steps (diff^2 = 100) + 3 inter-day steps (diff^2 = 100).
  //   Total diff^2 sum in Block 2 = 7 * 100 = 700.
  // - Total valid transitions K = 71 + 95 = 166.
  // - Total diff^2 sum = 500 + 700 = 1,200.
  //
  // Correct IV:
  //   IV_correct = (N * diffSqSum) / (K * denVariance)
  //              = (168 * 1,200) / (166 * 4,200)
  //              = 1,200 / (166 * 25) = 1,200 / 4,150 = 24 / 83 ≈ 0.2891566...
  //
  // Wrong joined calculation (dropping Day 4 and joining Day 3 directly to Day 5):
  //   An erroneous transition Day 3 h23 (10) -> Day 5 h0 (0) is introduced (diff = -10, diff^2 = 100).
  //   Wrong transitions K_wrong = 166 + 1 = 167.
  //   Wrong diff^2 sum = 1,200 + 100 = 1,300.
  //   IV_wrong = (168 * 1,300) / (167 * 4,200)
  //            = 1,300 / (167 * 25) = 1,300 / 4,175 = 52 / 167 ≈ 0.3113772...
  it("does not span across an invalid day gap when computing consecutive differences", () => {
    const validDay = [...new Array(12).fill(0), ...new Array(12).fill(10)];
    const invalidDay = new Array(24).fill(null);

    const days: DayActivityInput[] = [
      { date: "2026-01-01", dayIndex: 1, hourlyActivity: validDay },
      { date: "2026-01-02", dayIndex: 2, hourlyActivity: validDay },
      { date: "2026-01-03", dayIndex: 3, hourlyActivity: validDay },
      { date: "2026-01-04", dayIndex: 4, hourlyActivity: invalidDay },
      { date: "2026-01-05", dayIndex: 5, hourlyActivity: validDay },
      { date: "2026-01-06", dayIndex: 6, hourlyActivity: validDay },
      { date: "2026-01-07", dayIndex: 7, hourlyActivity: validDay },
      { date: "2026-01-08", dayIndex: 8, hourlyActivity: validDay },
    ];

    const result = computeIntradailyVariability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Correct result: 24 / 83 ≈ 0.2891566...
    // The wrong joined calculation would yield 52 / 167 ≈ 0.3113772...
    expect(result.value).not.toBeCloseTo(52 / 167, 4);
    expect(result.value).toBeCloseTo(24 / 83, 5);
  });
});
