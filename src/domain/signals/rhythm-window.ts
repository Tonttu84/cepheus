/**
 * Rhythm Window calculations
 * Runs Interdaily Stability (IS), Intradaily Variability (IV), Relative Amplitude (RA),
 * and Sleep Regularity Index (SRI) over rolling windows of days.
 * Produces records fitting the Prisma RhythmWindow model shape.
 *
 * Sources:
 * - IS and IV: Witting et al. (1990) Biol Psychiatry 27:563-572
 * - M10, L5, RA: van Someren et al. (1999) Chronobiol Int 16:505-518
 * - SRI: Phillips et al. (2017) Sci Rep 7:3216
 */

import { resolveConfig } from "./config";
import { computeInterdailyStability } from "./interdaily-stability";
import { computeIntradailyVariability } from "./intradaily-variability";
import { computeBaselineDeviation } from "./personal-baseline";
import { computeRelativeAmplitude } from "./relative-amplitude";
import { computeSleepRegularityIndex } from "./sleep-regularity";
import type {
  DayWindowInput,
  PersonalBaselineStats,
  Result,
  RhythmWindowOutput,
  SignalsConfig,
} from "./types";
import { validateDayActivity } from "./validation";

export interface WindowBaselines {
  readonly raBaseline?: PersonalBaselineStats | null;
  readonly isBaseline?: PersonalBaselineStats | null;
  readonly sriBaseline?: PersonalBaselineStats | null;
}

