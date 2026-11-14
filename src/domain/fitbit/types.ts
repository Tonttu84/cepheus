/**
 * Pure domain types for mapping Fitbit Web API payloads into Cepheus
 * RingDay & RhythmWindow inputs.
 * Zero imports outside src/domain/.
 */

export type FitbitSleepLevel =
  | "wake"
  | "light"
  | "deep"
  | "rem"
  | "awake"
  | "restless"
  | "asleep";

export interface FitbitSleepLevelSegment {
  readonly dateTime: string;
  readonly level: FitbitSleepLevel | string;
  readonly seconds: number;
}

export interface FitbitSleepLog {
  readonly dateOfSleep: string; // "YYYY-MM-DD"
  readonly startTime: string;   // ISO local timestamp, e.g. "2026-11-12T23:15:00.000"
  readonly endTime: string;     // ISO local timestamp, e.g. "2026-11-13T07:05:00.000"
  readonly duration?: number;   // ms
  readonly isMainSleep?: boolean;
  readonly minutesAsleep?: number;
  readonly minutesAwake?: number;
  readonly timeInBed?: number;
  readonly levels?: {
    readonly data?: readonly FitbitSleepLevelSegment[];
    readonly shortData?: readonly FitbitSleepLevelSegment[];
  };
}

export interface FitbitIntradayPoint {
  readonly time: string;  // "HH:MM:SS"
  readonly value: number; // steps
}

export interface FitbitDailyActivitySummary {
  readonly date: string; // "YYYY-MM-DD"
  readonly steps?: number | null;
  readonly caloriesOut?: number | null;
  readonly activityCalories?: number | null;
  readonly intradaySteps?: readonly FitbitIntradayPoint[] | null;
}

export interface FitbitHeartDaySummary {
  readonly date: string; // "YYYY-MM-DD"
  readonly restingHeartRate?: number | null;
}

export interface FitbitDayRawBundle {
  readonly date: string;
  readonly dayIndex: number;
  readonly sleepLogs: readonly FitbitSleepLog[];
  readonly activity?: FitbitDailyActivitySummary | null;
  readonly heart?: FitbitHeartDaySummary | null;
}

export interface FitbitMappedDay {
  readonly date: string;
  readonly dayIndex: number;
  readonly ringActive: boolean;
  readonly wearMinutes: number;
  readonly steps: number | null;
  readonly activeCaloriesKcal: number | null;
  readonly hourlyActivity: readonly (number | null)[];
  readonly intradayAvailable: boolean;
  readonly bedtimeStartIso: string | null;
  readonly bedtimeEndIso: string | null;
  readonly sleepMidpointMin: number | null;
  readonly timeInBedMin: number | null;
  readonly totalSleepMin: number | null;
  readonly wasoMinutes: number | null;
  readonly nightActivityBouts: number | null;
  readonly lowestHrBpm: number | null;
  readonly avgHrBpm: number | null;
  readonly sleepWakeGrid: string | null;
  readonly isSimulated: false;
  readonly source: "fitbit";
}
