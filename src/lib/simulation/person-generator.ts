import { createSeededRng, type SeededRng } from "./prng";
import type {
  GenerateSimulationOptions,
  SimulatedCameraReadingRecord,
  SimulatedCheckInRoundRecord,
  SimulatedClinicFlagRecord,
  SimulatedConsentRecord,
  SimulatedParticipantRecord,
  SimulatedPatientSuggestionRecord,
  SimulatedPersonalBaselineRecord,
  SimulatedPersonDataset,
  SimulatedPhq9AssessmentRecord,
  SimulatedRhythmWindowRecord,
  SimulatedRingDayRecord,
  SimulatedRoutineReadingRecord,
} from "./types";

export const SIMULATED_PARTICIPANT_EXTERNAL_ID = "sim-post-tms-01";
export const DEFAULT_SIMULATION_SEED = 20261113;
export const DEFAULT_BASE_DATE = "2026-09-18"; // Day 1 -> Day 56 lands on 2026-11-12

const CHECK_IN_SCHEDULE_DAYS: readonly number[] = [
  3, 6, 10, 13, 17, 20, 24, 27, 31, 34, 38, 41, 45, 48, 52, 55,
];

function roundTo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function addDaysIso(baseDateStr: string, offsetDays: number): string {
  const [y, m, d] = baseDateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + offsetDays);
  return new Date(utc).toISOString().slice(0, 10);
}

function makeTimestamp(dateStr: string, hour: number, minute: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
}

function meanOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function sampleSd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = meanOf(values);
  let sq = 0;
  for (const v of values) {
    const diff = v - m;
    sq += diff * diff;
  }
  return Math.sqrt(sq / (values.length - 1));
}

function medianAndIqr(values: readonly number[]): { median: number; iqr: number } {
  if (values.length === 0) return { median: 0, iqr: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number): number => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };
  const q25 = quantile(0.25);
  const q50 = quantile(0.5);
  const q75 = quantile(0.75);
  return {
    median: roundTo(q50, 3),
    iqr: roundTo(q75 - q25, 3),
  };
}

/**
 * Build a 1440-character '0'/'1' sleep/wake grid for a 24h calendar day (minutes 0..1439).
 * '1' = asleep, '0' = awake.
 * Models overnight sleep spanning midnight (morning wake segment 0..wakeMin and evening bedtime segment)
 * plus realistic nocturnal WASO awakenings.
 */
function buildSleepWakeGrid(
  bedtimeStartMinFromMidnight: number, // e.g., -45 for 23:15, +35 for 00:35
  wakeMinFromMidnight: number, // e.g., 425 for 07:05
  wasoMinutes: number,
  nightBouts: number,
  rng: SeededRng
): string {
  const chars = new Array<string>(1440).fill("0");

  const markSleepInterval = (startMin: number, endMin: number) => {
    const s = Math.max(0, Math.min(1440, Math.round(startMin)));
    const e = Math.max(0, Math.min(1440, Math.round(endMin)));
    for (let i = s; i < e; i++) {
      chars[i] = "1";
    }
  };

  if (bedtimeStartMinFromMidnight < 0) {
    // Asleep from midnight to wake, and again in the late evening (1440 + bedtimeStart .. 1440)
    markSleepInterval(0, wakeMinFromMidnight);
    markSleepInterval(1440 + bedtimeStartMinFromMidnight, 1440);
  } else {
    // Late bedtime after midnight: asleep from bedtimeStartMinFromMidnight .. wakeMinFromMidnight
    markSleepInterval(bedtimeStartMinFromMidnight, wakeMinFromMidnight);
  }

  // Carve out WASO bouts inside the core early-morning sleep window
  const coreStart = Math.max(30, Math.round( Math.max(0, bedtimeStartMinFromMidnight) + 45 ));
  const coreEnd = Math.min(1380, Math.max(coreStart + 60, Math.round(wakeMinFromMidnight - 25)));
  const bouts = Math.max(1, nightBouts);
  const totalWaso = Math.max(0, Math.round(wasoMinutes));
  const span = Math.max(30, coreEnd - coreStart);

  let remainingWaso = totalWaso;
  for (let b = 0; b < bouts && remainingWaso > 0; b++) {
    const boutLen =
      b === bouts - 1
        ? remainingWaso
        : Math.max(2, Math.round(totalWaso / bouts + rng.range(-2, 2)));
    const actualLen = Math.min(remainingWaso, boutLen);
    const slotStart =
      coreStart + Math.floor(((b + 0.35) / bouts) * Math.max(10, span - actualLen));
    for (let m = slotStart; m < Math.min(coreEnd, slotStart + actualLen); m++) {
      if (m >= 0 && m < 1440) {
        chars[m] = "0";
      }
    }
    remainingWaso -= actualLen;
  }

  return chars.join("");
}

/**
 * Compute M10 (most active 10h mean), L5 (least active 5h mean), and Relative Amplitude (RA)
 * from a 24-hour activity array.
 */
function computeM10L5Ra(hourly: readonly number[]): {
  m10: number;
  l5: number;
  relativeAmplitude: number;
} {
  let max10 = -Infinity;
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let k = 0; k < 10; k++) {
      sum += hourly[(start + k) % 24];
    }
    const avg = sum / 10;
    if (avg > max10) max10 = avg;
  }

  let min5 = Infinity;
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let k = 0; k < 5; k++) {
      sum += hourly[(start + k) % 24];
    }
    const avg = sum / 5;
    if (avg < min5) min5 = avg;
  }

  const denom = max10 + min5;
  const ra = denom > 0 ? (max10 - min5) / denom : 0;
  return {
    m10: roundTo(max10, 2),
    l5: roundTo(min5, 2),
    relativeAmplitude: roundTo(ra, 3),
  };
}

/**
 * Compute non-parametric circadian metrics (IS, IV, M10, L5, RA) and Sleep Regularity Index (SRI)
 * over a window of consecutive RingDay records.
 */
