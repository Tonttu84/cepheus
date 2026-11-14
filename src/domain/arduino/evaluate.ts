import type {
  ArduinoCameraMetricsInput,
  ArduinoEdgePayloadInput,
  ArduinoImmobilityAndLightInput,
  ArduinoLightCueDirective,
  ArduinoResult,
  EvaluatedArduinoEdgeIngest,
  NormalizedArduinoCameraReading,
  NormalizedArduinoRoutineReading,
} from "./types";

const FORBIDDEN_MEDIA_KEYS = new Set([
  "frame",
  "frames",
  "image",
  "images",
  "imagebase64",
  "framebase64",
  "video",
  "videobase64",
  "audio",
  "audiobase64",
  "pcm",
  "wav",
  "mp4",
  "jpeg",
  "jpg",
  "png",
  "pixels",
  "rawbytes",
]);

function roundTo(val: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function isFiniteInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === "number" && Number.isFinite(val) && val >= min && val <= max;
}

/**
 * Recursively checks an unknown object graph for forbidden raw media keys
 * so frames, images, or audio can never pass into storage.
 */
export function containsRawMediaFields(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsRawMediaFields(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_MEDIA_KEYS.has(key.toLowerCase())) {
      return key;
    }
    const hit = containsRawMediaFields(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * Computes a gentle non-clinical desk light cue when a prolonged daytime
 * stationary bout coincides with dim ambient indoor light.
 */
export function computeLightCueDirective(
  hourOfDay: number | undefined,
  routine: ArduinoEdgePayloadInput["routine"]
): ArduinoLightCueDirective {
  if (!routine || !routine.sensorActive) {
    return {
      activateRingLightCue: false,
      reason: "Routine sensor inactive; no desk light cue needed.",
    };
  }

  const isDaytime = hourOfDay === undefined || (hourOfDay >= 7 && hourOfDay <= 18);
  const longBout = routine.longestBoutMinutes >= 90;
  const dimRoom =
    typeof routine.ambientLuxMean === "number" &&
    Number.isFinite(routine.ambientLuxMean) &&
    routine.ambientLuxMean < 80;

  if (isDaytime && longBout && dimRoom) {
    return {
      activateRingLightCue: true,
      reason:
        "Prolonged daytime stationary bout in dim room light; gentle warm-to-daylight ring cue offered.",
    };
  }

  return {
    activateRingLightCue: false,
    reason: "Within normal daytime light/movement range.",
  };
}

function normalizeCameraMetrics(
  c: ArduinoCameraMetricsInput,
  isSimulated: boolean,
  source: "arduino_uno_q" | "simulated_uno_q"
): ArduinoResult<NormalizedArduinoCameraReading> {
  if (!isFiniteInRange(c.durationSec, 1, 3600)) {
    return { ok: false, error: "camera.durationSec must be between 1 and 3600." };
  }
  if (!isFiniteInRange(c.effectiveFps, 0.5, 120)) {
    return { ok: false, error: "camera.effectiveFps must be between 0.5 and 120." };
  }
  if (!isFiniteInRange(c.faceDetectedRatio, 0, 1)) {
    return { ok: false, error: "camera.faceDetectedRatio must be between 0 and 1." };
  }
  if (!isFiniteInRange(c.expressivityScore, 0, 2)) {
    return { ok: false, error: "camera.expressivityScore must be between 0 and 2." };
  }
  if (!isFiniteInRange(c.angularPathDegPerMin, 0, 5000)) {
    return { ok: false, error: "camera.angularPathDegPerMin must be between 0 and 5000." };
  }

  const smileFraction = c.smileFraction ?? 0;
  const yawSdDeg = c.yawSdDeg ?? 0;
  const pitchSdDeg = c.pitchSdDeg ?? 0;
  if (
    !isFiniteInRange(smileFraction, 0, 1) ||
    !isFiniteInRange(yawSdDeg, 0, 180) ||
    !isFiniteInRange(pitchSdDeg, 0, 180)
  ) {
    return { ok: false, error: "camera kinematics fields are out of valid bounds." };
  }
  if (c.rollSdDeg !== undefined && !isFiniteInRange(c.rollSdDeg, 0, 180)) {
    return { ok: false, error: "camera.rollSdDeg must be between 0 and 180." };
  }

  return {
    ok: true,
    value: {
      taskId:
        typeof c.taskId === "string" && c.taskId.trim().length > 0
          ? c.taskId.trim().slice(0, 64)
          : "uno_q_edge_check",
      durationSec: roundTo(c.durationSec, 2),
      sampleRateHz: 10,
      effectiveFps: roundTo(c.effectiveFps, 2),
      faceDetectedRatio: roundTo(c.faceDetectedRatio, 3),
      expressivityScore: roundTo(c.expressivityScore, 4),
      smileFraction: roundTo(smileFraction, 3),
      yawSdDeg: roundTo(yawSdDeg, 2),
      pitchSdDeg: roundTo(pitchSdDeg, 2),
      rollSdDeg: c.rollSdDeg !== undefined ? roundTo(c.rollSdDeg, 2) : null,
      angularPathDegPerMin: roundTo(c.angularPathDegPerMin, 2),
      isSimulated,
      source,
    },
  };
}

function normalizeRoutineMetrics(
  r: ArduinoImmobilityAndLightInput,
  isSimulated: boolean,
  source: "arduino_uno_q" | "simulated_uno_q"
): ArduinoResult<NormalizedArduinoRoutineReading[]> {
  if (typeof r.sensorActive !== "boolean") {
    return { ok: false, error: "routine.sensorActive must be a boolean." };
  }
  if (!isFiniteInRange(r.stationaryMinutes, 0, 1440)) {
    return { ok: false, error: "routine.stationaryMinutes must be 0..1440." };
  }
  if (!isFiniteInRange(r.longestBoutMinutes, 0, 1440)) {
    return { ok: false, error: "routine.longestBoutMinutes must be 0..1440." };
  }
  if (!isFiniteInRange(r.prolongedBoutCount, 0, 100)) {
    return { ok: false, error: "routine.prolongedBoutCount must be 0..100." };
  }

  const out: NormalizedArduinoRoutineReading[] = [
    {
      channel: "home_immobility_bouts",
      broadArea: "daily_routine",
      derivedValue: roundTo(r.stationaryMinutes, 1),
      unit: "minutes_stationary_daytime",
      isSimulated,
      source,
    },
  ];

  if (r.ambientLuxMean !== null && r.ambientLuxMean !== undefined) {
    if (!isFiniteInRange(r.ambientLuxMean, 0, 150000)) {
      return { ok: false, error: "routine.ambientLuxMean must be 0..150000." };
    }
    out.push({
      channel: "daylight_exposure",
      broadArea: "daily_routine",
      derivedValue: roundTo(r.ambientLuxMean, 1),
      unit: "lux_mean",
      isSimulated,
      source,
    });
  }

  return { ok: true, value: out };
}

function validateEnvelopeHeader(rawPayload: unknown): ArduinoResult<ArduinoEdgePayloadInput> {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const input = rawPayload as ArduinoEdgePayloadInput;
  if (typeof input.deviceId !== "string" || input.deviceId.trim().length < 2) {
    return { ok: false, error: "deviceId must be a non-empty string." };
  }
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "date must be formatted as YYYY-MM-DD." };
  }
  if (
    input.hourOfDay !== undefined &&
    (!Number.isInteger(input.hourOfDay) || input.hourOfDay < 0 || input.hourOfDay > 23)
  ) {
    return { ok: false, error: "hourOfDay must be an integer between 0 and 23." };
  }
  if (!input.camera && !input.routine) {
    return {
      ok: false,
      error: "Payload must include at least one of camera or routine derived metrics.",
    };
  }
  return { ok: true, value: input };
}

