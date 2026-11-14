/**
 * Pure domain types for mapping Android Health Connect / Apple Health webhook payloads
 * (Life Dashboard Companion & Health Connect to Webhook) into Cepheus RingDay inputs.
 * Zero imports outside src/domain/.
 */

export interface HealthConnectRecordMetadata {
  readonly id?: string;
  readonly data_origin?: string;
  readonly zone_offset_seconds?: number;
  readonly start_zone_offset_seconds?: number;
  readonly end_zone_offset_seconds?: number;
}

export interface HealthConnectSleepStage {
  readonly stage: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_seconds?: number;
}

export interface HealthConnectSleepRecord {
  readonly session_end_time: string;
  readonly duration_seconds: number;
  readonly start_time?: string;
  readonly stages?: readonly HealthConnectSleepStage[];
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectStepRecord {
  readonly count?: number;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly bucket_start?: string;
  readonly bucket_end?: string;
  readonly total?: number;
  readonly start_zone_offset?: string;
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectCalorieRecord {
  readonly calories?: number;
  readonly energy_kcal?: number;
  readonly kcal?: number;
  readonly total?: number;
  readonly start_time?: string;
  readonly end_time?: string;
  readonly bucket_start?: string;
  readonly bucket_end?: string;
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectHeartRateRecord {
  readonly bpm?: number;
  readonly time?: string;
  readonly start_time?: string;
  readonly avg?: number;
  readonly min?: number;
  readonly max?: number;
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectRestingHrRecord {
  readonly bpm?: number;
  readonly time?: string;
  readonly start_time?: string;
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectHrvRecord {
  readonly rmssd_millis?: number;
  readonly heart_rate_variability_millis?: number;
  readonly rmssd?: number;
  readonly avg?: number;
  readonly time?: string;
  readonly start_time?: string;
  readonly metadata?: HealthConnectRecordMetadata;
}

export interface HealthConnectDailyTotal {
  readonly date: string; // "YYYY-MM-DD"
  readonly steps?: number;
  readonly active_calories_kcal?: number;
  readonly active_calories?: number;
}

export interface HealthConnectWebhookPayload {
  readonly test?: boolean;
  readonly source?: string;
  readonly timezone?: string;
  readonly sequence?: number;
  readonly isSimulated?: boolean;
  readonly sleep?: readonly HealthConnectSleepRecord[];
  readonly steps?: readonly HealthConnectStepRecord[];
  readonly active_calories?: readonly HealthConnectCalorieRecord[];
  readonly heart_rate?: readonly HealthConnectHeartRateRecord[];
  readonly resting_heart_rate?: readonly HealthConnectRestingHrRecord[];
  readonly heart_rate_variability?: readonly HealthConnectHrvRecord[];
  readonly daily_totals?: readonly HealthConnectDailyTotal[];
}

export interface HealthConnectMappedDay {
  readonly date: string;
  readonly dayIndex: number;
  readonly ringActive: boolean;
  readonly wearMinutes: number;
  readonly steps: number | null;
  readonly activeCaloriesKcal: number | null;
  readonly hourlyActivity: readonly (number | null)[];
  readonly bedtimeStartIso: string | null;
  readonly bedtimeEndIso: string | null;
  readonly sleepMidpointMin: number | null;
  readonly timeInBedMin: number | null;
  readonly totalSleepMin: number | null;
  readonly wasoMinutes: number | null;
  readonly nightActivityBouts: number | null;
  readonly lowestHrBpm: number | null;
  readonly avgHrBpm: number | null;
  readonly avgHrvRmssdMs: number | null;
  readonly sleepWakeGrid: string | null;
  readonly isSimulated: boolean;
  readonly source: "health_connect" | "healthkit_ios" | "simulated_health_connect";
}
