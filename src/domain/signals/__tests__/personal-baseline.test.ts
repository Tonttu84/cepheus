import { describe, expect, it } from "vitest";
import {
  computeBaselineDeviation,
  computePersonalBaseline,
} from "../personal-baseline";

describe("Personal Baseline and Deviation", () => {
  // Hand-worked case: [2, 4, 4, 4, 5, 5, 7, 9] (n = 8).
  // Sum = 40, Mean = 5.0.
  // Deviations: [-3, -1, -1, -1, 0, 0, 2, 4].
  // Squared deviations: [9, 1, 1, 1, 0, 0, 4, 16] -> Sum = 32.
  // Sample variance = 32 / 7 ≈ 4.57142857.
  // Sample SD = sqrt(32 / 7) ≈ 2.1380899.
  // Median: pos = 7 * 0.5 = 3.5 -> 4 + 0.5*(5 - 4) = 4.5.
  // Q25: pos = 7 * 0.25 = 1.75 -> 4 + 0.75*(4 - 4) = 4.0.
  // Q75: pos = 7 * 0.75 = 5.25 -> 5 + 0.25*(7 - 5) = 5.5.
  // IQR = 5.5 - 4.0 = 1.5.
  // For new value y = 9.27618:
  // z-score = (9.27618 - 5.0) / 2.1380899 = 2.0.
  // IQR difference = (9.27618 - 4.5) / 1.5 ≈ 3.18412.
  it("yields exact known baseline stats and deviations for hand-calculated sample", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];

    const baseline = computePersonalBaseline(values);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    expect(baseline.value.sampleCount).toBe(8);
    expect(baseline.value.mean).toBeCloseTo(5.0, 5);
    expect(baseline.value.sd).toBeCloseTo(Math.sqrt(32 / 7), 5);
    expect(baseline.value.median).toBeCloseTo(4.5, 5);
    expect(baseline.value.iqr).toBeCloseTo(1.5, 5);

    const dev = computeBaselineDeviation(baseline.value, 9.27617986);
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;

    expect(dev.value.zScore).toBeCloseTo(2.0, 4);
    expect(dev.value.medianDiffIqr).toBeCloseTo((9.27617986 - 4.5) / 1.5, 4);
  });

  // Ruling e: A baseline from fewer than configured values (default 7) gives no baseline.
  it("refuses a baseline with fewer than 7 samples under ruling e", () => {
    const values = [1, 2, 3, 4, 5, 6]; // 6 values

    const result = computePersonalBaseline(values);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/sample count|fewer than/i);
  });

  // Ruling e: A baseline with zero spread gives no z-score with the reason.
  it("refuses z-score calculation when baseline spread is zero under ruling e", () => {
    const flatValues = [5, 5, 5, 5, 5, 5, 5]; // 7 identical values

    const baseline = computePersonalBaseline(flatValues);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    expect(baseline.value.sd).toBe(0);

    const dev = computeBaselineDeviation(baseline.value, 6);
    expect(dev.ok).toBe(false);
    if (dev.ok) return;
    expect(dev.error).toMatch(/zero spread|zero variance|standard deviation is zero/i);
  });

  // Ruling f: Inputs that are not finite numbers are refused with an error.
  it("refuses non-finite numbers in baseline values under ruling f", () => {
    const badValues = [1, 2, NaN, 4, 5, 6, 7];

    const result = computePersonalBaseline(badValues);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/finite/i);
  });

  // Ruling f: Refuses non-finite new value when computing deviation.
  it("refuses non-finite new value in deviation calculation under ruling f", () => {
    const baselineStats = {
      sampleCount: 7,
      mean: 10,
      sd: 2,
      median: 10,
      iqr: 3,
    };

    const dev = computeBaselineDeviation(baselineStats, Infinity);
    expect(dev.ok).toBe(false);
    if (dev.ok) return;
    expect(dev.error).toMatch(/finite/i);
  });

  // Config override for minBaselineSamples.
  it("allows overriding minimum sample count via config", () => {
    const values = [10, 12, 14, 16, 18]; // 5 values

    const result = computePersonalBaseline(values, { minBaselineSamples: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sampleCount).toBe(5);
    expect(result.value.mean).toBe(14);
  });
});
