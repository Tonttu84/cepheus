/**
 * Input validation for signal maths.
 * Pure TypeScript functions returning Result<T>.
 * Enforces ruling b (missing hours) and ruling f (refuse non-finite, negative, wrong length/characters).
 */

import type { DayActivityInput, Result } from "./types";

/**
 * Validate a 24-hour activity input array or JSON string.
 * Each hour must be a finite number >= 0, or null/undefined for missing data.
 * Refuses negative numbers, non-finite values (NaN, Infinity), and wrong array length with an error (ruling f).
 */
export function parseAndValidateHourlyActivity(
  input: readonly (number | null)[] | string
): Result<(number | null)[]> {
  let arr: readonly unknown[];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Hourly activity JSON must be an array" };
      }
      arr = parsed;
    } catch {
      return { ok: false, error: "Hourly activity string is not valid JSON" };
    }
  } else if (Array.isArray(input)) {
    arr = input;
  } else {
    return { ok: false, error: "Hourly activity must be an array or JSON string" };
  }

  if (arr.length !== 24) {
    return {
      ok: false,
      error: `Hourly activity must contain exactly 24 entries, found ${arr.length}`,
    };
  }

  const result: (number | null)[] = new Array<number | null>(24);
  for (let h = 0; h < 24; h++) {
    const v = arr[h];
    if (v === null || v === undefined) {
      result[h] = null;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return {
        ok: false,
        error: `Hour ${h} activity must be a finite number or null, received ${String(v)}`,
      };
    }
    if (v < 0) {
      return {
        ok: false,
        error: `Hour ${h} activity cannot be negative, received ${v}`,
      };
    }
    result[h] = v;
  }

  return { ok: true, value: result };
}

export interface ValidatedDayActivity {
  readonly date: string;
  readonly dayIndex?: number;
  readonly hourly: readonly (number | null)[];
  readonly validHoursCount: number;
  readonly isValidDay: boolean;
}

/**
 * Validate a single day's activity and determine if it meets minimum valid hours (ruling b).
 */
export function validateDayActivity(
  day: DayActivityInput,
  minValidHoursPerDay: number
): Result<ValidatedDayActivity> {
  const parsed = parseAndValidateHourlyActivity(day.hourlyActivity);
  if (!parsed.ok) return parsed;

  let validCount = 0;
  for (const h of parsed.value) {
    if (h !== null) validCount++;
  }

  return {
    ok: true,
    value: {
      date: day.date,
      dayIndex: day.dayIndex,
      hourly: parsed.value,
      validHoursCount: validCount,
      isValidDay: validCount >= minValidHoursPerDay,
    },
  };
}

/**
 * Validate a 1440-character sleep-wake grid string ('0' = wake, '1' = sleep).
 * Refuses wrong length or characters other than '0' and '1' (ruling f).
 * Null or undefined is returned as null (no data).
 */
export function validateSleepWakeGrid(
  grid: string | null | undefined
): Result<string | null> {
  if (grid === null || grid === undefined) {
    return { ok: true, value: null };
  }
  if (typeof grid !== "string") {
    return { ok: false, error: "Sleep-wake grid must be a string or null" };
  }
  if (grid.length !== 1440) {
    return {
      ok: false,
      error: `Sleep-wake grid must be exactly 1440 characters, found ${grid.length}`,
    };
  }
  for (let i = 0; i < grid.length; i++) {
    const ch = grid.charCodeAt(i);
    // '0' is 48, '1' is 49
    if (ch !== 48 && ch !== 49) {
      return {
        ok: false,
        error: `Sleep-wake grid contains invalid character '${grid[i]}' at minute ${i} (only '0' and '1' allowed)`,
      };
    }
  }
  return { ok: true, value: grid };
}

/**
 * Validate an array of numbers for finite values (ruling f).
 */
export function validateFiniteNumbers(
  values: readonly number[]
): Result<readonly number[]> {
  if (!Array.isArray(values)) {
    return { ok: false, error: "Expected an array of numbers" };
  }
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return {
        ok: false,
        error: `Value at index ${i} must be a finite number, received ${String(v)}`,
      };
    }
  }
  return { ok: true, value: values };
}
