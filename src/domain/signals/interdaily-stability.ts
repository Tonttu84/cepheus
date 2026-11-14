/**
 * Interdaily Stability (IS)
 * Source: Witting, W., Kwa, I. H., Eikelenboom, P., Mirmiran, M., & Swaab, D. F. (1990).
 * Alterations in the circadian rest-activity rhythm in normal aging and Alzheimer's disease.
 * Biological Psychiatry, 27(6), 563-572.
 *
 * Formula:
 * IS = [ N * sum_{h=0}^{p-1} (mean(x_h) - grandMean)^2 ] / [ p * sum_{i=1}^N (x_i - grandMean)^2 ]
 * where:
 *   p = 24 (clock hours per day)
 *   N = count of valid hourly activity observations across valid days
 *   grandMean = arithmetic mean of all valid observations
 *   mean(x_h) = mean of valid values at clock hour h across valid days
 *   x_i = valid hourly activity observations
 */

import { resolveConfig } from "./config";
import type { DayActivityInput, Result, SignalsConfig } from "./types";
import { validateDayActivity } from "./validation";

function filterValidDays(
  days: readonly DayActivityInput[],
  minHours: number
): Result<Array<readonly (number | null)[]>> {
  const validDays: Array<readonly (number | null)[]> = [];
  for (const day of days) {
    const validated = validateDayActivity(day, minHours);
    if (!validated.ok) return validated;
    if (validated.value.isValidDay) {
      validDays.push(validated.value.hourly);
    }
  }
  return { ok: true, value: validDays };
}

/**
 * Compute Interdaily Stability (IS) over a window of days.
 * Measures synchronization to a 24h rhythm across days (0 = no rhythm, 1 = identical days).
 */
export function computeInterdailyStability(
  days: readonly DayActivityInput[],
  config?: Partial<SignalsConfig>
): Result<number> {
  const cfg = resolveConfig(config);
  const daysRes = filterValidDays(days, cfg.minValidHoursPerDay);
  if (!daysRes.ok) return daysRes;

  const validDays = daysRes.value;
  // Ruling a: fewer than configured valid days gives no value
  if (validDays.length < cfg.minValidDays) {
    return {
      ok: false,
      error: `Insufficient valid days: found ${validDays.length}, minimum required is ${cfg.minValidDays}`,
    };
  }

  const validSamples: number[] = [];
  const hourSums = new Array<number>(24).fill(0);
  const hourCounts = new Array<number>(24).fill(0);

  for (const hourly of validDays) {
    for (let h = 0; h < 24; h++) {
      const v = hourly[h];
      if (v !== null) {
        validSamples.push(v);
        hourSums[h] += v;
        hourCounts[h]++;
      }
    }
  }

  // Interdaily Stability requires all 24 clock hours to have valid data across the window
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] === 0) {
      return {
        ok: false,
        error: `Incomplete 24-hour profile: clock hour ${h} has no valid data across window`,
      };
    }
  }

  let totalSum = 0;
  for (const v of validSamples) totalSum += v;
  const grandMean = totalSum / validSamples.length;

  let denVariance = 0;
  for (const v of validSamples) {
    const d = v - grandMean;
    denVariance += d * d;
  }

  // Ruling c: flat signal has zero variance, avoiding division by zero
  if (denVariance === 0) {
    return {
      ok: false,
      error: "Division by zero: hourly activity has zero variance (flat signal)",
    };
  }

  let numRhythm = 0;
  for (let h = 0; h < 24; h++) {
    const hMean = hourSums[h] / hourCounts[h];
    const diff = hMean - grandMean;
    numRhythm += diff * diff;
  }

  const rawIs = (validSamples.length * numRhythm) / (24 * denVariance);
  const boundedIs = Math.min(1, Math.max(0, rawIs));
  return { ok: true, value: boundedIs };
}
