import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSwitches,
  isCountersEnabled,
  isDemoEnabled,
  isExtraQuestionEnabled,
  isRewardsEnabled,
  resetSettings,
  setDemoEnabled,
  setSwitch,
} from "../settings";

describe("Runtime settings module (src/server/api/settings.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetSettings();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetSettings();
  });

  it("provides default switch values", () => {
    const switches = getSwitches();
    expect(typeof switches.rewards).toBe("boolean");
    expect(typeof switches.counters).toBe("boolean");
    expect(typeof switches.extraQuestion).toBe("boolean");

    expect(isRewardsEnabled()).toBe(switches.rewards);
    expect(isCountersEnabled()).toBe(switches.counters);
    expect(isExtraQuestionEnabled()).toBe(switches.extraQuestion);
  });

  it("reads defaults from env variables when present", () => {
    process.env.REWARDS_ENABLED = "false";
    process.env.COUNTERS_ENABLED = "true";
    process.env.EXTRA_QUESTION_ENABLED = "true";
    process.env.DEMO_SESSION_ENABLED = "false";

    resetSettings();

    expect(isRewardsEnabled()).toBe(false);
    expect(isCountersEnabled()).toBe(true);
    expect(isExtraQuestionEnabled()).toBe(true);
    expect(isDemoEnabled()).toBe(false);
  });

  it("allows changing switches while the server runs", () => {
    setSwitch("rewards", false);
    expect(isRewardsEnabled()).toBe(false);
    expect(getSwitches().rewards).toBe(false);

    setSwitch("rewards", true);
    expect(isRewardsEnabled()).toBe(true);
    expect(getSwitches().rewards).toBe(true);

    setSwitch("counters", true);
    expect(isCountersEnabled()).toBe(true);
    expect(getSwitches().counters).toBe(true);

    setSwitch("extraQuestion", true);
    expect(isExtraQuestionEnabled()).toBe(true);
    expect(getSwitches().extraQuestion).toBe(true);
  });

  it("resetSettings puts switches back to their defaults", () => {
    setSwitch("rewards", false);
    setSwitch("counters", true);
    setSwitch("extraQuestion", true);
    setDemoEnabled(false);

    resetSettings();

    // Default env (empty) -> rewards: true, counters: false, extraQuestion: false
    expect(isRewardsEnabled()).toBe(true);
    expect(isCountersEnabled()).toBe(false);
    expect(isExtraQuestionEnabled()).toBe(false);
  });

  it("allows setting demo enabled on and off", () => {
    setDemoEnabled(false);
    expect(isDemoEnabled()).toBe(false);

    setDemoEnabled(true);
    expect(isDemoEnabled()).toBe(true);
  });
});
