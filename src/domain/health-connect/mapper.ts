import {
  MINUTES_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  getDateMidnightEpochMs,
  parseIsoWithWallContext,
  toWallContext,
} from "./time";
import type {
  HealthConnectMappedDay,
  HealthConnectSleepRecord,
  HealthConnectSleepStage,
  HealthConnectStepRecord,
  HealthConnectWebhookPayload,
} from "./types";

function isWakeStage(stageName: string): boolean {
  const s = stageName.trim().toLowerCase();
  return (
    s === "awake" ||
    s === "awake_in_bed" ||
    s === "out_of_bed" ||
    s.includes("stage_type_awake")
  );
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function summarizeSleepStages(
  stages: readonly HealthConnectSleepStage[],
  timeInBedMin: number,
  timezone?: string
) {
  let wakeSec = 0;
  let sleepSec = 0;
  let bouts = 0;
  for (const st of stages) {
    const s0 = parseIsoWithWallContext(st.start_time, { timezone })?.epochMs;
    const s1 = parseIsoWithWallContext(st.end_time, { timezone })?.epochMs;
    const sec =
      st.duration_seconds ??
      (s0 !== undefined && s1 !== undefined ? Math.max(0, (s1 - s0) / 1000) : 0);
    if (isWakeStage(st.stage)) {
      wakeSec += sec;
      if (sec >= 60) bouts += 1;
    } else {
      sleepSec += sec;
    }
  }
  const wasoMinutes = roundTo(wakeSec / 60, 1);
  const totalSleepMin =
    sleepSec > 0
      ? roundTo(sleepSec / 60, 1)
      : roundTo(Math.max(0, timeInBedMin - wasoMinutes), 1);
  return { wasoMinutes, totalSleepMin, nightActivityBouts: bouts };
}

function computePrimarySleepMetrics(
  primary: HealthConnectSleepRecord | null,
  dayStartMs: number,
  timezone?: string
) {
  const empty = {
    bedtimeStartIso: null,
    bedtimeEndIso: null,
    sleepMidpointMin: null,
    timeInBedMin: null,
    totalSleepMin: null,
    wasoMinutes: null,
    nightActivityBouts: null,
  };
  if (!primary) return empty;
  const endParsed = parseIsoWithWallContext(primary.session_end_time, {
    metadata: primary.metadata,
    timezone,
  });
  if (!endParsed) return empty;

  const startMs = primary.start_time
    ? parseIsoWithWallContext(primary.start_time, {
        metadata: primary.metadata,
        timezone,
      })?.epochMs ?? endParsed.epochMs - primary.duration_seconds * 1000
    : endParsed.epochMs - primary.duration_seconds * 1000;

  const timeInBedMin = roundTo(primary.duration_seconds / 60, 1);
  const sleepMidpointMin = roundTo(
    ((startMs - dayStartMs) / MS_PER_MINUTE +
      (endParsed.epochMs - dayStartMs) / MS_PER_MINUTE) /
      2,
    1
  );

  const stageSummary =
    primary.stages && primary.stages.length > 0
      ? summarizeSleepStages(primary.stages, timeInBedMin, timezone)
      : { wasoMinutes: 0, totalSleepMin: timeInBedMin, nightActivityBouts: 0 };

  return {
    bedtimeStartIso: new Date(startMs).toISOString(),
    bedtimeEndIso: new Date(endParsed.epochMs).toISOString(),
    sleepMidpointMin,
    timeInBedMin,
    ...stageSummary,
  };
}

function paintSleepRecord(
  rec: HealthConnectSleepRecord,
  fillRange: (startMs: number, endMs: number, char: "0" | "1") => void,
  timezone?: string
): void {
  const endParsed = parseIsoWithWallContext(rec.session_end_time, {
    metadata: rec.metadata,
    timezone,
  });
  if (!endParsed) return;
  const sessionStartMs = rec.start_time
    ? parseIsoWithWallContext(rec.start_time, { metadata: rec.metadata, timezone })
        ?.epochMs ?? endParsed.epochMs - rec.duration_seconds * 1000
    : endParsed.epochMs - rec.duration_seconds * 1000;

  if (!rec.stages || rec.stages.length === 0) {
    fillRange(sessionStartMs, endParsed.epochMs, "1");
    return;
  }
  for (const st of rec.stages) {
    const s0 = parseIsoWithWallContext(st.start_time, { timezone })?.epochMs;
    const s1 = parseIsoWithWallContext(st.end_time, { timezone })?.epochMs;
    if (s0 !== undefined && s1 !== undefined && s1 > s0) {
      fillRange(s0, s1, isWakeStage(st.stage) ? "0" : "1");
    }
  }
}

function buildSleepGridForDate(
  sleepRecords: readonly HealthConnectSleepRecord[],
  targetDate: string,
  timezone?: string
) {
  const empty = {
    sleepWakeGrid: null,
    ...computePrimarySleepMetrics(null, 0, timezone),
  };
  if (sleepRecords.length === 0) return empty;

  const firstEnd = parseIsoWithWallContext(sleepRecords[0].session_end_time, {
    metadata: sleepRecords[0].metadata,
    timezone,
  });
  const dayStartMs = getDateMidnightEpochMs(targetDate, firstEnd?.offsetMin ?? 0);
  if (dayStartMs === null) return empty;

  const dayEndMs = dayStartMs + MINUTES_PER_DAY * MS_PER_MINUTE;
  const grid = new Array<string>(MINUTES_PER_DAY).fill("0");
  let anyOverlap = false;

  const fillRange = (startMs: number, endMs: number, char: "0" | "1") => {
    const s = Math.max(dayStartMs, startMs);
    const e = Math.min(dayEndMs, endMs);
    if (e <= s) return;
    anyOverlap = true;
    const idx0 = Math.max(0, Math.floor((s - dayStartMs) / MS_PER_MINUTE));
    const idx1 = Math.min(MINUTES_PER_DAY, Math.ceil((e - dayStartMs) / MS_PER_MINUTE));
    for (let i = idx0; i < idx1; i++) grid[i] = char;
  };

  let primary: HealthConnectSleepRecord | null = null;
  for (const rec of sleepRecords) {
    if (!primary || rec.duration_seconds > primary.duration_seconds) primary = rec;
    paintSleepRecord(rec, fillRange, timezone);
  }

  return {
    sleepWakeGrid: anyOverlap ? grid.join("") : null,
    ...computePrimarySleepMetrics(primary, dayStartMs, timezone),
  };
}

interface DayAccumulator {
  sleep: HealthConnectSleepRecord[];
  hourlySteps: number[];
  hourlyHasData: boolean[];
  rawStepTotal: number;
  hasRawSteps: boolean;
  rawCalorieTotal: number;
  hasRawCalories: boolean;
  hrValues: number[];
  hrMins: number[];
  restingHrValues: number[];
  hrvValues: number[];
  dailyTotalSteps?: number;
  dailyTotalCalories?: number;
}

function getOrCreateDay(map: Map<string, DayAccumulator>, date: string): DayAccumulator {
  let acc = map.get(date);
  if (!acc) {
    acc = {
      sleep: [],
      hourlySteps: new Array<number>(24).fill(0),
      hourlyHasData: new Array<boolean>(24).fill(false),
      rawStepTotal: 0,
      hasRawSteps: false,
      rawCalorieTotal: 0,
      hasRawCalories: false,
      hrValues: [],
      hrMins: [],
      restingHrValues: [],
      hrvValues: [],
    };
    map.set(date, acc);
  }
  return acc;
}

function recordStepSlice(
  byDate: Map<string, DayAccumulator>,
  localDate: string,
  localHour: number,
  steps: number
): void {
  const day = getOrCreateDay(byDate, localDate);
  day.hourlySteps[localHour] += steps;
  day.hourlyHasData[localHour] = true;
  day.rawStepTotal += steps;
  day.hasRawSteps = true;
}

function distributeMultiHourSteps(
  byDate: Map<string, DayAccumulator>,
  span: { startMs: number; endMs: number; offsetMin: number; val: number }
): void {
  const totalMs = span.endMs - span.startMs;
  let cursor = span.startMs;
  while (cursor < span.endMs) {
    const curCtx = toWallContext(cursor, span.offsetMin);
    const nextHourBoundary =
      Math.floor((cursor + span.offsetMin * MS_PER_MINUTE) / MS_PER_HOUR + 1) *
        MS_PER_HOUR -
      span.offsetMin * MS_PER_MINUTE;
    const sliceEnd = Math.min(span.endMs, nextHourBoundary);
    recordStepSlice(
      byDate,
      curCtx.localDate,
      curCtx.localHour,
      span.val * ((sliceEnd - cursor) / totalMs)
    );
    cursor = sliceEnd;
  }
}

function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function isValidBpm(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 25 && v < 230;
}

function isMultiHourStepSpan(
  startCtx: NonNullable<ReturnType<typeof parseIsoWithWallContext>>,
  endCtx: ReturnType<typeof parseIsoWithWallContext>
): endCtx is NonNullable<ReturnType<typeof parseIsoWithWallContext>> {
  if (!endCtx) return false;
  const totalMs = endCtx.epochMs - startCtx.epochMs;
  if (totalMs <= 0 || totalMs > 24 * MS_PER_HOUR) return false;
  return startCtx.localDate !== endCtx.localDate || startCtx.localHour !== endCtx.localHour;
}

function addStepRecord(
  byDate: Map<string, DayAccumulator>,
  st: HealthConnectStepRecord,
  timezone?: string
): void {
  const startTs = st.bucket_start ?? st.start_time ?? st.end_time ?? st.bucket_end;
  const val = st.total ?? st.count;
  if (!startTs || !isNonNegativeNumber(val)) return;

  const hint = { startZoneOffset: st.start_zone_offset, metadata: st.metadata, timezone };
  const startCtx = parseIsoWithWallContext(startTs, hint);
  if (!startCtx) return;

  const endTs = st.bucket_end ?? st.end_time;
  const endCtx = endTs ? parseIsoWithWallContext(endTs, hint) : null;
  if (!isMultiHourStepSpan(startCtx, endCtx)) {
    recordStepSlice(byDate, startCtx.localDate, startCtx.localHour, val);
    return;
  }
  distributeMultiHourSteps(byDate, {
    startMs: startCtx.epochMs,
    endMs: endCtx.epochMs,
    offsetMin: startCtx.offsetMin,
    val,
  });
}

function addHeartRateRecords(
  byDate: Map<string, DayAccumulator>,
  records: HealthConnectWebhookPayload["heart_rate"],
  tz?: string
): void {
  for (const hr of records ?? []) {
    const ts = hr.time ?? hr.start_time;
    const ctx = ts ? parseIsoWithWallContext(ts, { metadata: hr.metadata, timezone: tz }) : null;
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    const avg = hr.avg ?? hr.bpm;
    if (isValidBpm(avg)) day.hrValues.push(avg);
    const minVal = hr.min ?? hr.bpm;
    if (isValidBpm(minVal)) day.hrMins.push(minVal);
  }
}

function addRestingHrRecords(
  byDate: Map<string, DayAccumulator>,
  records: HealthConnectWebhookPayload["resting_heart_rate"],
  tz?: string
): void {
  for (const rhr of records ?? []) {
    const ts = rhr.time ?? rhr.start_time;
    if (!ts || !isValidBpm(rhr.bpm)) continue;
    const ctx = parseIsoWithWallContext(ts, { metadata: rhr.metadata, timezone: tz });
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    day.hrMins.push(rhr.bpm);
    day.restingHrValues.push(rhr.bpm);
  }
}

function addHrvRecords(
  byDate: Map<string, DayAccumulator>,
  records: HealthConnectWebhookPayload["heart_rate_variability"],
  tz?: string
): void {
  for (const hrv of records ?? []) {
    const ts = hrv.time ?? hrv.start_time;
    const ctx = ts ? parseIsoWithWallContext(ts, { metadata: hrv.metadata, timezone: tz }) : null;
    const val = hrv.rmssd_millis ?? hrv.heart_rate_variability_millis ?? hrv.rmssd ?? hrv.avg;
    if (ctx && typeof val === "number" && Number.isFinite(val) && val > 0 && val < 500) {
      getOrCreateDay(byDate, ctx.localDate).hrvValues.push(val);
    }
  }
}

function accumulateVitals(
  byDate: Map<string, DayAccumulator>,
  payload: HealthConnectWebhookPayload,
  tz?: string
): void {
  addHeartRateRecords(byDate, payload.heart_rate, tz);
  addRestingHrRecords(byDate, payload.resting_heart_rate, tz);
  addHrvRecords(byDate, payload.heart_rate_variability, tz);
}

function addCalorieRecords(
  byDate: Map<string, DayAccumulator>,
  records: HealthConnectWebhookPayload["active_calories"],
  tz?: string
): void {
  for (const cal of records ?? []) {
    const ts = cal.bucket_start ?? cal.start_time ?? cal.end_time ?? cal.bucket_end;
    const val = cal.calories ?? cal.energy_kcal ?? cal.kcal ?? cal.total;
    if (!ts || !isNonNegativeNumber(val)) continue;
    const ctx = parseIsoWithWallContext(ts, { metadata: cal.metadata, timezone: tz });
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    day.rawCalorieTotal += val;
    day.hasRawCalories = true;
  }
}

function addDailyTotals(
  byDate: Map<string, DayAccumulator>,
  totals: HealthConnectWebhookPayload["daily_totals"]
): void {
  for (const tot of totals ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot.date)) continue;
    const day = getOrCreateDay(byDate, tot.date);
    if (isNonNegativeNumber(tot.steps)) day.dailyTotalSteps = Math.round(tot.steps);
    const totalCal = tot.active_calories_kcal ?? tot.active_calories;
    if (isNonNegativeNumber(totalCal)) day.dailyTotalCalories = roundTo(totalCal, 1);
  }
}

