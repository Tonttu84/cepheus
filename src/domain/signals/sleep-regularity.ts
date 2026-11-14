/**
 * Sleep Regularity Index (SRI)
 * Source: Phillips, A. J. K., Clerx, W. M., O'Brien, C. S., Sano, A., Barger, L. K., Yost, K. E., ... & Czeisler, C. A. (2017).
 * Irregular sleep/wake patterns are associated with poorer academic performance and delayed circadian and sleep/wake timing.
 * Scientific Reports, 7(1), 3216.
 *
 * Formula:
 * SRI = 200 * P(same state at minute m on day d and day d+1) - 100
 * where:
 *   P(same) = matches / totalUsablePairs
 *   Pairs are formed by comparing minute m between day d and day d+1 for all m in 0..1439
 *   where both days have valid data (ruling d).
 *
 * Range: [-100, 100]
 *   100 = identical sleep pattern every day
 *   0 = random / uncorrelated
 *   -100 = sleep exactly inverted on alternate days
 */

import { resolveConfig } from "./config";
import type { DaySleepInput, Result, SignalsConfig } from "./types";
import { validateSleepWakeGrid } from "./validation";

interface PairComparison {
  readonly matches: number;
  readonly usableMinutes: number;
}

/**
 * Count matching and usable minutes between two consecutive days' sleep grids.
 * Both grids must be present (1440 characters) to form usable minute pairs.
 */
function countMatchingMinutes(
  gridA: string | null,
  gridB: string | null
): PairComparison {
  if (gridA === null || gridB === null) {
    return { matches: 0, usableMinutes: 0 };
  }
  let matches = 0;
  for (let m = 0; m < 1440; m++) {
    if (gridA.charCodeAt(m) === gridB.charCodeAt(m)) {
      matches++;
    }
  }
  return { matches, usableMinutes: 1440 };
}

/**
 * Compute the Sleep Regularity Index (SRI) across consecutive days in a window.
 * Evaluates the probability of being in the same sleep/wake state 24h apart.
 */
export function computeSleepRegularityIndex(
  days: readonly DaySleepInput[],
  config?: Partial<SignalsConfig>
): Result<number> {
  const cfg = resolveConfig(config);

  // Ruling a: fewer than configured valid days gives no value
  if (days.length < cfg.minValidDays) {
    return {
      ok: false,
      error: `Insufficient valid days: found ${days.length}, minimum required is ${cfg.minValidDays}`,
    };
  }

  // Validate sleep-wake grids (ruling f: length 1440 and characters '0'/'1' only)
  const grids: (string | null)[] = [];
  for (const day of days) {
    const validated = validateSleepWakeGrid(day.sleepWakeGrid);
    if (!validated.ok) return validated;
    grids.push(validated.value);
  }

  // Total possible pairs across consecutive calendar days in the window
  const totalTransitionsPossible = days.length - 1;
  const maxPossiblePairs = totalTransitionsPossible * 1440;

  let matches = 0;
  let usablePairs = 0;

  for (let d = 0; d < totalTransitionsPossible; d++) {
    const comparison = countMatchingMinutes(grids[d], grids[d + 1]);
    matches += comparison.matches;
    usablePairs += comparison.usableMinutes;
  }

  // Ruling d: requires minimum share of usable minute pairs
  const usableShare = maxPossiblePairs > 0 ? usablePairs / maxPossiblePairs : 0;
  if (usableShare < cfg.minSriUsableShare) {
    return {
      ok: false,
      error: `Insufficient usable minute pairs: share ${(usableShare * 100).toFixed(1)}% is below required ${(cfg.minSriUsableShare * 100).toFixed(1)}%`,
    };
  }

  if (usablePairs === 0) {
    return {
      ok: false,
      error: "Division by zero: no usable minute pairs available",
    };
  }

  const probSame = matches / usablePairs;
  const rawSri = 200 * probSame - 100;
  const boundedSri = Math.min(100, Math.max(-100, rawSri));
  return { ok: true, value: boundedSri };
}