function computeWindowMetrics(days: readonly SimulatedRingDayRecord[]): {
  m10: number;
  l5: number;
  relativeAmplitude: number;
  interdailyStability: number;
  intradailyVariability: number;
  sri: number;
  sleepMidpointSdMin: number;
  wasoMeanMin: number;
  stepsMean: number;
} {
  const hourlyMatrix = days.map((d) => JSON.parse(d.hourlyActivityJson) as number[]);
  const flatSeries: number[] = [];
  for (const row of hourlyMatrix) {
    for (const v of row) flatSeries.push(v);
  }

  // Mean 24h profile across the window
  const hourlyProfile = new Array<number>(24).fill(0);
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let d = 0; d < hourlyMatrix.length; d++) {
      sum += hourlyMatrix[d][h];
    }
    hourlyProfile[h] = sum / hourlyMatrix.length;
  }

  const { m10, l5, relativeAmplitude } = computeM10L5Ra(hourlyProfile);

  // Interdaily Stability (IS)
  const grandMean = meanOf(flatSeries);
  let numIs = 0;
  for (let h = 0; h < 24; h++) {
    const diff = hourlyProfile[h] - grandMean;
    numIs += diff * diff;
  }
  numIs *= flatSeries.length;

  let denIs = 0;
  for (const x of flatSeries) {
    const diff = x - grandMean;
    denIs += diff * diff;
  }
  const interdailyStability =
    denIs > 0 ? roundTo(Math.min(1, Math.max(0, numIs / (24 * denIs))), 3) : 0;

  // Intradaily Variability (IV)
  let numIv = 0;
  for (let i = 1; i < flatSeries.length; i++) {
    const diff = flatSeries[i] - flatSeries[i - 1];
    numIv += diff * diff;
  }
  numIv *= flatSeries.length;
  const denomIv = (flatSeries.length - 1) * denIs;
  const intradailyVariability = denomIv > 0 ? roundTo(numIv / denomIv, 3) : 0;

  // Sleep Regularity Index (SRI): percentage probability that sleep/wake state at minute m
  // matches state at minute m + 1440 across consecutive days, rescaled to [-100, 100].
  let matches = 0;
  let totalPairs = 0;
  for (let d = 0; d < days.length - 1; d++) {
    const g1 = days[d].sleepWakeGrid;
    const g2 = days[d + 1].sleepWakeGrid;
    const len = Math.min(g1.length, g2.length);
    for (let m = 0; m < len; m++) {
      if (g1[m] === g2[m]) matches++;
      totalPairs++;
    }
  }
  const matchProb = totalPairs > 0 ? matches / totalPairs : 0.9;
  const sri = roundTo(200 * matchProb - 100, 2);

  const sleepMidpointSdMin = roundTo(
    sampleSd(days.map((d) => d.sleepMidpointMin)),
    2
  );
  const wasoMeanMin = roundTo(meanOf(days.map((d) => d.wasoMinutes)), 2);
  const stepsMean = roundTo(meanOf(days.map((d) => d.steps)), 1);

  return {
    m10,
    l5,
    relativeAmplitude,
    interdailyStability,
    intradailyVariability,
    sri,
    sleepMidpointSdMin,
    wasoMeanMin,
    stepsMean,
  };
}

/**
 * Generate a deterministic 8-week (56-day) post-TMS participant dataset.
 * Covers all 3 demo moments:
 *   - Day 18 ("well" / personal baseline)
 *   - Day 29 ("small_dip" / 1-round dip + low-effort suggestion)
 *   - Day 56 ("sustained_drift" / multi-round decline + Week 8 check-in silence while ring remains active)
 */
