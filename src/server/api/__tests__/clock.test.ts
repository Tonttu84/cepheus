import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  advanceDemoTime,
  getDemoClock,
  getDemoOffsetDays,
  getDemoOffsetMs,
  resetDemoClock,
} from "../clock";
import { resetSettings, setDemoEnabled } from "../settings";

describe("Demo clock provider (src/server/api/clock.ts)", () => {
  beforeEach(() => {
    resetSettings();
    setDemoEnabled(true);
    resetDemoClock();
  });

  afterEach(() => {
    resetDemoClock();
    resetSettings();
  });

  it("tells the current system time when offset is 0", () => {
    const clock = getDemoClock();
    const before = Date.now();
    const clockTime = new Date(clock.now()).getTime();
    const after = Date.now();

    expect(clockTime).toBeGreaterThanOrEqual(before - 1000);
    expect(clockTime).toBeLessThanOrEqual(after + 1000);
    expect(getDemoOffsetMs()).toBe(0);
    expect(getDemoOffsetDays()).toBe(0);
  });

  it("advances time forward when demo setting is on", () => {
    const clock = getDemoClock();
    const before = new Date(clock.now()).getTime();

    const result = advanceDemoTime(1);
    expect(result.ok).toBe(true);
    expect(getDemoOffsetDays()).toBe(1);
    expect(getDemoOffsetMs()).toBe(86_400_000);

    const after = new Date(clock.now()).getTime();
    // Advanced by at least 1 day (86,400,000 ms)
    expect(after - before).toBeGreaterThanOrEqual(86_399_000);
  });

  it("offset can only grow: refuses zero or negative days", () => {
    expect(advanceDemoTime(0).ok).toBe(false);
    expect(advanceDemoTime(-1).ok).toBe(false);
    expect(advanceDemoTime(-5).ok).toBe(false);

    // After failed attempts, offset remains 0
    expect(getDemoOffsetMs()).toBe(0);
  });

  it("accumulates multiple forward advances", () => {
    expect(advanceDemoTime(1).ok).toBe(true);
    expect(advanceDemoTime(3).ok).toBe(true);
    expect(advanceDemoTime(7).ok).toBe(true);

    expect(getDemoOffsetDays()).toBe(11);
    expect(getDemoOffsetMs()).toBe(11 * 86_400_000);
  });

  it("resetDemoClock zeroes the offset back to 0", () => {
    advanceDemoTime(14);
    expect(getDemoOffsetDays()).toBe(14);

    resetDemoClock();
    expect(getDemoOffsetMs()).toBe(0);
    expect(getDemoOffsetDays()).toBe(0);
  });

  it("with demo setting off: clock is plain system clock and offset cannot be changed", () => {
    // When demo mode is off
    setDemoEnabled(false);

    const clock = getDemoClock();
    const systemNow = Date.now();
    const clockNow = new Date(clock.now()).getTime();
    expect(Math.abs(clockNow - systemNow)).toBeLessThan(2000);

    // Advancing is refused
    const adv = advanceDemoTime(7);
    expect(adv.ok).toBe(false);
    if (!adv.ok) {
      expect(adv.error).toMatch(/demo.*off|disabled/i);
    }
    expect(getDemoOffsetMs()).toBe(0);
  });
});
