import { describe, expect, it } from "vitest";
import {
  addDays,
  findUtcInstantForLocalWallClock,
  getIsoWeekday,
  parseLocalWallClockInTimeZone,
} from "../time";

describe("ruling h: clock changes and local wall-clock conversion", () => {
  it("Europe/Helsinki across the clock change at the end of March differs by an hour in UTC while local time stays the same", () => {
    // 2026-03-29 is the spring forward Sunday in Europe/Helsinki (EET UTC+2 -> EEST UTC+3)
    // Before the change (e.g. 2026-03-28 at 14:00 local time): UTC is 12:00:00Z
    const beforeChangeUtc = findUtcInstantForLocalWallClock("2026-03-28", "14:00", "Europe/Helsinki");
    expect(beforeChangeUtc).toBe("2026-03-28T12:00:00.000Z");

    // After the change (e.g. 2026-03-30 at 14:00 local time): UTC is 11:00:00Z
    const afterChangeUtc = findUtcInstantForLocalWallClock("2026-03-30", "14:00", "Europe/Helsinki");
    expect(afterChangeUtc).toBe("2026-03-30T11:00:00.000Z");

    // Difference in UTC opening instants is exactly 1 hour
    const diffHours =
      (new Date(beforeChangeUtc).getUTCHours() - new Date(afterChangeUtc).getUTCHours());
    expect(diffHours).toBe(1);
  });

  it("Europe/Helsinki across the clock change at the end of October differs by an hour in UTC while local time stays the same", () => {
    // 2026-10-25 is the fall back Sunday in Europe/Helsinki (EEST UTC+3 -> EET UTC+2)
    // Before the change (e.g. 2026-10-24 at 14:00 local time): UTC is 11:00:00Z
    const beforeChangeUtc = findUtcInstantForLocalWallClock("2026-10-24", "14:00", "Europe/Helsinki");
    expect(beforeChangeUtc).toBe("2026-10-24T11:00:00.000Z");

    // After the change (e.g. 2026-10-26 at 14:00 local time): UTC is 12:00:00Z
    const afterChangeUtc = findUtcInstantForLocalWallClock("2026-10-26", "14:00", "Europe/Helsinki");
    expect(afterChangeUtc).toBe("2026-10-26T12:00:00.000Z");

    const diffHours =
      (new Date(afterChangeUtc).getUTCHours() - new Date(beforeChangeUtc).getUTCHours());
    expect(diffHours).toBe(1);
  });

  it("on the night clocks go forward, a local time that does not exist opens at the first moment that does exist after it", () => {
    // In Europe/Helsinki on 2026-03-29, 03:00 jumps to 04:00 (at 01:00:00Z).
    // 03:30 does not exist.
    // The first moment that does exist after 03:30 is 04:00:00 local, which occurs at 01:00:00.000Z.
    const instant = findUtcInstantForLocalWallClock("2026-03-29", "03:30", "Europe/Helsinki");
    expect(instant).toBe("2026-03-29T01:00:00.000Z");

    const wallClock = parseLocalWallClockInTimeZone(instant, "Europe/Helsinki");
    expect(wallClock.localDate).toBe("2026-03-29");
    expect(wallClock.timeOfDay).toBe("04:00");
  });

  it("on the night clocks go back, a local time that occurs twice opens at its first occurrence", () => {
    // In Europe/Helsinki on 2026-10-25, 04:00 jumps back to 03:00.
    // 03:30 occurs twice: first at 00:30:00Z (UTC+3), second at 01:30:00Z (UTC+2).
    // Ruling (h) requires the first occurrence (00:30:00Z).
    const instant = findUtcInstantForLocalWallClock("2026-10-25", "03:30", "Europe/Helsinki");
    expect(instant).toBe("2026-10-25T00:30:00.000Z");

    const wallClock = parseLocalWallClockInTimeZone(instant, "Europe/Helsinki");
    expect(wallClock.localDate).toBe("2026-10-25");
    expect(wallClock.timeOfDay).toBe("03:30");
  });

  it("handles a zone with no clock changes consistently (UTC and Asia/Tokyo)", () => {
    const utcWinter = findUtcInstantForLocalWallClock("2026-01-15", "10:00", "UTC");
    const utcSummer = findUtcInstantForLocalWallClock("2026-07-15", "10:00", "UTC");
    expect(utcWinter).toBe("2026-01-15T10:00:00.000Z");
    expect(utcSummer).toBe("2026-07-15T10:00:00.000Z");

    // Asia/Tokyo is UTC+9 year-round
    const tokyoWinter = findUtcInstantForLocalWallClock("2026-01-15", "10:00", "Asia/Tokyo");
    const tokyoSummer = findUtcInstantForLocalWallClock("2026-07-15", "10:00", "Asia/Tokyo");
    expect(tokyoWinter).toBe("2026-01-15T01:00:00.000Z");
    expect(tokyoSummer).toBe("2026-07-15T01:00:00.000Z");
  });
});

describe("calendar operations across year boundaries and leap days", () => {
  it("operates across 29 February on a leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(getIsoWeekday("2024-02-29")).toBe(4); // Thursday
  });

  it("operates across February on a non-leap year", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(getIsoWeekday("2026-02-28")).toBe(6); // Saturday
    expect(getIsoWeekday("2026-03-01")).toBe(7); // Sunday
  });

  it("operates across a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(getIsoWeekday("2026-12-31")).toBe(4); // Thursday
    expect(getIsoWeekday("2027-01-01")).toBe(5); // Friday
  });
});