export function generateSimulatedPersonWeeks(
  options: GenerateSimulationOptions = {}
): SimulatedPersonDataset {
  const seed = options.seed ?? DEFAULT_SIMULATION_SEED;
  const baseDate = options.baseDate ?? DEFAULT_BASE_DATE;
  const rng = createSeededRng(seed);

  const tmsCompletedDate = addDaysIso(baseDate, -1);

  const participant: SimulatedParticipantRecord = {
    externalId: SIMULATED_PARTICIPANT_EXTERNAL_ID,
    participantCode: "P-SIM-001",
    label: "Simulated post-TMS participant",
    source: "synthetic",
    isSimulated: true,
    seed,
    enrolmentDate: baseDate,
    scheduleDaysJson: JSON.stringify([1, 4]),
    scheduleTime: "18:00",
    timeZone: "Europe/Helsinki",
    takingPart: true,
    ruleCheckConsent: false,
    tmsCompletedDate,
    currentDemoDay: 56,
    group: "post_tms_maintenance",
    age: 34,
    gender: null,
    madrsBaseline: 28,
    madrsEnd: 7,
  };

  const consentTimestamp = makeTimestamp(baseDate, 9, 0);
  const consents: SimulatedConsentRecord[] = [
    {
      method: "check_in",
      broadArea: "check_in",
      recordedDescription:
        "Twice-weekly two-tap wellbeing check-in (mood and interest, 0–4). Missed answers are recorded as missed, never scored as zero.",
      enabled: true,
      isPersonalSign: true,
      consentedAt: consentTimestamp,
      revokedAt: null,
    },
    {
      method: "phq9",
      broadArea: "check_in",
      recordedDescription:
        "Fortnightly 9-item PHQ-9 check-in compared against your post-treatment anchor score.",
      enabled: true,
      isPersonalSign: false,
      consentedAt: consentTimestamp,
      revokedAt: null,
    },
    {
      method: "ring_rhythm",
      broadArea: "sleep",
      recordedDescription:
        "Daily smart-ring sleep timing, regularity, and daytime movement rhythm. Distinguishes quiet device wear from a dead battery.",
      enabled: true,
      isPersonalSign: true,
      consentedAt: consentTimestamp,
      revokedAt: null,
    },
    {
      method: "camera_expressivity",
      broadArea: "check_in",
      recordedDescription:
        "60-second on-device facial movement and head-pose summary during check-ins. Only derived numbers are stored; video never leaves your device.",
      enabled: true,
      isPersonalSign: false,
      consentedAt: consentTimestamp,
      revokedAt: null,
    },
    {
      method: "home_routine",
      broadArea: "daily_routine",
      recordedDescription:
        "Weekly coarse counts of laundry and bathroom humidity cycles. Never continuous room tracking.",
      enabled: true,
      isPersonalSign: true,
      consentedAt: consentTimestamp,
      revokedAt: null,
    },
    {
      method: "financial_routine",
      broadArea: "financial_routine",
      recordedDescription:
        "Optional coarse weekly count of routine bill-pay activity. Disabled by default.",
      enabled: false,
      isPersonalSign: false,
      consentedAt: null,
      revokedAt: null,
    },
  ];

  // -------------------------------------------------------------------------
  // 1. Generate 56 RingDay rows (Days 1..56)
  // -------------------------------------------------------------------------
  const ringDays: SimulatedRingDayRecord[] = [];

  for (let dayIndex = 1; dayIndex <= 56; dayIndex++) {
    const date = addDaysIso(baseDate, dayIndex - 1);

    let bedtimeStartMin: number; // relative to midnight
    let totalSleepMin: number;
    let wasoMinutes: number;
    let onsetLatencyMin: number;
    let nightBouts: number;
    let steps: number;
    let dayPeakScale: number;
    let nightNoiseScale: number;
    let lowestHr: number;
    let avgHr: number;
    let hrvRmssd: number;

    if (dayIndex <= 21) {
      // Phase 1: Well / Personal Baseline (Days 1-21)
      // Consistent sleep onset ~23:15 (-45 min), wake ~07:05 (+425 min), midpoint ~190 min (03:10 AM)
      bedtimeStartMin = roundTo(rng.normal(-45, 8), 1);
      wasoMinutes = roundTo(rng.clamp(rng.normal(20, 2.5), 16, 25), 1);
      onsetLatencyMin = roundTo(rng.clamp(rng.normal(12, 2.0), 8, 17), 1);
      totalSleepMin = roundTo(rng.clamp(rng.normal(442, 10), 420, 465), 1);
      nightBouts = rng.int(1, 2);
      steps = Math.round(rng.clamp(rng.normal(8450, 380), 7800, 9200));
      dayPeakScale = rng.clamp(rng.normal(1.0, 0.04), 0.92, 1.08);
      nightNoiseScale = rng.clamp(rng.normal(1.0, 0.06), 0.85, 1.15);
      lowestHr = roundTo(rng.normal(53.5, 1.1), 1);
      avgHr = roundTo(rng.normal(63.0, 1.4), 1);
      hrvRmssd = roundTo(rng.normal(48.0, 3.0), 1);
    } else if (dayIndex <= 35) {
      // Phase 2: Small Dip around Days 25-29, then recovery Days 30-35
      const inDipWindow = dayIndex >= 25 && dayIndex <= 29;
      if (inDipWindow) {
        bedtimeStartMin = roundTo(rng.normal(0, 12), 1); // ~00:00 midnight (45 min later)
        wasoMinutes = roundTo(rng.clamp(rng.normal(34, 3.5), 29, 41), 1);
        onsetLatencyMin = roundTo(rng.clamp(rng.normal(19, 3.0), 14, 26), 1);
        totalSleepMin = roundTo(rng.clamp(rng.normal(410, 12), 385, 430), 1);
        nightBouts = rng.int(2, 4);
        steps = Math.round(rng.clamp(rng.normal(5900, 220), 5550, 6250));
        dayPeakScale = rng.clamp(rng.normal(0.78, 0.04), 0.72, 0.84);
        nightNoiseScale = rng.clamp(rng.normal(1.48, 0.08), 1.35, 1.65);
        lowestHr = roundTo(rng.normal(56.2, 1.2), 1);
        avgHr = roundTo(rng.normal(66.0, 1.5), 1);
        hrvRmssd = roundTo(rng.normal(41.5, 2.8), 1);
      } else {
        bedtimeStartMin = roundTo(rng.normal(-40, 10), 1);
        wasoMinutes = roundTo(rng.clamp(rng.normal(22, 3.0), 17, 28), 1);
        onsetLatencyMin = roundTo(rng.clamp(rng.normal(13, 2.2), 9, 18), 1);
        totalSleepMin = roundTo(rng.clamp(rng.normal(436, 11), 415, 458), 1);
        nightBouts = rng.int(1, 2);
        steps = Math.round(rng.clamp(rng.normal(8100, 350), 7500, 8800));
        dayPeakScale = rng.clamp(rng.normal(0.96, 0.04), 0.89, 1.04);
        nightNoiseScale = rng.clamp(rng.normal(1.06, 0.06), 0.92, 1.18);
        lowestHr = roundTo(rng.normal(54.0, 1.1), 1);
        avgHr = roundTo(rng.normal(63.8, 1.4), 1);
        hrvRmssd = roundTo(rng.normal(46.5, 2.9), 1);
      }
    } else {
      // Phase 3: Sustained Drift + Silence (Days 36-56)
      // Progressive circadian drift and night-to-night irregularity starting Day 38
      const driftProgress = Math.min(1, Math.max(0, (dayIndex - 36) / 18));
      // Alternate early/late shifts plus drift so night-to-night midpoint SD is high and SRI drops to ~58-64
      const alternatingJitter = (dayIndex % 2 === 0 ? 1 : -1) * (28 + 18 * driftProgress);
      bedtimeStartMin = roundTo(
        35 + 65 * driftProgress + alternatingJitter + rng.normal(0, 14),
        1
      );
      wasoMinutes = roundTo(
        rng.clamp(48 + 16 * driftProgress + rng.normal(0, 4), 46, 68),
        1
      );
      onsetLatencyMin = roundTo(
        rng.clamp(24 + 10 * driftProgress + rng.normal(0, 3.5), 18, 42),
        1
      );
      totalSleepMin = roundTo(
        rng.clamp(385 - 25 * driftProgress + rng.normal(0, 15), 335, 415),
        1
      );
      nightBouts = rng.int(4, 6);
      steps = Math.round(
        rng.clamp(4550 - 750 * driftProgress + rng.normal(0, 240), 3600, 4750)
      );
      dayPeakScale = rng.clamp(0.64 - 0.1 * driftProgress + rng.normal(0, 0.03), 0.50, 0.70);
      nightNoiseScale = rng.clamp(2.15 + 0.45 * driftProgress + rng.normal(0, 0.12), 1.9, 2.8);
      lowestHr = roundTo(58.0 + 2.5 * driftProgress + rng.normal(0, 1.2), 1);
      avgHr = roundTo(68.5 + 2.5 * driftProgress + rng.normal(0, 1.5), 1);
      hrvRmssd = roundTo(36.0 - 4.5 * driftProgress + rng.normal(0, 2.4), 1);
    }

    const timeInBedMin = roundTo(totalSleepMin + wasoMinutes + onsetLatencyMin, 1);
    const wakeMinFromMidnight = roundTo(bedtimeStartMin + timeInBedMin, 1);
    const sleepMidpointMin = roundTo(bedtimeStartMin + timeInBedMin / 2, 1);

    // Construct 24 hourly activity values (0..23)
    // Template has quiet night (hours 0..5, 23) and active daytime (hours 8..20)
    const baseHourlyTemplate = [
      3.2, 2.8, 2.6, 2.9, 3.4, 5.2,
      18.0, 38.0, 54.0, 61.0, 58.0, 55.0,
      52.0, 56.0, 59.0, 57.0, 53.0, 50.0,
      44.0, 34.0, 23.0, 14.0, 7.5, 4.2,
    ];

    const hourlyActivity: number[] = baseHourlyTemplate.map((baseVal, hour) => {
      const isNightHour = hour <= 5 || hour === 23;
      if (isNightHour) {
        const val = baseVal * nightNoiseScale + rng.normal(0, 0.45);
        return roundTo(Math.max(0.8, val), 2);
      }
      const val = baseVal * dayPeakScale + rng.normal(0, 2.2);
      return roundTo(Math.max(4.0, val), 2);
    });

    const { m10, l5, relativeAmplitude } = computeM10L5Ra(hourlyActivity);
    const daytimeMeanActivity = roundTo(meanOf(hourlyActivity.slice(8, 20)), 2);
    const nighttimeMeanActivity = roundTo(
      meanOf([
        hourlyActivity[0],
        hourlyActivity[1],
        hourlyActivity[2],
        hourlyActivity[3],
        hourlyActivity[4],
        hourlyActivity[5],
        hourlyActivity[23],
      ]),
      2
    );

    const sleepWakeGrid = buildSleepWakeGrid(
      bedtimeStartMin,
      wakeMinFromMidnight,
      wasoMinutes,
      nightBouts,
      rng
    );

    // Bedtime start & end timestamps relative to calendar date midnight UTC
    const [y, m, d] = date.split("-").map(Number);
    const midnightMs = Date.UTC(y, m - 1, d, 0, 0, 0);
    const bedtimeStart = new Date(midnightMs + Math.round(bedtimeStartMin * 60_000));
    const bedtimeEnd = new Date(midnightMs + Math.round(wakeMinFromMidnight * 60_000));

    const wearMinutes = Math.round(rng.clamp(rng.normal(1412, 10), 1385, 1435));
    const activeCaloriesKcal = roundTo(steps * 0.042 + rng.normal(15, 4), 1);
    const tempDeviationC = roundTo(
      dayIndex > 36 ? rng.normal(0.14, 0.07) : rng.normal(0.02, 0.05),
      2
    );

    ringDays.push({
      date,
      dayIndex,
      ringActive: true, // Smart ring remains actively worn every single day 1..56 (crucial for Week 8 silence check)
      wearMinutes,
      steps,
      activeCaloriesKcal,
      daytimeMeanActivity,
      nighttimeMeanActivity,
      m10,
      l5,
      relativeAmplitude,
      hourlyActivityJson: JSON.stringify(hourlyActivity),
      bedtimeStart,
      bedtimeEnd,
      sleepMidpointMin,
      timeInBedMin,
      totalSleepMin,
      onsetLatencyMin,
      wasoMinutes,
      nightActivityBouts: nightBouts,
      lowestHrBpm: lowestHr,
      avgHrBpm: avgHr,
      avgHrvRmssdMs: hrvRmssd,
      tempDeviationC,
      sleepWakeGrid,
      sleepPhase5MinRaw: null,
      isSimulated: true,
      source: "synthetic",
    });
  }

  // -------------------------------------------------------------------------
  // 2. Generate 16 Twice-Weekly CheckInRound rows (two taps, 0..4 integers)
  // -------------------------------------------------------------------------
  const checkInRounds: SimulatedCheckInRoundRecord[] = [];
  const defaultItemOrder = JSON.stringify(["mood", "interest"]);

  CHECK_IN_SCHEDULE_DAYS.forEach((dayIndex, idx) => {
    const roundNumber = idx + 1;
    const weekNumber = Math.ceil(dayIndex / 7);
    const date = addDaysIso(baseDate, dayIndex - 1);
    const scheduledAt = makeTimestamp(date, 18, 0);

    // Rounds 15 & 16 (Days 52 & 55, Week 8): check-in silence while ring is active
    if (roundNumber >= 15) {
      const nextMorning = addDaysIso(baseDate, dayIndex);
      checkInRounds.push({
        scheduledAt,
        respondedAt: null,
        reminderSentAt: makeTimestamp(nextMorning, 9, 0),
        date,
        dayIndex,
        weekNumber,
        roundNumber,
        status: "missed",
        moodScore: null,
        interestScore: null,
        itemOrderJson: null,
        responseLatencyMs: null,
        ringActiveAtRound: true,
        isSimulated: true,
        source: "synthetic",
      });
      return;
    }

    let moodScore: number;
    let interestScore: number;

    if (roundNumber <= 6) {
      // Phase 1 (Days 3..20): Well baseline (3 or 4 on 0..4 scale)
      moodScore = rng.next() < 0.7 ? 4 : 3;
      interestScore = rng.next() < 0.7 ? 4 : 3;
    } else if (roundNumber === 7) {
      // Day 24: Normal before the small dip
      moodScore = 3;
      interestScore = 4;
    } else if (roundNumber === 8) {
      // Day 27: Single-round small dip (>= 2 below baseline mood)
      moodScore = 1;
      interestScore = 2;
    } else if (roundNumber === 9 || roundNumber === 10) {
      // Days 31 & 34: Recovery after the one-tap suggestion
      moodScore = roundNumber === 9 ? 3 : 4;
      interestScore = 3;
    } else if (roundNumber === 11) {
      // Day 38: Start of Phase 3 drift
      moodScore = 2;
      interestScore = 3;
    } else if (roundNumber === 12) {
      // Day 41: Sustained dip round 1
      moodScore = 1;
      interestScore = 2;
    } else if (roundNumber === 13) {
      // Day 45: Sustained dip round 2
      moodScore = 1;
      interestScore = 1;
    } else {
      // Round 14 (Day 48): Sustained dip round 3 before Week 8 silence
      moodScore = 0;
      interestScore = 1;
    }

    const responseMinutesAfter = rng.int(12, 65);
    const respondedAt = makeTimestamp(date, 18, responseMinutesAfter);
    const responseLatencyMs = rng.int(8_000, 22_000);

    checkInRounds.push({
      scheduledAt,
      respondedAt,
      reminderSentAt: null,
      date,
      dayIndex,
      weekNumber,
      roundNumber,
      status: "completed",
      moodScore,
      interestScore,
      itemOrderJson: defaultItemOrder,
      responseLatencyMs,
      ringActiveAtRound: true,
      isSimulated: true,
      source: "synthetic",
    });
  });

  // -------------------------------------------------------------------------
  // 3. Generate Fortnightly Phq9Assessment rows (Days 1, 14, 28, 42, 56)
  // -------------------------------------------------------------------------
  const phq9Assessments: SimulatedPhq9AssessmentRecord[] = [
    {
      // Week 0 anchor (Day 1): totalScore = 3
      scheduledAt: makeTimestamp(addDaysIso(baseDate, 0), 10, 0),
      completedAt: makeTimestamp(addDaysIso(baseDate, 0), 10, 14),
      date: addDaysIso(baseDate, 0),
      dayIndex: 1,
      weekNumber: 1,
      roundNumber: 1,
      completedInRoundNumber: 1,
      status: "completed",
      totalScore: 3,
      item1Interest: 0,
      item2Mood: 0,
      item3Sleep: 1,
      item4Energy: 1,
      item5Appetite: 0,
      item6SelfWorth: 0,
      item7Concentration: 1,
      item8Psychomotor: 0,
      item9SelfHarm: 0,
      baselineDelta: 0,
      isSimulated: true,
      source: "synthetic",
    },
    {
      // Week 2 (Day 14): totalScore = 3
      scheduledAt: makeTimestamp(addDaysIso(baseDate, 13), 18, 0),
      completedAt: makeTimestamp(addDaysIso(baseDate, 13), 18, 19),
      date: addDaysIso(baseDate, 13),
      dayIndex: 14,
      weekNumber: 2,
      roundNumber: 4,
      completedInRoundNumber: 4,
      status: "completed",
      totalScore: 3,
      item1Interest: 0,
      item2Mood: 0,
      item3Sleep: 1,
      item4Energy: 1,
      item5Appetite: 1,
      item6SelfWorth: 0,
      item7Concentration: 0,
      item8Psychomotor: 0,
      item9SelfHarm: 0,
      baselineDelta: 0,
      isSimulated: true,
      source: "synthetic",
    },
    {
      // Week 4 (Day 28): totalScore = 5 (+2 above baseline, below 6-point reliable change threshold)
      scheduledAt: makeTimestamp(addDaysIso(baseDate, 27), 18, 0),
      completedAt: makeTimestamp(addDaysIso(baseDate, 27), 18, 26),
      date: addDaysIso(baseDate, 27),
      dayIndex: 28,
      weekNumber: 4,
      roundNumber: 8,
      completedInRoundNumber: 8,
      status: "completed",
      totalScore: 5,
      item1Interest: 1,
      item2Mood: 1,
      item3Sleep: 1,
      item4Energy: 1,
      item5Appetite: 0,
      item6SelfWorth: 0,
      item7Concentration: 1,
      item8Psychomotor: 0,
      item9SelfHarm: 0,
      baselineDelta: 2,
      isSimulated: true,
      source: "synthetic",
    },
    {
      // Week 6 (Day 42): totalScore = 10 (+7 above baseline -> exceeds >=6 reliable change threshold)
      scheduledAt: makeTimestamp(addDaysIso(baseDate, 41), 18, 0),
      completedAt: makeTimestamp(addDaysIso(baseDate, 41), 19, 8),
      date: addDaysIso(baseDate, 41),
      dayIndex: 42,
      weekNumber: 6,
      roundNumber: 12,
      completedInRoundNumber: 12,
      status: "completed",
      totalScore: 10,
      item1Interest: 2,
      item2Mood: 2,
      item3Sleep: 2,
      item4Energy: 2,
      item5Appetite: 1,
      item6SelfWorth: 0,
      item7Concentration: 1,
      item8Psychomotor: 0,
      item9SelfHarm: 0,
      baselineDelta: 7,
      isSimulated: true,
      source: "synthetic",
    },
    {
      // Week 8 (Day 56): missed during silence window (never scored as 0!)
      scheduledAt: makeTimestamp(addDaysIso(baseDate, 55), 18, 0),
      completedAt: null,
      date: addDaysIso(baseDate, 55),
      dayIndex: 56,
      weekNumber: 8,
      roundNumber: 16,
      completedInRoundNumber: null,
      status: "missed",
      totalScore: null,
      item1Interest: null,
      item2Mood: null,
      item3Sleep: null,
      item4Energy: null,
      item5Appetite: null,
      item6SelfWorth: null,
      item7Concentration: null,
      item8Psychomotor: null,
      item9SelfHarm: null,
      baselineDelta: null,
      isSimulated: true,
      source: "synthetic",
    },
  ];

  // -------------------------------------------------------------------------
  // 4. Compute Rolling 7-day RhythmWindows (Days 7..56)
  // -------------------------------------------------------------------------
  const rawWindows: Array<{
    dayIndex: number;
    windowEndDate: string;
    m10: number;
    l5: number;
    relativeAmplitude: number;
    interdailyStability: number;
    intradailyVariability: number;
    sri: number;
    sleepMidpointSdMin: number;
    wasoMeanMin: number;
    stepsMean: number;
  }> = [];

  for (let dayIndex = 7; dayIndex <= 56; dayIndex++) {
    const slice = ringDays.slice(dayIndex - 7, dayIndex);
    const metrics = computeWindowMetrics(slice);
    rawWindows.push({
      dayIndex,
      windowEndDate: ringDays[dayIndex - 1].date,
      ...metrics,
    });
  }

  // Baseline window stats from Days 7..21 (initial well weeks)
  const baselineWindows = rawWindows.filter((w) => w.dayIndex <= 21);
  const raBaseMean = meanOf(baselineWindows.map((w) => w.relativeAmplitude));
  const raBaseSd = Math.max(0.015, sampleSd(baselineWindows.map((w) => w.relativeAmplitude)));
  const isBaseMean = meanOf(baselineWindows.map((w) => w.interdailyStability));
  const isBaseSd = Math.max(0.02, sampleSd(baselineWindows.map((w) => w.interdailyStability)));
  const sriBaseMean = meanOf(baselineWindows.map((w) => w.sri));
  const sriBaseSd = Math.max(2.0, sampleSd(baselineWindows.map((w) => w.sri)));

  const rhythmWindows: SimulatedRhythmWindowRecord[] = rawWindows.map((w) => ({
    windowEndDate: w.windowEndDate,
    dayIndex: w.dayIndex,
    windowDays: 7,
    validDays: 7,
    m10: w.m10,
    l5: w.l5,
    relativeAmplitude: w.relativeAmplitude,
    interdailyStability: w.interdailyStability,
    intradailyVariability: w.intradailyVariability,
    sri: w.sri,
    sleepMidpointSdMin: w.sleepMidpointSdMin,
    wasoMeanMin: w.wasoMeanMin,
    stepsMean: w.stepsMean,
    raZScore: roundTo((w.relativeAmplitude - raBaseMean) / raBaseSd, 2),
    isZScore: roundTo((w.interdailyStability - isBaseMean) / isBaseSd, 2),
    sriZScore: roundTo((w.sri - sriBaseMean) / sriBaseSd, 2),
    isSimulated: true,
  }));

  // -------------------------------------------------------------------------
  // 5. Generate CameraReading rows on completed check-in days (Days 3..48)
  // -------------------------------------------------------------------------
  const completedRounds = checkInRounds.filter((r) => r.status === "completed");
  const rawCameraReadings: Array<Omit<
    SimulatedCameraReadingRecord,
    "expressivityZScore" | "headMovementZScore"
  >> = [];

  for (const round of completedRounds) {
    const dayIndex = round.dayIndex;
    let expressivityScore: number;
    let smileFraction: number;
    let yawSdDeg: number;
    let pitchSdDeg: number;
    let angularPathDegPerMin: number;

    if (dayIndex <= 21) {
      // Phase 1 baseline: lively facial movement & head kinematics
      expressivityScore = roundTo(rng.clamp(rng.normal(0.122, 0.008), 0.11, 0.136), 4);
      smileFraction = roundTo(rng.clamp(rng.normal(0.25, 0.025), 0.20, 0.30), 3);
      yawSdDeg = roundTo(rng.clamp(rng.normal(4.5, 0.3), 3.9, 5.1), 2);
      pitchSdDeg = roundTo(rng.clamp(rng.normal(3.1, 0.22), 2.7, 3.6), 2);
      angularPathDegPerMin = roundTo(rng.clamp(rng.normal(95, 5.5), 86, 105), 1);
    } else if (dayIndex === 27) {
      // Small dip on Day 27
      expressivityScore = roundTo(rng.clamp(rng.normal(0.096, 0.006), 0.088, 0.105), 4);
      smileFraction = roundTo(rng.clamp(rng.normal(0.16, 0.02), 0.13, 0.19), 3);
      yawSdDeg = roundTo(rng.clamp(rng.normal(3.8, 0.25), 3.4, 4.2), 2);
      pitchSdDeg = roundTo(rng.clamp(rng.normal(2.6, 0.2), 2.3, 2.9), 2);
      angularPathDegPerMin = roundTo(rng.clamp(rng.normal(76, 4.5), 69, 83), 1);
    } else if (dayIndex <= 35) {
      // Recovery in Phase 2
      expressivityScore = roundTo(rng.clamp(rng.normal(0.118, 0.007), 0.106, 0.13), 4);
      smileFraction = roundTo(rng.clamp(rng.normal(0.23, 0.025), 0.19, 0.28), 3);
      yawSdDeg = roundTo(rng.clamp(rng.normal(4.3, 0.28), 3.8, 4.8), 2);
      pitchSdDeg = roundTo(rng.clamp(rng.normal(3.0, 0.22), 2.6, 3.4), 2);
      angularPathDegPerMin = roundTo(rng.clamp(rng.normal(91, 5.0), 83, 99), 1);
    } else if (dayIndex === 38) {
      // Early Phase 3 transition
      expressivityScore = 0.088;
      smileFraction = 0.14;
      yawSdDeg = 3.4;
      pitchSdDeg = 2.4;
      angularPathDegPerMin = 70.0;
    } else {
      // Sustained drift (Days 41, 45, 48): psychomotor flattening
      expressivityScore = roundTo(rng.clamp(rng.normal(0.065, 0.004), 0.058, 0.072), 4);
      smileFraction = roundTo(rng.clamp(rng.normal(0.09, 0.012), 0.07, 0.11), 3);
      yawSdDeg = roundTo(rng.clamp(rng.normal(2.6, 0.2), 2.3, 2.9), 2);
      pitchSdDeg = roundTo(rng.clamp(rng.normal(1.9, 0.15), 1.6, 2.2), 2);
      angularPathDegPerMin = roundTo(rng.clamp(rng.normal(54, 3.2), 49, 59), 1);
    }

    const mouthSmileMean = roundTo(smileFraction * 0.62, 4);
    const mouthSmileSd = roundTo(expressivityScore * 1.15, 4);
    const browInnerUpSd = roundTo(expressivityScore * 0.88, 4);
    const browDownSd = roundTo(expressivityScore * 0.76, 4);
    const browOuterUpSd = roundTo(expressivityScore * 0.82, 4);
    const eyeSquintSd = roundTo(expressivityScore * 0.94, 4);
    const cheekSquintSd = roundTo(expressivityScore * 0.91, 4);
    const jawOpenSd = roundTo(expressivityScore * 1.05, 4);

    rawCameraReadings.push({
      recordedAt: round.respondedAt ?? round.scheduledAt,
      date: round.date,
      dayIndex,
      taskId: "check_in_clip_60s",
      durationSec: 60,
      sampleRateHz: 10,
      effectiveFps: roundTo(rng.clamp(rng.normal(29.5, 0.3), 28.8, 30.0), 1),
      faceDetectedRatio: roundTo(rng.clamp(rng.normal(0.98, 0.01), 0.95, 1.0), 3),
      expressivityScore,
      smileFraction,
      mouthSmileMean,
      mouthSmileSd,
      browInnerUpSd,
      browDownSd,
      browOuterUpSd,
      eyeSquintSd,
      cheekSquintSd,
      jawOpenSd,
      blendshapeStatsJson: JSON.stringify({
        mouthSmileMean,
        mouthSmileSd,
        browInnerUpSd,
        browDownSd,
        browOuterUpSd,
        eyeSquintSd,
        cheekSquintSd,
        jawOpenSd,
      }),
      yawSdDeg,
      pitchSdDeg,
      rollSdDeg: roundTo(pitchSdDeg * 0.65, 2),
      angularPathDegPerMin,
      translationSd: roundTo(expressivityScore * 0.42, 4),
      isSimulated: true,
      source: "synthetic",
    });
  }

  const baseCamera = rawCameraReadings.filter((c) => c.dayIndex <= 21);
  const exprBaseMean = meanOf(baseCamera.map((c) => c.expressivityScore));
  const exprBaseSd = Math.max(0.015, sampleSd(baseCamera.map((c) => c.expressivityScore)));
  const headBaseMean = meanOf(baseCamera.map((c) => c.angularPathDegPerMin));
  const headBaseSd = Math.max(12.0, sampleSd(baseCamera.map((c) => c.angularPathDegPerMin)));

  const cameraReadings: SimulatedCameraReadingRecord[] = rawCameraReadings.map((c) => ({
    ...c,
    expressivityZScore: roundTo((c.expressivityScore - exprBaseMean) / exprBaseSd, 2),
    headMovementZScore: roundTo((c.angularPathDegPerMin - headBaseMean) / headBaseSd, 2),
  }));

  // -------------------------------------------------------------------------
  // 6. Generate Weekly RoutineSignalReading rows (Weeks 1..8)
  // -------------------------------------------------------------------------
  const routineReadings: SimulatedRoutineReadingRecord[] = [];
  const laundryPerWeek = [3, 3, 3, 2, 3, 2, 1, 1];
  const showerPerWeek = [7, 7, 6, 6, 7, 5, 4, 3];

  for (let week = 1; week <= 8; week++) {
    const endDayIndex = week * 7;
    const startDayIndex = endDayIndex - 6;
    const periodStartDate = addDaysIso(baseDate, startDayIndex - 1);
    const periodEndDate = addDaysIso(baseDate, endDayIndex - 1);

    const laundryVal = laundryPerWeek[week - 1];
    const showerVal = showerPerWeek[week - 1];

    routineReadings.push(
      {
        periodStartDate,
        periodEndDate,
        dayIndex: endDayIndex,
        channel: "laundry",
        broadArea: "daily_routine",
        derivedValue: laundryVal,
        unit: "cycles_per_week",
        baselineZScore: roundTo((laundryVal - 3.0) / 0.6, 2),
        isSimulated: true,
        source: "synthetic",
      },
      {
        periodStartDate,
        periodEndDate,
        dayIndex: endDayIndex,
        channel: "shower_humidity",
        broadArea: "daily_routine",
        derivedValue: showerVal,
        unit: "events_per_week",
        baselineZScore: roundTo((showerVal - 6.67) / 0.75, 2),
        isSimulated: true,
        source: "synthetic",
      }
    );
  }

  // -------------------------------------------------------------------------
  // 7. Compute PersonalBaseline rows anchored on Days 1..21
  // -------------------------------------------------------------------------
  const windowStartDate = addDaysIso(baseDate, 0);
  const windowEndDate = addDaysIso(baseDate, 20);

  const baselineMoodValues = checkInRounds
    .filter((r) => r.dayIndex <= 21 && r.moodScore !== null)
    .map((r) => r.moodScore as number);
  const baselineInterestValues = checkInRounds
    .filter((r) => r.dayIndex <= 21 && r.interestScore !== null)
    .map((r) => r.interestScore as number);
  const baselineSriValues = rhythmWindows
    .filter((w) => w.dayIndex <= 21)
    .map((w) => w.sri);
  const baselineRaValues = ringDays
    .filter((d) => d.dayIndex <= 21)
    .map((d) => d.relativeAmplitude);
  const baselineStepsValues = ringDays
    .filter((d) => d.dayIndex <= 21)
    .map((d) => d.steps);
  const baselineExprValues = cameraReadings
    .filter((c) => c.dayIndex <= 21)
    .map((c) => c.expressivityScore);
  const baselineHeadValues = cameraReadings
    .filter((c) => c.dayIndex <= 21)
    .map((c) => c.angularPathDegPerMin);

  const buildBaselineRow = (
    metricName: string,
    values: readonly number[]
  ): SimulatedPersonalBaselineRecord => {
    const { median, iqr } = medianAndIqr(values);
    return {
      metricName,
      windowStartDate,
      windowEndDate,
      sampleCount: values.length,
      mean: roundTo(meanOf(values), 4),
      sd: roundTo(Math.max(1e-4, sampleSd(values)), 4),
      median,
      iqr,
    };
  };

  const personalBaselines: SimulatedPersonalBaselineRecord[] = [
    buildBaselineRow("check_in_mood", baselineMoodValues),
    buildBaselineRow("check_in_interest", baselineInterestValues),
    buildBaselineRow("sleep_sri", baselineSriValues),
    buildBaselineRow("ring_ra", baselineRaValues),
    buildBaselineRow("ring_steps", baselineStepsValues),
    buildBaselineRow("camera_expressivity", baselineExprValues),
    buildBaselineRow("camera_head_movement", baselineHeadValues),
  ];

  // -------------------------------------------------------------------------
  // 8. Generate One-Tap PatientSuggestion on Day 28 (Phase 2 small dip)
  // -------------------------------------------------------------------------
  const day28Date = addDaysIso(baseDate, 27);
  const patientSuggestions: SimulatedPatientSuggestionRecord[] = [
    {
      createdAt: makeTimestamp(day28Date, 9, 15),
      date: day28Date,
      dayIndex: 28,
      reason: "small_dip",
      actionKey: "short_walk",
      actionTitle: "Take a 10-minute walk outside",
      actionDetail:
        "No targets or pace — step outside for fresh air and come back whenever ready.",
      effortTier: "low",
      status: "completed",
      respondedAt: makeTimestamp(day28Date, 14, 30),
      armType: "intervention",
      nextCheckInDelta: 0.9,
      isSimulated: true,
    },
  ];

  // -------------------------------------------------------------------------
  // 9. Generate ClinicFlag in Phase 3 (Day 45 sustained dip + Week 8 silence)
  // -------------------------------------------------------------------------
  const day41Date = addDaysIso(baseDate, 40); // Start of sustained drift
  const day45Date = addDaysIso(baseDate, 44);
  const clinicFlags: SimulatedClinicFlagRecord[] = [
    {
      createdAt: makeTimestamp(day45Date, 19, 0),
      sinceDate: day41Date,
      dayIndex: 45,
      triggerKind: "sustained_dip",
      ruleVersion: 1,
      primaryArea: "check_in",
      broadAreasJson: JSON.stringify(["check_in", "sleep", "daily_routine"]),
      status: "open",
      ringActiveDuringSilence: true,
      patientSharedDetails: false,
      sharedAt: null,
      isSimulated: true,
    },
  ];

  const fullDataset: SimulatedPersonDataset = {
    participant,
    consents,
    ringDays,
    checkInRounds,
    phq9Assessments,
    rhythmWindows,
    cameraReadings,
    routineReadings,
    personalBaselines,
    patientSuggestions,
    clinicFlags,
  };

  if (options.throughDay !== undefined) {
    return sliceDatasetThroughDay(fullDataset, options.throughDay);
  }

  return fullDataset;
}

