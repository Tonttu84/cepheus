import type {
  FitbitDayRawBundle,
  FitbitIntradayPoint,
  FitbitMappedDay,
  FitbitSleepLog,
} from "./types";

const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;

const SLEEP_STATE_LEVELS = new Set([
  "light",
  "deep",
  "rem",
  "asleep",
  "restless",
]);

const WAKE_STATE_LEVELS = new Set(["wake", "awake"]);

/**
 * Parses an ISO-like local timestamp ("YYYY-MM-DDTHH:MM:SS[.sss]") into UTC-epoch ms
 * treating its wall-clock fields uniformly so relative offsets between two local
 * timestamps on adjacent days are timezone-independent.
 */
function parseWallClockMs(isoLike: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(
    isoLike.trim()
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function parseDateMidnightMs(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0);
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Computes sleep midpoint in minutes relative to `targetDate` midnight (00:00).
 * Example: 23:15 on targetDate-1 (-45) to 07:15 on targetDate (+435) => +195 (03:15).
 */
export function computeSleepMidpointMin(
  bedtimeStartIso: string,
  bedtimeEndIso: string,
  targetDate: string
): number | null {
  const midnightMs = parseDateMidnightMs(targetDate);
  const startMs = parseWallClockMs(bedtimeStartIso);
  const endMs = parseWallClockMs(bedtimeEndIso);
  if (midnightMs === null || startMs === null || endMs === null) {
    return null;
  }
  if (endMs <= startMs) {
    return null;
  }
  const startMin = (startMs - midnightMs) / MS_PER_MINUTE;
  const endMin = (endMs - midnightMs) / MS_PER_MINUTE;
  return roundTo((startMin + endMin) / 2, 1);
}

/**
 * Builds an exact 1440-character '0'/'1' sleep/wake grid for `targetDate`
 * ('1' = asleep, '0' = awake) from Fitbit sleep logs.
 * Returns null if no sleep logs overlap the target calendar day.
 */
export function buildSleepWakeGridFromFitbit(
  sleepLogs: readonly FitbitSleepLog[],
  targetDate: string
): string | null {
  const dayStartMs = parseDateMidnightMs(targetDate);
  if (dayStartMs === null || sleepLogs.length === 0) {
    return null;
  }
  const dayEndMs = dayStartMs + MINUTES_PER_DAY * MS_PER_MINUTE;
  const grid = new Array<string>(MINUTES_PER_DAY).fill("0");
  let anyOverlap = false;

  const fillRange = (startMs: number, endMs: number, char: "0" | "1") => {
    const clampedStart = Math.max(dayStartMs, startMs);
    const clampedEnd = Math.min(dayEndMs, endMs);
    if (clampedEnd <= clampedStart) return;
    anyOverlap = true;
    const startIdx = Math.max(
      0,
      Math.floor((clampedStart - dayStartMs) / MS_PER_MINUTE)
    );
    const endIdx = Math.min(
      MINUTES_PER_DAY,
      Math.ceil((clampedEnd - dayStartMs) / MS_PER_MINUTE)
    );
    for (let i = startIdx; i < endIdx; i++) {
      grid[i] = char;
    }
  };

  for (const log of sleepLogs) {
    const segments = [
      ...(log.levels?.data ?? []),
      ...(log.levels?.shortData ?? []),
    ];

    if (segments.length > 0) {
      for (const seg of segments) {
        if (!Number.isFinite(seg.seconds) || seg.seconds <= 0) continue;
        const segStart = parseWallClockMs(seg.dateTime);
        if (segStart === null) continue;
        const segEnd = segStart + seg.seconds * 1000;
        const lvl = seg.level.toLowerCase();
        if (SLEEP_STATE_LEVELS.has(lvl)) {
          fillRange(segStart, segEnd, "1");
        } else if (WAKE_STATE_LEVELS.has(lvl)) {
          fillRange(segStart, segEnd, "0");
        }
      }
    } else {
      const startMs = parseWallClockMs(log.startTime);
      const endMs = parseWallClockMs(log.endTime);
      if (startMs !== null && endMs !== null && endMs > startMs) {
        fillRange(startMs, endMs, "1");
      }
    }
  }

  return anyOverlap ? grid.join("") : null;
}

/**
 * Aggregates Fitbit intraday step entries into a 24-element hourly activity array.
 * Hours with no intraday entries stay `null` rather than being coerced to 0.
 */
export function buildHourlyActivityFromFitbit(
  intraday: readonly FitbitIntradayPoint[] | null | undefined
): { hourly: (number | null)[]; validHours: number } {
  const sums = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);

  if (Array.isArray(intraday)) {
    for (const pt of intraday) {
      if (typeof pt.value !== "number" || !Number.isFinite(pt.value) || pt.value < 0) {
        continue;
      }
      const match = /^(\d{2}):(\d{2})/.exec(pt.time.trim());
      if (!match) continue;
      const hour = Number(match[1]);
      if (hour >= 0 && hour < 24) {
        sums[hour] += pt.value;
        counts[hour] += 1;
      }
    }
  }

  let validHours = 0;
  const hourly = new Array<number | null>(24).fill(null);
  for (let h = 0; h < 24; h++) {
    if (counts[h] > 0) {
      hourly[h] = roundTo(sums[h], 2);
      validHours += 1;
    }
  }

  return { hourly, validHours };
}

function selectPrimarySleepLog(
  sleepLogs: readonly FitbitSleepLog[],
  targetDate: string
): FitbitSleepLog | null {
  const onDate = sleepLogs.filter((s) => s.dateOfSleep === targetDate);
  const candidates = onDate.length > 0 ? onDate : sleepLogs;
  if (candidates.length === 0) return null;

  const main = candidates.find((s) => s.isMainSleep);
  if (main) return main;

  return candidates.reduce((best, cur) => {
    const bestDur = best.minutesAsleep ?? best.timeInBed ?? 0;
    const curDur = cur.minutesAsleep ?? cur.timeInBed ?? 0;
    return curDur > bestDur ? cur : best;
  });
}

function countWakeBouts(log: FitbitSleepLog | null): number | null {
  if (!log) return null;
  const data = log.levels?.data;
  if (!data || data.length === 0) return null;
  let bouts = 0;
  for (const seg of data) {
    if (WAKE_STATE_LEVELS.has(seg.level.toLowerCase()) && seg.seconds >= 60) {
      bouts += 1;
    }
  }
  return bouts;
}

/**
 * Maps one calendar day of Fitbit sleep, activity, and heart-rate responses
 * into a Cepheus `FitbitMappedDay` ready for `RingDay` persistence and
 * `computeRhythmWindow()` calculations.
 */
export function mapFitbitDayToRingDay(
  bundle: FitbitDayRawBundle
): FitbitMappedDay {
  const { date, dayIndex, sleepLogs, activity, heart } = bundle;

  const primarySleep = selectPrimarySleepLog(sleepLogs, date);
  const sleepWakeGrid = buildSleepWakeGridFromFitbit(sleepLogs, date);
  const sleepMidpointMin = primarySleep
    ? computeSleepMidpointMin(primarySleep.startTime, primarySleep.endTime, date)
    : null;

  const { hourly, validHours } = buildHourlyActivityFromFitbit(
    activity?.intradaySteps ?? null
  );
  const intradayAvailable = validHours > 0;

  const steps =
    typeof activity?.steps === "number" && Number.isFinite(activity.steps)
      ? Math.max(0, Math.round(activity.steps))
      : null;

  const activeCaloriesKcal =
    typeof activity?.activityCalories === "number" &&
    Number.isFinite(activity.activityCalories)
      ? roundTo(Math.max(0, activity.activityCalories), 1)
      : typeof activity?.caloriesOut === "number" &&
          Number.isFinite(activity.caloriesOut)
        ? roundTo(Math.max(0, activity.caloriesOut), 1)
        : null;

  const restingHr =
    typeof heart?.restingHeartRate === "number" &&
    Number.isFinite(heart.restingHeartRate) &&
    heart.restingHeartRate > 25 &&
    heart.restingHeartRate < 220
      ? roundTo(heart.restingHeartRate, 1)
      : null;

  const timeInBedMin =
    primarySleep?.timeInBed !== undefined
      ? roundTo(primarySleep.timeInBed, 1)
      : null;
  const totalSleepMin =
    primarySleep?.minutesAsleep !== undefined
      ? roundTo(primarySleep.minutesAsleep, 1)
      : null;
  const wasoMinutes =
    primarySleep?.minutesAwake !== undefined
      ? roundTo(primarySleep.minutesAwake, 1)
      : null;

  const hasAnySignal =
    primarySleep !== null ||
    (steps !== null && steps > 0) ||
    restingHr !== null ||
    validHours > 0;

  const estimatedWearMinutes = intradayAvailable
    ? validHours * 60
    : hasAnySignal
      ? 1200
      : 0;

  return {
    date,
    dayIndex,
    ringActive: hasAnySignal,
    wearMinutes: estimatedWearMinutes,
    steps,
    activeCaloriesKcal,
    hourlyActivity: hourly,
    intradayAvailable,
    bedtimeStartIso: primarySleep?.startTime ?? null,
    bedtimeEndIso: primarySleep?.endTime ?? null,
    sleepMidpointMin,
    timeInBedMin,
    totalSleepMin,
    wasoMinutes,
    nightActivityBouts: countWakeBouts(primarySleep),
    lowestHrBpm: restingHr,
    avgHrBpm: restingHr,
    sleepWakeGrid,
    isSimulated: false,
    source: "fitbit",
  };
}