function roundTo(val: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function computeMean(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

function computeSampleSd(nums: readonly number[]): number | null {
  if (nums.length < 2) return null;
  const m = computeMean(nums);
  if (m === null) return null;
  let sq = 0;
  for (const n of nums) {
    const d = n - m;
    sq += d * d;
  }
  return Math.sqrt(sq / (nums.length - 1));
}

function computeZScore(
  baseline: PersonalBaselineStats | null | undefined,
  value: number | null
): number | null {
  if (!baseline || value === null) return null;
  const dev = computeBaselineDeviation(baseline, value);
  return dev.ok ? roundTo(dev.value.zScore, 2) : null;
}

function countValidDays(
  days: readonly DayWindowInput[],
  minHours: number
): Result<number> {
  let validCount = 0;
  for (const d of days) {
    const val = validateDayActivity(
      { date: d.date, dayIndex: d.dayIndex, hourlyActivity: d.hourlyActivity },
      minHours
    );
    if (!val.ok) return val;
    if (val.value.isValidDay) validCount++;
  }
  return { ok: true, value: validCount };
}

interface SecondarySummaries {
  readonly midpointSd: number | null;
  readonly wasoMean: number | null;
  readonly stepsMean: number | null;
}

function computeSecondarySummaries(
  days: readonly DayWindowInput[]
): SecondarySummaries {
  const midpoints = days
    .map((d) => d.sleepMidpointMin)
    .filter((v): v is number => v !== null && v !== undefined);
  const wasoVals = days
    .map((d) => d.wasoMinutes)
    .filter((v): v is number => v !== null && v !== undefined);
  const stepVals = days
    .map((d) => d.steps)
    .filter((v): v is number => v !== null && v !== undefined);

  return {
    midpointSd: computeSampleSd(midpoints),
    wasoMean: computeMean(wasoVals),
    stepsMean: computeMean(stepVals),
  };
}

interface CoreCircadianSignals {
  readonly is: number;
  readonly iv: number;
  readonly ra: {
    readonly m10: number;
    readonly l5: number;
    readonly relativeAmplitude: number;
  };
}

function computeCoreCircadianSignals(
  days: readonly DayWindowInput[],
  cfg: SignalsConfig
): Result<CoreCircadianSignals> {
  const actDays = days.map((d) => ({
    date: d.date,
    dayIndex: d.dayIndex,
    hourlyActivity: d.hourlyActivity,
  }));

  const isRes = computeInterdailyStability(actDays, cfg);
  if (!isRes.ok) return isRes;
  const ivRes = computeIntradailyVariability(actDays, cfg);
  if (!ivRes.ok) return ivRes;
  const raRes = computeRelativeAmplitude(actDays, cfg);
  if (!raRes.ok) return raRes;

  return {
    ok: true,
    value: { is: isRes.value, iv: ivRes.value, ra: raRes.value },
  };
}

/**
 * Compute rhythm window metrics across a window of days.
 * Fits the Prisma RhythmWindow model fields.
 */
export function computeRhythmWindow(
  days: readonly DayWindowInput[],
  baselines?: WindowBaselines,
  config?: Partial<SignalsConfig>
): Result<RhythmWindowOutput> {
  const cfg = resolveConfig(config);
  if (days.length === 0) {
    return { ok: false, error: "Days array cannot be empty" };
  }

  const validRes = countValidDays(days, cfg.minValidHoursPerDay);
  if (!validRes.ok) return validRes;
  const validDaysCount = validRes.value;

  // Ruling a: fewer than configured valid days gives no value
  if (validDaysCount < cfg.minValidDays) {
    return {
      ok: false,
      error: `Insufficient valid days: found ${validDaysCount}, minimum required is ${cfg.minValidDays}`,
    };
  }

  const coreRes = computeCoreCircadianSignals(days, cfg);
  if (!coreRes.ok) return coreRes;
  const { is, iv, ra } = coreRes.value;

  const sleepDays = days.map((d) => ({
    date: d.date,
    dayIndex: d.dayIndex,
    sleepWakeGrid: d.sleepWakeGrid ?? null,
  }));
  const sriRes = computeSleepRegularityIndex(sleepDays, cfg);
  const { midpointSd, wasoMean, stepsMean } = computeSecondarySummaries(days);

  const lastDay = days[days.length - 1];
  const sriVal = sriRes.ok ? roundTo(sriRes.value, 2) : null;
  const raVal = roundTo(ra.relativeAmplitude, 3);
  const isVal = roundTo(is, 3);

  return {
    ok: true,
    value: {
      windowEndDate: lastDay.date,
      dayIndex: lastDay.dayIndex,
      windowDays: days.length,
      validDays: validDaysCount,
      m10: roundTo(ra.m10, 2),
      l5: roundTo(ra.l5, 2),
      relativeAmplitude: raVal,
      interdailyStability: isVal,
      intradailyVariability: roundTo(iv, 3),
      sri: sriVal,
      sleepMidpointSdMin: midpointSd !== null ? roundTo(midpointSd, 2) : null,
      wasoMeanMin: wasoMean !== null ? roundTo(wasoMean, 2) : null,
      stepsMean: stepsMean !== null ? roundTo(stepsMean, 1) : null,
      raZScore: computeZScore(baselines?.raBaseline, raVal),
      isZScore: computeZScore(baselines?.isBaseline, isVal),
      sriZScore: computeZScore(baselines?.sriBaseline, sriVal),
      isSimulated: days.some((d) => d.isSimulated === true),
    },
  };
}

/**
 * Run rhythm calculations over a sliding moving window of days.
 * Returns one result per rolling window.
 */
export function computeMovingRhythmWindows(
  days: readonly DayWindowInput[],
  baselines?: WindowBaselines,
  config?: Partial<SignalsConfig>
): Result<RhythmWindowOutput>[] {
  const cfg = resolveConfig(config);
  const winLen = cfg.windowDays;

  if (days.length < winLen) {
    return [
      {
        ok: false,
        error: `Insufficient days for window: found ${days.length}, window length is ${winLen}`,
      },
    ];
  }

  const results: Result<RhythmWindowOutput>[] = [];
  for (let i = winLen - 1; i < days.length; i++) {
    const slice = days.slice(i - winLen + 1, i + 1);
    results.push(computeRhythmWindow(slice, baselines, cfg));
  }

  return results;
}
