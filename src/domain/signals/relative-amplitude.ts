/**
 * Relative Amplitude (RA), M10, and L5
 * Source: van Someren, E. J., Swaab, D. F., Colenda, C. C., Cohen, W., McCall, W. V., & Rosenquist, P. B. (1999).
 * Bright light therapy: improved sensitivity to its effects on rest-activity rhythms in Alzheimer patients
 * by application of nonparametric methods. Chronobiology International, 16(4), 505-518.
 *
 * Formula:
 * 1. 24-hour average profile: profile[h] = mean(valid activity for clock hour h) across valid days.
 * 2. M10: maximum mean activity of 10 consecutive hours on the 24h profile (wrapping around midnight).
 * 3. L5: minimum mean activity of 5 consecutive hours on the 24h profile (wrapping around midnight).
 * 4. RA = (M10 - L5) / (M10 + L5)
 */

import { resolveConfig } from "./config";
import type { DayActivityInput, RelativeAmplitudeResult, Result, SignalsConfig } from "./types";
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

function findM10(profile: readonly number[]): { m10: number; m10StartHour: number } {
  let m10 = -Infinity;
  let m10StartHour = 0;
  for (let s = 0; s < 24; s++) {
    let sum10 = 0;
    for (let k = 0; k < 10; k++) sum10 += profile[(s + k) % 24];
    const avg10 = sum10 / 10;
    if (avg10 > m10) {
      m10 = avg10;
      m10StartHour = s;
    }
  }
  return { m10, m10StartHour };
}

function findL5(profile: readonly number[]): { l5: number; l5StartHour: number } {
  let l5 = Infinity;
  let l5StartHour = 0;
  for (let s = 0; s < 24; s++) {
    let sum5 = 0;
    for (let k = 0; k < 5; k++) sum5 += profile[(s + k) % 24];
    const avg5 = sum5 / 5;
    if (avg5 < l5) {
      l5 = avg5;
      l5StartHour = s;
    }
  }
  return { l5, l5StartHour };
}

/**
 * Compute Relative Amplitude (RA), M10, L5 and their start hours over a window of days.
 * Measures day-night rest-activity contrast (0 = flat, 1 = total separation).
 */
export function computeRelativeAmplitude(
  days: readonly DayActivityInput[],
  config?: Partial<SignalsConfig>
): Result<RelativeAmplitudeResult> {
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

  // Average 24-hour profile across valid days (ruling b: missing hours left out)
  const hourSums = new Array<number>(24).fill(0);
  const hourCounts = new Array<number>(24).fill(0);
  for (const hourly of validDays) {
    for (let h = 0; h < 24; h++) {
      const v = hourly[h];
      if (v !== null) {
        hourSums[h] += v;
        hourCounts[h]++;
      }
    }
  }

  // M10 and L5 require a full 24-hour average profile: refuse if any clock hour has no data across valid days
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] === 0) {
      return {
        ok: false,
        error: `Incomplete 24-hour profile: clock hour ${h} has no valid data across window`,
      };
    }
  }

  const profile = new Array<number>(24).fill(0);
  for (let h = 0; h < 24; h++) {
    profile[h] = hourSums[h] / hourCounts[h];
  }

  // Ruling c: flat signal has no day-night contrast
  const minHour = Math.min(...profile);
  const maxHour = Math.max(...profile);
  if (minHour === maxHour) {
    return {
      ok: false,
      error: "Flat signal: zero contrast across 24-hour profile (divide by zero)",
    };
  }

  const { m10, m10StartHour } = findM10(profile);
  const { l5, l5StartHour } = findL5(profile);
  const denom = m10 + l5;
  if (denom === 0 || m10 === l5) {
    return {
      ok: false,
      error: "Flat signal: zero contrast between M10 and L5 (divide by zero)",
    };
  }

  const relativeAmplitude = (m10 - l5) / denom;
  return {
    ok: true,
    value: { m10, m10StartHour, l5, l5StartHour, relativeAmplitude },
  };
}
