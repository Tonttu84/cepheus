import type {
  HealthConnectMappedDay,
  HealthConnectSleepRecord,
  HealthConnectWebhookPayload,
} from "./types";

const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;

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

/**
 * Parses an ISO timestamp (with Z, +/-HH:MM offset, or local timestamp) into:
 * - epochMs: exact UTC milliseconds
 * - localDate: "YYYY-MM-DD" in the timestamp's stated offset (or UTC if Z / omitted)
 * - localHour: 0..23 in that offset
 */
function parseIsoWithWallContext(iso: string): {
  epochMs: number;
  localDate: string;
  localHour: number;
  offsetMin: number;
} | null {
  const trimmed = iso.trim();
  const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(trimmed);
  let offsetMin = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    offsetMin = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) {
    return null;
  }

  const shifted = new Date(parsedMs + offsetMin * MS_PER_MINUTE);
  const localDate = shifted.toISOString().slice(0, 10);
  const localHour = shifted.getUTCHours();

  return {
    epochMs: parsedMs,
    localDate,
    localHour,
    offsetMin,
  };
}

function getDateMidnightEpochMs(dateStr: string, offsetMin: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  return utcMidnight - offsetMin * MS_PER_MINUTE;
}

function buildSleepGridForDate(
  sleepRecords: readonly HealthConnectSleepRecord[],
  targetDate: string
): {
  sleepWakeGrid: string | null;
  bedtimeStartIso: string | null;
  bedtimeEndIso: string | null;
  sleepMidpointMin: number | null;
  timeInBedMin: number | null;
  totalSleepMin: number | null;
  wasoMinutes: number | null;
  nightActivityBouts: number | null;
} {
  if (sleepRecords.length === 0) {
    return {
      sleepWakeGrid: null,
      bedtimeStartIso: null,
      bedtimeEndIso: null,
      sleepMidpointMin: null,
      timeInBedMin: null,
      totalSleepMin: null,
      wasoMinutes: null,
      nightActivityBouts: null,
    };
  }

  // Use the offset from the first valid sleep end time (or UTC 0)
  const firstEnd = parseIsoWithWallContext(sleepRecords[0].session_end_time);
  const offsetMin = firstEnd?.offsetMin ?? 0;
  const dayStartMs = getDateMidnightEpochMs(targetDate, offsetMin);
  if (dayStartMs === null) {
    return {
      sleepWakeGrid: null,
      bedtimeStartIso: null,
      bedtimeEndIso: null,
      sleepMidpointMin: null,
      timeInBedMin: null,
      totalSleepMin: null,
      wasoMinutes: null,
      nightActivityBouts: null,
    };
  }
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
    for (let i = idx0; i < idx1; i++) {
      grid[i] = char;
    }
  };

  let primary: HealthConnectSleepRecord | null = null;
  for (const rec of sleepRecords) {
    if (!primary || rec.duration_seconds > primary.duration_seconds) {
      primary = rec;
    }
    const endParsed = parseIsoWithWallContext(rec.session_end_time);
    if (!endParsed) continue;
    const sessionStartMs = rec.start_time
      ? parseIsoWithWallContext(rec.start_time)?.epochMs ??
        endParsed.epochMs - rec.duration_seconds * 1000
      : endParsed.epochMs - rec.duration_seconds * 1000;

    if (rec.stages && rec.stages.length > 0) {
      for (const st of rec.stages) {
        const s0 = parseIsoWithWallContext(st.start_time)?.epochMs;
        const s1 = parseIsoWithWallContext(st.end_time)?.epochMs;
        if (s0 === undefined || s1 === undefined || s1 <= s0) continue;
        fillRange(s0, s1, isWakeStage(st.stage) ? "0" : "1");
      }
    } else {
      fillRange(sessionStartMs, endParsed.epochMs, "1");
    }
  }

  let bedtimeStartIso: string | null = null;
  let bedtimeEndIso: string | null = null;
  let sleepMidpointMin: number | null = null;
  let timeInBedMin: number | null = null;
  let totalSleepMin: number | null = null;
  let wasoMinutes: number | null = null;
  let nightActivityBouts: number | null = null;

  if (primary) {
    const endParsed = parseIsoWithWallContext(primary.session_end_time);
    if (endParsed) {
      const startMs = primary.start_time
        ? parseIsoWithWallContext(primary.start_time)?.epochMs ??
          endParsed.epochMs - primary.duration_seconds * 1000
        : endParsed.epochMs - primary.duration_seconds * 1000;
      bedtimeStartIso = new Date(startMs).toISOString();
      bedtimeEndIso = new Date(endParsed.epochMs).toISOString();
      timeInBedMin = roundTo(primary.duration_seconds / 60, 1);

      const startFromMidnight = (startMs - dayStartMs) / MS_PER_MINUTE;
      const endFromMidnight = (endParsed.epochMs - dayStartMs) / MS_PER_MINUTE;
      sleepMidpointMin = roundTo((startFromMidnight + endFromMidnight) / 2, 1);

      if (primary.stages && primary.stages.length > 0) {
        let wakeSec = 0;
        let sleepSec = 0;
        let bouts = 0;
        for (const st of primary.stages) {
          const s0 = parseIsoWithWallContext(st.start_time)?.epochMs;
          const s1 = parseIsoWithWallContext(st.end_time)?.epochMs;
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
        wasoMinutes = roundTo(wakeSec / 60, 1);
        totalSleepMin =
          sleepSec > 0 ? roundTo(sleepSec / 60, 1) : roundTo(Math.max(0, timeInBedMin - wasoMinutes), 1);
        nightActivityBouts = bouts;
      } else {
        totalSleepMin = timeInBedMin;
        wasoMinutes = 0;
        nightActivityBouts = 0;
      }
    }
  }

  return {
    sleepWakeGrid: anyOverlap ? grid.join("") : null,
    bedtimeStartIso,
    bedtimeEndIso,
    sleepMidpointMin,
    timeInBedMin,
    totalSleepMin,
    wasoMinutes,
    nightActivityBouts,
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
      hrvValues: [],
    };
    map.set(date, acc);
  }
  return acc;
}

