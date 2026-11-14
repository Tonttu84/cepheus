import {
  DEFAULT_CAMERA_SESSION_CONFIG,
  type CameraFrameInput,
  type CameraQualityMetrics,
  type CameraSessionConfig,
  type CameraSessionInput,
  type CameraSessionOutput,
  type Result,
} from "./types";
import { validateSessionInput } from "./validation";

export const EXCLUDED_BLENDSHAPES = new Set([
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "_neutral",
]);

function isExcludedBlendshape(name: string): boolean {
  return (
    EXCLUDED_BLENDSHAPES.has(name) ||
    name.startsWith("eyeLook") ||
    name.startsWith("eyeBlink")
  );
}

/**
 * Collects non-excluded blendshape names present in a single frame.
 */
function collectFrameShapeNames(
  blendshapes: Record<string, number>,
  target: Set<string>
): void {
  for (const name of Object.keys(blendshapes)) {
    if (!isExcludedBlendshape(name)) {
      target.add(name);
    }
  }
}

/**
 * Calculates population standard deviation of numbers.
 */
function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;

  let allIdentical = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[0]) {
      allIdentical = false;
      break;
    }
  }
  if (allIdentical) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return variance > 1e-14 ? Math.sqrt(variance) : 0;
}

/**
 * Calculates expressivity as the mean over evaluated blendshapes of each score's SD.
 * Blendshapes for gaze and blinks are excluded.
 */
function calculateExpressivity(faceFrames: CameraFrameInput[]): number {
  if (faceFrames.length === 0) return 0;

  // Collect all evaluated blendshape names across frames
  const shapeNames = new Set<string>();
  for (const f of faceFrames) {
    if (f.blendshapes) {
      collectFrameShapeNames(f.blendshapes, shapeNames);
    }
  }

  if (shapeNames.size === 0) return 0;

  let sdSum = 0;
  for (const name of shapeNames) {
    const scores = faceFrames.map((f) => f.blendshapes?.[name] ?? 0);
    sdSum += standardDeviation(scores);
  }

  return sdSum / shapeNames.size;
}

/**
 * Calculates mean frame-to-frame change of head angles in degrees per second.
 */
function calculateHeadMovement(faceFrames: CameraFrameInput[]): number {
  if (faceFrames.length < 2) return 0;

  let totalSpeed = 0;
  let transitionCount = 0;

  for (let i = 1; i < faceFrames.length; i++) {
    const prev = faceFrames[i - 1];
    const curr = faceFrames[i];
    const dtSec = (curr.timestampMs - prev.timestampMs) / 1000;

    if (dtSec > 0 && prev.headPose && curr.headPose) {
      const dp = curr.headPose.pitch - prev.headPose.pitch;
      const dy = curr.headPose.yaw - prev.headPose.yaw;
      const dr = curr.headPose.roll - prev.headPose.roll;
      const angularDistance = Math.sqrt(dp * dp + dy * dy + dr * dr);

      totalSpeed += angularDistance / dtSec;
      transitionCount++;
    }
  }

  return transitionCount > 0 ? totalSpeed / transitionCount : 0;
}

/**
 * Computes derived numbers or quality refusal from a camera session.
 */
export function calculateCameraSession(
  session: CameraSessionInput,
  config: CameraSessionConfig = DEFAULT_CAMERA_SESSION_CONFIG
): Result<CameraSessionOutput> {
  const validation = validateSessionInput(session);
  if (!validation.ok) {
    return validation;
  }

  const faceFrames = session.frames.filter(
    (f) => f.blendshapes != null && f.headPose != null
  );

  const analysedFrames = Math.max(
    session.totalFrames ?? 0,
    session.frames.length
  );
  const faceShare = analysedFrames > 0 ? faceFrames.length / analysedFrames : 0;

  let sessionDurationMs = session.sessionDurationMs ?? 0;
  if (session.sessionDurationMs === undefined && session.frames.length >= 2) {
    const firstTs = session.frames[0].timestampMs;
    const lastTs = session.frames[session.frames.length - 1].timestampMs;
    sessionDurationMs = lastTs - firstTs;
  }

  const quality: CameraQualityMetrics = {
    analysedFrames,
    faceShare,
    sessionDurationMs,
  };

  if (analysedFrames < config.minFrames) {
    return {
      ok: true,
      value: { hasNumbers: false, reason: "too_few_frames", quality },
    };
  }

  if (sessionDurationMs < config.minDurationMs) {
    return {
      ok: true,
      value: { hasNumbers: false, reason: "session_too_short", quality },
    };
  }

  if (faceShare < config.minFaceShare || faceFrames.length === 0) {
    return {
      ok: true,
      value: { hasNumbers: false, reason: "face_share_too_low", quality },
    };
  }

  const expressivity = calculateExpressivity(faceFrames);
  const headMovement = calculateHeadMovement(faceFrames);

  return {
    ok: true,
    value: {
      hasNumbers: true,
      expressivity,
      headMovement,
      quality,
    },
  };
}