function meanRounded(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return roundTo(values.reduce((a, b) => a + b, 0) / values.length, 1);
}

function buildHourlyArray(day: DayAccumulator): {
  hourlyActivity: (number | null)[];
  validHours: number;
} {
  const hourlyActivity: (number | null)[] = new Array<number | null>(24).fill(null);
  let validHours = 0;
  for (let h = 0; h < 24; h++) {
    if (day.hourlyHasData[h]) {
      hourlyActivity[h] = roundTo(day.hourlySteps[h], 1);
      validHours += 1;
    }
  }
  return { hourlyActivity, validHours };
}

function finalizeDay(
  date: string,
  dayIndex: number,
  day: DayAccumulator,
  meta: { isSimulated: boolean; source: HealthConnectMappedDay["source"]; timezone?: string }
): HealthConnectMappedDay {
  const sleepInfo = buildSleepGridForDate(day.sleep, date, meta.timezone);
  const { hourlyActivity, validHours } = buildHourlyArray(day);
  const steps = day.dailyTotalSteps ?? (day.hasRawSteps ? Math.round(day.rawStepTotal) : null);
  const activeCaloriesKcal =
    day.dailyTotalCalories ?? (day.hasRawCalories ? roundTo(day.rawCalorieTotal, 1) : null);
  const avgHrBpm = meanRounded(day.hrValues.length > 0 ? day.hrValues : day.restingHrValues);
  const lowestHrBpm = day.hrMins.length > 0 ? roundTo(Math.min(...day.hrMins), 1) : null;
  const avgHrvRmssdMs = meanRounded(day.hrvValues);
  const ringActive =
    sleepInfo.sleepWakeGrid !== null ||
    (steps !== null && steps > 0) ||
    avgHrBpm !== null ||
    validHours > 0;

  return {
    date,
    dayIndex,
    ringActive,
    wearMinutes: validHours > 0 ? validHours * 60 : ringActive ? 1200 : 0,
    steps,
    activeCaloriesKcal,
    hourlyActivity,
    ...sleepInfo,
    lowestHrBpm,
    avgHrBpm,
    avgHrvRmssdMs,
    isSimulated: meta.isSimulated,
    source: meta.source,
  };
}