/**
 * Maps a Health Connect / Apple Health webhook payload into chronological
 * `HealthConnectMappedDay[]` objects compatible with `RingDay` and `computeRhythmWindow`.
 */
export function mapHealthConnectPayloadToRingDays(
  payload: HealthConnectWebhookPayload
): HealthConnectMappedDay[] {
  const byDate = new Map<string, DayAccumulator>();

  for (const s of payload.sleep ?? []) {
    const endCtx = parseIsoWithWallContext(s.session_end_time);
    if (!endCtx) continue;
    getOrCreateDay(byDate, endCtx.localDate).sleep.push(s);
  }

  for (const st of payload.steps ?? []) {
    const ts = st.bucket_start ?? st.start_time ?? st.end_time ?? st.bucket_end;
    const val = st.total ?? st.count;
    if (!ts || typeof val !== "number" || !Number.isFinite(val) || val < 0) continue;
    const ctx = parseIsoWithWallContext(ts);
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    day.hourlySteps[ctx.localHour] += val;
    day.hourlyHasData[ctx.localHour] = true;
    day.rawStepTotal += val;
    day.hasRawSteps = true;
  }

  for (const cal of payload.active_calories ?? []) {
    const ts = cal.bucket_start ?? cal.start_time ?? cal.end_time ?? cal.bucket_end;
    const val = cal.energy_kcal ?? cal.kcal ?? cal.total;
    if (!ts || typeof val !== "number" || !Number.isFinite(val) || val < 0) continue;
    const ctx = parseIsoWithWallContext(ts);
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    day.rawCalorieTotal += val;
    day.hasRawCalories = true;
  }

  for (const hr of payload.heart_rate ?? []) {
    const ts = hr.time ?? hr.start_time;
    if (!ts) continue;
    const ctx = parseIsoWithWallContext(ts);
    if (!ctx) continue;
    const day = getOrCreateDay(byDate, ctx.localDate);
    const avg = hr.avg ?? hr.bpm;
    if (typeof avg === "number" && Number.isFinite(avg) && avg > 25 && avg < 230) {
      day.hrValues.push(avg);
    }
    const minVal = hr.min ?? hr.bpm;
    if (
      typeof minVal === "number" &&
      Number.isFinite(minVal) &&
      minVal > 25 &&
      minVal < 230
    ) {
      day.hrMins.push(minVal);
    }
  }

  for (const hrv of payload.heart_rate_variability ?? []) {
    const ts = hrv.time ?? hrv.start_time;
    if (!ts) continue;
    const ctx = parseIsoWithWallContext(ts);
    if (!ctx) continue;
    const val = hrv.rmssd_millis ?? hrv.rmssd ?? hrv.avg;
    if (typeof val === "number" && Number.isFinite(val) && val > 0 && val < 500) {
      getOrCreateDay(byDate, ctx.localDate).hrvValues.push(val);
    }
  }

  for (const tot of payload.daily_totals ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot.date)) continue;
    const day = getOrCreateDay(byDate, tot.date);
    if (typeof tot.steps === "number" && Number.isFinite(tot.steps) && tot.steps >= 0) {
      day.dailyTotalSteps = Math.round(tot.steps);
    }
    if (
      typeof tot.active_calories_kcal === "number" &&
      Number.isFinite(tot.active_calories_kcal) &&
      tot.active_calories_kcal >= 0
    ) {
      day.dailyTotalCalories = roundTo(tot.active_calories_kcal, 1);
    }
  }

  const isSimulated = Boolean(payload.isSimulated);
  const source: HealthConnectMappedDay["source"] = isSimulated
    ? "simulated_health_connect"
    : payload.source === "healthkit_ios"
      ? "healthkit_ios"
      : "health_connect";

  const sortedDates = [...byDate.keys()].sort();
  return sortedDates.map((date, idx) => {
    const day = byDate.get(date)!;
    const sleepInfo = buildSleepGridForDate(day.sleep, date);

    const hourlyActivity: (number | null)[] = new Array<number | null>(24).fill(null);
    let validHours = 0;
    for (let h = 0; h < 24; h++) {
      if (day.hourlyHasData[h]) {
        hourlyActivity[h] = roundTo(day.hourlySteps[h], 1);
        validHours += 1;
      }
    }

    const steps =
      day.dailyTotalSteps !== undefined
        ? day.dailyTotalSteps
        : day.hasRawSteps
          ? Math.round(day.rawStepTotal)
          : null;

    const activeCaloriesKcal =
      day.dailyTotalCalories !== undefined
        ? day.dailyTotalCalories
        : day.hasRawCalories
          ? roundTo(day.rawCalorieTotal, 1)
          : null;

    const avgHrBpm =
      day.hrValues.length > 0
        ? roundTo(day.hrValues.reduce((a, b) => a + b, 0) / day.hrValues.length, 1)
        : null;

    const lowestHrBpm =
      day.hrMins.length > 0 ? roundTo(Math.min(...day.hrMins), 1) : null;

    const avgHrvRmssdMs =
      day.hrvValues.length > 0
        ? roundTo(day.hrvValues.reduce((a, b) => a + b, 0) / day.hrvValues.length, 1)
        : null;

    const ringActive =
      sleepInfo.sleepWakeGrid !== null ||
      (steps !== null && steps > 0) ||
      avgHrBpm !== null ||
      validHours > 0;

    return {
      date,
      dayIndex: idx + 1,
      ringActive,
      wearMinutes: validHours > 0 ? validHours * 60 : ringActive ? 1200 : 0,
      steps,
      activeCaloriesKcal,
      hourlyActivity,
      bedtimeStartIso: sleepInfo.bedtimeStartIso,
      bedtimeEndIso: sleepInfo.bedtimeEndIso,
      sleepMidpointMin: sleepInfo.sleepMidpointMin,
      timeInBedMin: sleepInfo.timeInBedMin,
      totalSleepMin: sleepInfo.totalSleepMin,
      wasoMinutes: sleepInfo.wasoMinutes,
      nightActivityBouts: sleepInfo.nightActivityBouts,
      lowestHrBpm,
      avgHrBpm,
      avgHrvRmssdMs,
      sleepWakeGrid: sleepInfo.sleepWakeGrid,
      isSimulated,
      source,
    };
  });
}
