/**
 * Default configuration parameters for rest-activity circadian signals and baseline calculations.
 * All thresholds and window sizes live here and can be overridden by caller.
 */

import type { SignalsConfig } from "./types";

export const DEFAULT_SIGNALS_CONFIG: SignalsConfig = Object.freeze({
  /** Minimum valid days required for a rhythm window (ruling a: default 7). */
  minValidDays: 7,
  /** Default moving window length in days. */
  windowDays: 7,
  /** Minimum valid hours per day (ruling b: default 20 of 24). */
  minValidHoursPerDay: 20,
  /** Minimum usable share of consecutive minute pairs for SRI (ruling d: default 0.70). */
  minSriUsableShare: 0.70,
  /** Minimum number of historical samples required for baseline (ruling e: default 7). */
  minBaselineSamples: 7,
});

/** Merge user-provided partial config with default values. */
export function resolveConfig(overrides?: Partial<SignalsConfig>): SignalsConfig {
  if (!overrides) return DEFAULT_SIGNALS_CONFIG;
  return {
    minValidDays: overrides.minValidDays ?? DEFAULT_SIGNALS_CONFIG.minValidDays,
    windowDays: overrides.windowDays ?? DEFAULT_SIGNALS_CONFIG.windowDays,
    minValidHoursPerDay:
      overrides.minValidHoursPerDay ?? DEFAULT_SIGNALS_CONFIG.minValidHoursPerDay,
    minSriUsableShare:
      overrides.minSriUsableShare ?? DEFAULT_SIGNALS_CONFIG.minSriUsableShare,
    minBaselineSamples:
      overrides.minBaselineSamples ?? DEFAULT_SIGNALS_CONFIG.minBaselineSamples,
  };
}