/**
 * Pure domain validator & normalizer for Arduino UNO Q edge payloads.
 */
export function evaluateArduinoEdgePayload(
  rawPayload: unknown
): ArduinoResult<EvaluatedArduinoEdgeIngest> {
  const mediaField = containsRawMediaFields(rawPayload);
  if (mediaField) {
    return {
      ok: false,
      error: `Refused raw media field "${mediaField}": camera and audio must stay on the device; send derived numbers only.`,
    };
  }

  const headerRes = validateEnvelopeHeader(rawPayload);
  if (!headerRes.ok) return headerRes;

  const input = headerRes.value;
  const isSimulated = Boolean(input.isSimulated);
  const source = isSimulated ? "simulated_uno_q" : "arduino_uno_q";

  let cameraReading: NormalizedArduinoCameraReading | null = null;
  if (input.camera) {
    const camRes = normalizeCameraMetrics(input.camera, isSimulated, source);
    if (!camRes.ok) return camRes;
    cameraReading = camRes.value;
  }

  let routineReadings: NormalizedArduinoRoutineReading[] = [];
  if (input.routine) {
    const routRes = normalizeRoutineMetrics(input.routine, isSimulated, source);
    if (!routRes.ok) return routRes;
    routineReadings = routRes.value;
  }

  return {
    ok: true,
    value: {
      deviceId: input.deviceId.trim().slice(0, 64),
      date: input.date,
      timestampMs: input.timestampMs,
      nonce: input.nonce,
      cameraReading,
      routineReadings,
      lightCue: computeLightCueDirective(input.hourOfDay, input.routine),
    },
  };
}
