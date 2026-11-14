import { describe, expect, it } from "vitest";
import { computeInterdailyStability } from "../interdaily-stability";
import type { DayActivityInput } from "../types";

describe("computeInterdailyStability (IS)", () => {
  // Hand-worked case 1: The same day repeated exactly for 7 days.
  // 12 hours of 0, 12 hours of 10.
  // Grand mean: (12 * 0 + 12 * 10) / 24 = 5.0.
  // Total N = 7 * 24 = 168.
  // Hourly means mean(x_h): 12 hours of 0, 12 hours of 10.
  // sum_{h=0}^{23} (mean(x_h) - 5)^2 = 12 * (0 - 5)^2 + 12 * (10 - 5)^2 = 12 * 25 + 12 * 25 = 600.
  // Numerator = N * 600 = 168 * 600 = 100,800.
  // Total variance sum = 7 * [12 * 25 + 12 * 25] = 7 * 600 = 4,200.
  // Denominator = p * sum = 24 * 4,200 = 100,800.
  // IS = 100,800 / 100,800 = 1.0.
  it("yields exact IS of 1.0 for the same day repeated exactly", () => {
    const singleDay: (number | null)[] = [
      ...new Array(12).fill(0),
      ...new Array(12).fill(10),
    ];
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(1.0, 5);
  });

  // Hand-worked case 2: Pure noise with no daily pattern (IS of 0.0).
  // Fixed list of numbers: for every clock hour h (0..23), the 7 days have values {1, 2, 3, 4, 5, 6, 7}
  // shifted cyclically by hour: day_d hour_h = ((d + h) % 7) + 1.
  // For every clock hour h, the values across the 7 days are a permutation of 1..7.
  // mean(x_h) = (1 + 2 + 3 + 4 + 5 + 6 + 7) / 7 = 28 / 7 = 4.0.
  // Grand mean grandMean = 4.0.
  // Therefore (mean(x_h) - grandMean) = 0 for every hour h.
  // Numerator = N * 0 = 0.
  // Denominator > 0 (variance across 168 values is non-zero).
  // IS = 0 / denominator = 0.0.
  it("yields IS of 0.0 for a deterministic pattern with no daily consistency", () => {
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, d) => {
      const hourly = Array.from({ length: 24 }, (_, h) => ((d + h) % 7) + 1);
      return {
        date: `2026-01-0${d + 1}`,
        dayIndex: d + 1,
        hourlyActivity: hourly,
      };
    });

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(0.0, 5);
  });

  // Ruling a: Fewer than 7 valid days gives no value with reason.
  it("refuses windows with fewer than 7 valid days with a clear reason", () => {
    const singleDay: number[] = [
      ...new Array(12).fill(0),
      ...new Array(12).fill(10),
    ];
    const days: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling b: Day with fewer than 20 valid hours is not valid; missing hours left out.
  it("rejects days with fewer than 20 valid hours and omits missing hours from sums", () => {
    const validDayWithGaps: (number | null)[] = [
      null, // hour 0 missing
      null, // hour 1 missing
      ...new Array(10).fill(0),
      ...new Array(12).fill(10),
    ]; // 22 valid hours -> valid day

    const invalidDay: (number | null)[] = [
      ...new Array(6).fill(null), // 6 missing hours -> 18 valid hours (< 20)
      ...new Array(18).fill(5),
    ];

    const daysWithOneInvalid: DayActivityInput[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        date: `2026-01-0${i + 1}`,
        dayIndex: i + 1,
        hourlyActivity: validDayWithGaps,
      })),
      {
        date: "2026-01-07",
        dayIndex: 7,
        hourlyActivity: invalidDay,
      },
    ];

    // Only 6 valid days because 7th day had < 20 valid hours
    const result = computeInterdailyStability(daysWithOneInvalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling c: Flat signal (zero variance) gives no value with reason, never NaN or Infinity.
  it("refuses flat signal with zero variance under ruling c without returning NaN", () => {
    const flatDay = new Array(24).fill(15);
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: flatDay,
    }));

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/zero variance|flat signal|divide by zero/i);
  });

  // Ruling f: Negative activity or non-finite values refused with an error.
  it("refuses negative activity or non-finite inputs with an error", () => {
    const badDay = new Array(24).fill(5);
    badDay[3] = -2; // negative
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: i === 0 ? badDay : new Array(24).fill(5),
    }));

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/negative/i);
  });

  // Respects custom configuration thresholds.
  it("allows overriding minimum valid days via config", () => {
    const singleDay: (number | null)[] = [
      ...new Array(12).fill(0),
      ...new Array(12).fill(10),
    ];
    const days: DayActivityInput[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeInterdailyStability(days, { minValidDays: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(1.0, 5);
  });

  // Review finding 3: when a clock hour has no data across all valid days,
  // substituting grandMean or 0 creates a made-up value.
  // IS requires all 24 clock hours to have data; return "no value" with reason.
  it("refuses calculation when a clock hour has no data across all valid days", () => {
    // 7 valid days, each with 23 valid hours (hour 4 is null on all days)
    const singleDay: (number | null)[] = [
      ...new Array(12).fill(0),
      ...new Array(12).fill(10),
    ];
    singleDay[4] = null; // clock hour 4 missing across all 7 days

    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeInterdailyStability(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/profile|clock hour.*no.*data|incomplete/i);
  });
});