/**
 * Maps a Health Connect / Apple Health webhook payload into chronological
 * `HealthConnectMappedDay[]` objects compatible with `RingDay` and `computeRhythmWindow`.
 */
export function mapHealthConnectPayloadToRingDays(
  payload: HealthConnectWebhookPayload
): HealthConnectMappedDay[] {
  const byDate = new Map<string, DayAccumulator>();
  const tz = payload.timezone;

  for (const s of payload.sleep ?? []) {
    const endCtx = parseIsoWithWallContext(s.session_end_time, {
      metadata: s.metadata,
      timezone: tz,
    });
    if (endCtx) getOrCreateDay(byDate, endCtx.localDate).sleep.push(s);
  }
  for (const st of payload.steps ?? []) addStepRecord(byDate, st, tz);
  addCalorieRecords(byDate, payload.active_calories, tz);
  addDailyTotals(byDate, payload.daily_totals);
  accumulateVitals(byDate, payload, tz);

  const isSimulated = Boolean(payload.isSimulated);
  const source: HealthConnectMappedDay["source"] = isSimulated
    ? "simulated_health_connect"
    : payload.source === "healthkit_ios"
      ? "healthkit_ios"
      : "health_connect";

  return [...byDate.keys()]
    .sort()
    .map((date, idx) =>
      finalizeDay(date, idx + 1, byDate.get(date)!, { isSimulated, source, timezone: tz })
    );
}
