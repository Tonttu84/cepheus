import { describe, expect, it } from "vitest";
import { computeSleepRegularityIndex } from "../sleep-regularity";
import type { DaySleepInput } from "../types";

describe("computeSleepRegularityIndex (SRI)", () => {
  // Hand-worked case 1: Identical sleep on every day (SRI = 100.0).
  // Pattern: 420 minutes of sleep ('1') from 00:00 to 07:00, then 1020 minutes of wake ('0').
  // Repeated for 7 consecutive days.
  // For all 6 consecutive day transitions, state at minute m on day d matches day d+1.
  // Total pairs = 6 * 1440 = 8,640. Matches = 8,640.
  // P(same) = 8,640 / 8,640 = 1.0.
  // SRI = 200 * 1.0 - 100 = 100.0.
  it("yields exact SRI of 100.0 for identical sleep on every day", () => {
    const identicalGrid = "1".repeat(420) + "0".repeat(1020);
    const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: identicalGrid,
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(100.0, 5);
  });

  // Hand-worked case 2: Sleep exactly inverted on alternate days (SRI = -100.0).
  // Day 1, 3, 5, 7: all '1's (1440 minutes asleep).
  // Day 2, 4, 6: all '0's (1440 minutes awake).
  // In every consecutive transition (1->2, 2->3, 3->4, 4->5, 5->6, 6->7),
  // every minute m differs: state is 1 on one day and 0 on the next.
  // Matches = 0. Total pairs = 6 * 1440 = 8,640.
  // P(same) = 0.0.
  // SRI = 200 * 0.0 - 100 = -100.0.
  it("yields exact SRI of -100.0 for sleep exactly inverted on alternate days", () => {
    const gridA = "1".repeat(1440);
    const gridB = "0".repeat(1440);
    const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: i % 2 === 0 ? gridA : gridB,
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(-100.0, 5);
  });

  // Ruling a: Window with fewer than 7 days gives no value with reason.
  it("refuses windows with fewer than 7 days under ruling a", () => {
    const grid = "1".repeat(400) + "0".repeat(1040);
    const days: DaySleepInput[] = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: grid,
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid days|fewer than/i);
  });

  // Ruling d: Uses only pairs of minutes where both days have data, and gives no value
  // when fewer than a configured share of pairs is usable.
  // In a 7-day window (6 transitions possible):
  // If Day 4 has null sleep grid, transitions 3->4 and 4->5 are lost.
  // Only 4 transitions remain (1->2, 2->3, 5->6, 6->7).
  // Usable share = 4 / 6 = 66.7%, which is below the default 70% threshold.
  it("refuses SRI when usable minute pairs fall below threshold under ruling d", () => {
    const grid = "1".repeat(400) + "0".repeat(1040);
    const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: i === 3 ? null : grid,
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/usable.*pair/i);
  });

  // Ruling d: In a longer window (e.g. 10 days, 9 transitions), if 1 middle day is null,
  // 7 transitions remain -> 7 / 9 = 77.8% usable (> 70% threshold). Calculation succeeds.
  it("succeeds when usable minute pair share meets the configured threshold", () => {
    const grid = "1".repeat(400) + "0".repeat(1040);
    const days: DaySleepInput[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: i === 4 ? null : grid,
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(100.0, 5);
  });

  // Ruling f: String of wrong length refused with an error.
  it("refuses sleep grid of incorrect length under ruling f", () => {
    const badGrid = "1".repeat(1439); // 1439 instead of 1440
    const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: i === 0 ? badGrid : "0".repeat(1440),
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/1440/);
  });

  // Ruling f: String containing characters other than '0' and '1' refused with an error.
  it("refuses sleep grid with characters other than '0' and '1' under ruling f", () => {
    const badGrid = "0".repeat(700) + "2" + "0".repeat(739);
    const days: DaySleepInput[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      dayIndex: i + 1,
      sleepWakeGrid: i === 0 ? badGrid : "0".repeat(1440),
    }));

    const result = computeSleepRegularityIndex(days);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/character/i);
  });
});
