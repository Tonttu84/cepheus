/**
 * Pure domain logic: evaluation of facial expressivity against a person's own usual range.
 *
 * This function places a person's latest facial expressivity score (0..1) against
 * their own historical baseline (mean +/- 1.5 sample standard deviations).
 *
 * Note on zero spread:
 * When all past readings are equal (sample standard deviation is 0), the usual
 * range collapses to a single point [mean, mean]. The latest reading is classified
 * as within_usual_range if and only if it equals the mean (within 1e-9 tolerance);
 * otherwise it is classified as below_usual_range if less than the mean, or
 * above_usual_range if greater than the mean.
 */

import { computePersonalBaseline } from "../signals/personal-baseline";

export const MIN_EXPRESSIVITY_HISTORY = 5;
export const USUAL_RANGE_SD_MULTIPLIER = 1.5;

export type ExpressivityPosition =
  | "within_usual_range"
  | "below_usual_range"
  | "above_usual_range";

export interface InsufficientHistoryResult {
  readonly status: "insufficient_history";
  readonly kind: "insufficient_history";
  readonly count: number;
  readonly minimum: number;
}

export interface UsualRangeResult {
  readonly status: ExpressivityPosition;
  readonly kind: "usual_range";
  readonly position: ExpressivityPosition;
  readonly mean: number;
  readonly lower: number;
  readonly upper: number;
  readonly sd: number;
  readonly sampleCount: number;
}

export type ExpressivityRangeResult =
  | InsufficientHistoryResult
  | UsualRangeResult;

function validateScore(value: unknown, name: string): number {
  if (value === undefined || value === null) {
    throw new TypeError(`${name} is missing`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1, got ${value}`);
  }
  return value;
}

/**
 * Evaluates a person's latest expressivity reading against their past readings.
 * Reuses computePersonalBaseline from domain signals.
 *
 * @param pastScores - Historical expressivityScore values (oldest first).
 * @param latestScore - Latest expressivityScore value.
 * @returns Discriminated union of InsufficientHistoryResult or UsualRangeResult.
 */
export function evaluateExpressivityRange(
  pastScores: readonly number[],
  latestScore: number
): ExpressivityRangeResult {
  if (!Array.isArray(pastScores)) {
    throw new TypeError("pastScores must be an array");
  }

  const validatedPast = pastScores.map((score, i) =>
    validateScore(score, `pastScores[${i}]`)
  );
  const validatedLatest = validateScore(latestScore, "latestScore");

  if (validatedPast.length < MIN_EXPRESSIVITY_HISTORY) {
    return {
      status: "insufficient_history",
      kind: "insufficient_history",
      count: validatedPast.length,
      minimum: MIN_EXPRESSIVITY_HISTORY,
    };
  }

  // Reuse existing personal baseline calculation
  const baseline = computePersonalBaseline(validatedPast, {
    minBaselineSamples: MIN_EXPRESSIVITY_HISTORY,
  });

  if (!baseline.ok) {
    throw new Error(`Personal baseline calculation failed: ${baseline.error}`);
  }

  const { mean, sd, sampleCount } = baseline.value;

  // Awkward case: zero spread (all historical readings equal)
  if (sd === 0) {
    let position: ExpressivityPosition;
    if (Math.abs(validatedLatest - mean) < 1e-9) {
      position = "within_usual_range";
    } else if (validatedLatest < mean) {
      position = "below_usual_range";
    } else {
      position = "above_usual_range";
    }

    return {
      status: position,
      kind: "usual_range",
      position,
      mean,
      lower: mean,
      upper: mean,
      sd: 0,
      sampleCount,
    };
  }

  const spread = USUAL_RANGE_SD_MULTIPLIER * sd;
  const lower = mean - spread;
  const upper = mean + spread;

  let position: ExpressivityPosition;
  if (validatedLatest < lower) {
    position = "below_usual_range";
  } else if (validatedLatest > upper) {
    position = "above_usual_range";
  } else {
    position = "within_usual_range";
  }

  return {
    status: position,
    kind: "usual_range",
    position,
    mean,
    lower,
    upper,
    sd,
    sampleCount,
  };
}
