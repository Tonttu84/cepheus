import { describe, expect, it } from "vitest";
import { computeRelativeAmplitude } from "../relative-amplitude";
import type { DayActivityInput } from "../types";

describe("computeRelativeAmplitude (RA), M10, L5", () => {
  // Hand-worked case 1: All activity in ten hours (hours 8..17 = 10.0), none in rest (hours 0..7 and 18..23 = 0.0).
  // 24h profile:
  // hours 0..7: 0
  // hours 8..17: 10
  // hours 18..23: 0
  // M10: starting at hour 8, 10 consecutive hours are all 10.0 -> mean = 10.0, start hour = 8.
  // L5: starting at hour 0 (or 18), 5 consecutive hours are all 0.0 -> mean = 0.0, start hour = 0 (or 18).
  // RA = (M10 - L5) / (M10 + L5) = (10 - 0) / (10 + 0) = 1.0.
  it("yields RA of 1.0 when all activity is concentrated in 10 hours and none in rest", () => {
    const singleDay: number[] = new Array(24).fill(0);
    for (let h = 8; h <= 17; h++) singleDay[h] = 10;

    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.m10).toBeCloseTo(10.0, 5);
    expect(result.value.m10StartHour).toBe(8);
    expect(result.value.l5).toBeCloseTo(0.0, 5);
    expect(result.value.relativeAmplitude).toBeCloseTo(1.0, 5);
  });

  // Hand-worked case 2: Period crossing midnight for M10 and L5.
  // Night activity shift:
  // M10 occurs from 20:00 to 05:59 (hours 20, 21, 22, 23, 0, 1, 2, 3, 4, 5).
  // Value in those 10 hours is 50.
  // Daytime hours 6..19:
  // Hours 10..14 (5 hours: 10, 11, 12, 13, 14) are the least active with value 2.
  // Remaining hours (6..9 and 15..19) have value 10.
  // Then:
  // M10 starts at hour 20, wraps past midnight, mean = 50.0.
  // L5 starts at hour 10, mean = 2.0.
  // RA = (50 - 2) / (50 + 2) = 48 / 52 = 12 / 13 = 0.9230769...
  it("correctly identifies M10 and L5 when the window crosses midnight", () => {
    const singleDay: number[] = new Array(24).fill(10);
    // Set M10 hours (20..23 and 0..5)
    for (let h = 20; h < 24; h++) singleDay[h] = 50;
    for (let h = 0; h <= 5; h++) singleDay[h] = 50;
    // Set L5 hours (10..14)
    for (let h = 10; h <= 14; h++) singleDay[h] = 2;

    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.m10StartHour).toBe(20);
    expect(result.value.m10).toBeCloseTo(50.0, 5);
    expect(result.value.l5StartHour).toBe(10);
    expect(result.value.l5).toBeCloseTo(2.0, 5);
    expect(result.value.relativeAmplitude).toBeCloseTo(48 / 52, 5);
  });

  // Hand-worked case 3: Flat signal (no RA, ruling c).
  // Constant activity of 12 for every hour of every day.
  // M10 = 12, L5 = 12. No day-night contrast, formula gives no value with reason under ruling c.
  it("refuses a flat signal with no day-night contrast under ruling c", () => {
    const flatDay = new Array(24).fill(12);
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: flatDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/flat signal|zero contrast|divide by zero/i);
  });

  // Flat zero signal (M10 + L5 == 0)
  it("refuses an all-zero signal avoiding division by zero", () => {
    const zeroDay = new Array(24).fill(0);
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: zeroDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/flat signal|zero|divide by zero/i);
  });

  // Ruling a: Window with fewer than 7 valid days gives no value with reason.
  it("refuses windows with fewer than 7 valid days", () => {
    const singleDay = new Array(24).fill(5);
    singleDay[12] = 20;
    const days: DayActivityInput[] = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling b: Day with fewer than 20 valid hours is invalid; missing hours left out.
  it("rejects days with fewer than 20 valid hours under ruling b", () => {
    const validDay = new Array(24).fill(5);
    validDay[12] = 20;
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

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days/i);
  });

  // Ruling f: Negative activity refused with error.
  it("refuses negative activity with an error under ruling f", () => {
    const badDay = new Array(24).fill(5);
    badDay[5] = -3;
    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: i === 0 ? badDay : new Array(24).fill(5),
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/negative/i);
  });

  // Review finding 2: when a clock hour is missing on every valid day, it must not be assumed 0.
  // M10 and L5 require a full 24-hour average profile; missing a clock hour across all days
  // must return "no value" with a reason.
  it("refuses calculation when a clock hour has no data across all valid days", () => {
    // 7 valid days, each with 23 valid hours (hour 3 is null on all days)
    const singleDay: (number | null)[] = new Array(24).fill(10);
    singleDay[3] = null; // hour 3 has no data on any day

    const days: DayActivityInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      hourlyActivity: singleDay,
    }));

    const result = computeRelativeAmplitude(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/profile|clock hour.*no.*data|incomplete/i);
  });
});
