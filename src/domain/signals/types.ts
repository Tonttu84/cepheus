/**
 * Types for rest-activity circadian rhythm and personal baseline calculations.
 * Domain layer: pure TypeScript, no external dependencies, no diagnostics or clinical labels.
 */

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Configuration object holding all tunable parameters with defaults. */
export interface SignalsConfig {
  /** Minimum number of valid days required for a window calculation (default: 7). */
  readonly minValidDays: number;
  /** Length of the rolling rhythm window in calendar days (default: 7). */
  readonly windowDays: number;
  /** Minimum number of valid hours required for a day to be counted as valid (default: 20). */
  readonly minValidHoursPerDay: number;
  /** Minimum share of usable consecutive minute pairs for SRI (default: 0.70). */
  readonly minSriUsableShare: number;
  /** Minimum number of samples required to establish a personal baseline (default: 7). */
  readonly minBaselineSamples: number;
}

/** Input for a single day of hourly activity. */
export interface DayActivityInput {
  readonly date: string;
  readonly dayIndex?: number;
  readonly hourlyActivity: readonly (number | null)[] | string;
}

/** Input for a single day of sleep/wake minute data. */
export interface DaySleepInput {
  readonly date: string;
  readonly dayIndex?: number;
  readonly sleepWakeGrid: string | null;
}

/** Input for a single day in a rhythm window. */
export interface DayWindowInput {
  readonly date: string;
  readonly dayIndex: number;
  readonly hourlyActivity: readonly (number | null)[] | string;
  readonly sleepWakeGrid?: string | null;
  readonly sleepMidpointMin?: number | null;
  readonly wasoMinutes?: number | null;
  readonly steps?: number | null;
  readonly isSimulated?: boolean;
}

/** Non-parametric relative amplitude result with M10, L5 and start hours. */
export interface RelativeAmplitudeResult {
  readonly m10: number;
  readonly m10StartHour: number;
  readonly l5: number;
  readonly l5StartHour: number;
  readonly relativeAmplitude: number;
}

/** Summary statistics for a personal baseline. */
export interface PersonalBaselineStats {
  readonly sampleCount: number;
  readonly mean: number;
  readonly sd: number;
  readonly median: number;
  readonly iqr: number;
}

/** Difference of a new value from a personal baseline. */
export interface BaselineDeviationResult {
  readonly zScore: number;
  readonly medianDiffIqr: number | null;
}

/** Output matching the Prisma RhythmWindow model shape. */
export interface RhythmWindowOutput {
  readonly windowEndDate: string;
  readonly dayIndex: number;
  readonly windowDays: number;
  readonly validDays: number;
  readonly m10: number;
  readonly l5: number;
  readonly relativeAmplitude: number;
  readonly interdailyStability: number;
  readonly intradailyVariability: number;
  readonly sri: number | null;
  readonly sleepMidpointSdMin: number | null;
  readonly wasoMeanMin: number | null;
  readonly stepsMean: number | null;
  readonly raZScore: number | null;
  readonly isZScore: number | null;
  readonly sriZScore: number | null;
  readonly isSimulated: boolean;
}
