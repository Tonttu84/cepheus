/**
 * Pure domain types for Arduino UNO Q edge hub derived metrics.
 * Enforces privacy-by-architecture: only derived numeric summaries are accepted;
 * raw video, images, or audio are strictly refused.
 * Zero imports outside src/domain/.
 */

export type ArduinoResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface ArduinoCameraMetricsInput {
  readonly taskId?: string;
  readonly durationSec: number;
  readonly effectiveFps: number;
  readonly faceDetectedRatio: number;
  readonly expressivityScore: number;
  readonly smileFraction?: number;
  readonly yawSdDeg?: number;
  readonly pitchSdDeg?: number;
  readonly rollSdDeg?: number;
  readonly angularPathDegPerMin: number;
}

export interface ArduinoImmobilityAndLightInput {
  /** Total stationary/in-bed or seated-in-one-spot minutes recorded during daytime window (0..1440). */
  readonly stationaryMinutes: number;
  /** Longest continuous motionless bout in minutes (0..1440). */
  readonly longestBoutMinutes: number;
  /** Number of prolonged motionless bouts >= 60 min during daytime. */
  readonly prolongedBoutCount: number;
  /** Mean room ambient light in lux (optional; >= 0). */
  readonly ambientLuxMean?: number | null;
  /** Hours spent in low ambient light (< 50 lux) during daytime (0..16). */
  readonly lowLightDaytimeHours?: number | null;
  /** Whether the local optical/presence sensor was actively monitoring. */
  readonly sensorActive: boolean;
}

export interface ArduinoEdgePayloadInput {
  readonly deviceId: string;
  readonly date: string; // "YYYY-MM-DD"
  readonly hourOfDay?: number; // 0..23
  readonly isSimulated?: boolean;
  readonly camera?: ArduinoCameraMetricsInput | null;
  readonly routine?: ArduinoImmobilityAndLightInput | null;
}

export interface NormalizedArduinoCameraReading {
  readonly taskId: string;
  readonly durationSec: number;
  readonly sampleRateHz: number;
  readonly effectiveFps: number;
  readonly faceDetectedRatio: number;
  readonly expressivityScore: number;
  readonly smileFraction: number;
  readonly yawSdDeg: number;
  readonly pitchSdDeg: number;
  readonly rollSdDeg: number | null;
  readonly angularPathDegPerMin: number;
  readonly isSimulated: boolean;
  readonly source: "arduino_uno_q" | "simulated_uno_q";
}

export interface NormalizedArduinoRoutineReading {
  readonly channel: "home_immobility_bouts" | "daylight_exposure";
  readonly broadArea: "daily_routine";
  readonly derivedValue: number;
  readonly unit: string;
  readonly isSimulated: boolean;
  readonly source: "arduino_uno_q" | "simulated_uno_q";
}

export interface ArduinoLightCueDirective {
  readonly activateRingLightCue: boolean;
  readonly reason: string;
}

export interface EvaluatedArduinoEdgeIngest {
  readonly deviceId: string;
  readonly date: string;
  readonly cameraReading: NormalizedArduinoCameraReading | null;
  readonly routineReadings: readonly NormalizedArduinoRoutineReading[];
  readonly lightCue: ArduinoLightCueDirective;
}
