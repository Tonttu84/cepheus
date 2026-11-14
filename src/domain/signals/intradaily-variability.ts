/**
 * Intradaily Variability (IV)
 * Source: Witting, W., Kwa, I. H., Eikelenboom, P., Mirmiran, M., & Swaab, D. F. (1990).
 * Alterations in the circadian rest-activity rhythm in normal aging and Alzheimer's disease.
 * Biological Psychiatry, 27(6), 563-572.
 *
 * Formula:
 * IV = [ N * sum_{i=2}^N (x_i - x_{i-1})^2 ] / [ (N - 1) * sum_{i=1}^N (x_i - grandMean)^2 ]
 * where:
 *   N = count of valid hourly observations across the window
 *   grandMean = arithmetic mean of all valid hourly observations
 *   x_i = chronological sequence of valid hourly observations
 *
 * Missing hours handling (ruling b):
 * Consecutive differences are computed only across adjacent valid hours; missing hours
 * are left out of sums without interpolation. Denominator scales by valid transition count K.
 */

import { resolveConfig } from "./config";
import type { DayActivityInput, Result, SignalsConfig } from "./types";
import { validateDayActivity } from "./validation";

function sumConsecutiveDifferences(flatHours: readonly (number | null)[]): {
  diffSqSum: number;
  transitionCount: number;
} {
  let diffSqSum = 0;
  let transitionCount = 0;
  for (let i = 1; i < flatHours.length; i++) {
    const prev = flatHours[i - 1];
    const curr = flatHours[i];
    if (prev !== null && curr !== null) {
      const diff = curr - prev;
      diffSqSum += diff * diff;
      transitionCount++;
    }
  }
  return { diffSqSum, transitionCount };
}

/**
 * Compute Intradaily Variability (IV) over a window of days.
 * Measures fragmentation of the rest-activity rhythm (higher = more fragmented).
 */
export function computeIntradailyVariability(
  days: readonly DayActivityInput[],
  config?: Partial<SignalsConfig>
): Result<number> {
  const cfg = resolveConfig(config);

  // Preserve day positions: valid days keep their hourly data;
  // invalid days are replaced by 24 nulls so differences never span across a dropped day.
  const flatHours: (number | null)[] = [];
  const validSamples: number[] = [];
  let validDaysCount = 0;

  for (const day of days) {
    const validated = validateDayActivity(day, cfg.minValidHoursPerDay);
    if (!validated.ok) return validated;

    if (validated.value.isValidDay) {
      validDaysCount++;
      for (let h = 0; h < 24; h++) {
        const v = validated.value.hourly[h];
        flatHours.push(v);
        if (v !== null) validSamples.push(v);
      }
    } else {
      for (let h = 0; h < 24; h++) {
        flatHours.push(null);
      }
    }
  }

  // Ruling a: fewer than configured valid days gives no value
  if (validDaysCount < cfg.minValidDays) {
    return {
      ok: false,
      error: `Insufficient valid days: found ${validDaysCount}, minimum required is ${cfg.minValidDays}`,
    };
  }

  let totalSum = 0;
  for (const v of validSamples) totalSum += v;
  const grandMean = totalSum / validSamples.length;

  let denVariance = 0;
  for (const v of validSamples) {
    const d = v - grandMean;
    denVariance += d * d;
  }

  // Ruling c: flat signal has zero variance
  if (denVariance === 0) {
    return {
      ok: false,
      error: "Division by zero: hourly activity has zero variance (flat signal)",
    };
  }

  const { diffSqSum, transitionCount } = sumConsecutiveDifferences(flatHours);
  if (transitionCount === 0) {
    return {
      ok: false,
      error: "Division by zero: no valid consecutive transitions available",
    };
  }

  const iv = (validSamples.length * diffSqSum) / (transitionCount * denVariance);
  return { ok: true, value: iv };
}
