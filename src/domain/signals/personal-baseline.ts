/**
 * Personal Baseline and Deviation Metrics
 * Source: Standard parametric and non-parametric summary statistics; see also
 * Tonon, A. C., et al. (2026). Sleep and rest-activity rhythms in depression relapse. JAMA Psychiatry.
 *
 * Formulas:
 * 1. Arithmetic mean: mean = (1 / n) * sum(x_i)
 * 2. Sample standard deviation: sd = sqrt( (1 / (n - 1)) * sum((x_i - mean)^2) )
 * 3. Median and Interquartile Range (IQR): linear interpolation quantile method (R Type 7).
 *    median = Q(0.50), iqr = Q(0.75) - Q(0.25)
 * 4. Z-score: z = (newValue - mean) / sd
 * 5. Difference from median in IQRs: (newValue - median) / iqr
 */

import { resolveConfig } from "./config";
import type {
  BaselineDeviationResult,
  PersonalBaselineStats,
  Result,
  SignalsConfig,
} from "./types";
import { validateFiniteNumbers } from "./validation";

/** Compute quantile via linear interpolation (R Type 7 / numpy default). */
function computeQuantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/** Compute sample standard deviation using (n - 1) degrees of freedom. */
function computeSampleSd(values: readonly number[], mean: number): number {
  if (values.length <= 1) return 0;
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Compute personal baseline summary statistics (mean, SD, median, IQR)
 * from a person's historical values of a measure.
 */
export function computePersonalBaseline(
  values: readonly number[],
  config?: Partial<SignalsConfig>
): Result<PersonalBaselineStats> {
  const cfg = resolveConfig(config);

  const validated = validateFiniteNumbers(values);
  if (!validated.ok) return validated;

  const n = values.length;
  // Ruling e: fewer than configured values gives no baseline
  if (n < cfg.minBaselineSamples) {
    return {
      ok: false,
      error: `Insufficient sample count for baseline: found ${n}, minimum required is ${cfg.minBaselineSamples}`,
    };
  }

  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  const sd = computeSampleSd(values, mean);

  const sorted = [...values].sort((a, b) => a - b);
  const median = computeQuantile(sorted, 0.5);
  const q25 = computeQuantile(sorted, 0.25);
  const q75 = computeQuantile(sorted, 0.75);
  const iqr = q75 - q25;

  return {
    ok: true,
    value: {
      sampleCount: n,
      mean,
      sd,
      median,
      iqr,
    },
  };
}

/**
 * Compute deviation of a new value from a person's baseline:
 * parametric z-score and non-parametric difference from median in IQRs.
 */
export function computeBaselineDeviation(
  baseline: PersonalBaselineStats,
  newValue: number
): Result<BaselineDeviationResult> {
  // Ruling f: input must be a finite number
  if (typeof newValue !== "number" || !Number.isFinite(newValue)) {
    return {
      ok: false,
      error: `New value must be a finite number, received ${String(newValue)}`,
    };
  }

  // Ruling e: baseline with zero spread gives no z-score
  if (baseline.sd === 0) {
    return {
      ok: false,
      error: "Zero spread: baseline standard deviation is zero, z-score is undefined",
    };
  }

  const zScore = (newValue - baseline.mean) / baseline.sd;
  const medianDiffIqr =
    baseline.iqr > 0 ? (newValue - baseline.median) / baseline.iqr : null;

  return {
    ok: true,
    value: {
      zScore,
      medianDiffIqr,
    },
  };
}