/**
 * Slice a full 56-day simulated dataset through a given demo day (e.g. Day 18, Day 29, or Day 56).
 * When sliced at Day 29 ("small_dip"), keeps the Day 28 suggestion in `status: "shown"` so the
 * patient view displays the active one-tap state-shifter card.
 */
export function sliceDatasetThroughDay(
  dataset: SimulatedPersonDataset,
  throughDay: number
): SimulatedPersonDataset {
  const clampedDay = Math.max(1, Math.min(56, Math.floor(throughDay)));

  const patientSuggestions = dataset.patientSuggestions
    .filter((s) => s.dayIndex <= clampedDay)
    .map((s) => {
      if (clampedDay <= 29 && s.dayIndex === 28) {
        return {
          ...s,
          status: "shown" as const,
          respondedAt: null,
          nextCheckInDelta: null,
        };
      }
      return { ...s };
    });

  return {
    participant: {
      ...dataset.participant,
      currentDemoDay: clampedDay,
    },
    consents: dataset.consents.map((c) => ({ ...c })),
    ringDays: dataset.ringDays
      .filter((d) => d.dayIndex <= clampedDay)
      .map((d) => ({ ...d })),
    checkInRounds: dataset.checkInRounds
      .filter((r) => r.dayIndex <= clampedDay)
      .map((r) => ({ ...r })),
    phq9Assessments: dataset.phq9Assessments
      .filter((p) => p.dayIndex <= clampedDay)
      .map((p) => ({ ...p })),
    rhythmWindows: dataset.rhythmWindows
      .filter((w) => w.dayIndex <= clampedDay)
      .map((w) => ({ ...w })),
    cameraReadings: dataset.cameraReadings
      .filter((c) => c.dayIndex <= clampedDay)
      .map((c) => ({ ...c })),
    routineReadings: dataset.routineReadings
      .filter((r) => r.dayIndex <= clampedDay)
      .map((r) => ({ ...r })),
    personalBaselines: dataset.personalBaselines.map((b) => ({ ...b })),
    patientSuggestions,
    clinicFlags: dataset.clinicFlags
      .filter((f) => f.dayIndex <= clampedDay)
      .map((f) => ({ ...f })),
  };
}
