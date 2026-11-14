import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  calculateCameraSession,
  extractCameraFrame,
  type CameraFrameInput,
  type CameraSessionConfig,
  type CameraSessionOutput,
  type Result,
} from "@/domain/camera";

export interface ProcessFrameParams {
  video: HTMLVideoElement | null;
  landmarker: FaceLandmarker;
  now: number;
  startTime: number;
  durationMs: number;
  lastDetectTimestamp: number;
  recordedFrames: CameraFrameInput[];
}

export interface ProcessFrameResult {
  done: boolean;
  elapsedMs: number;
  progressPercent: number;
  remainingSec: number;
  newLastDetectTimestamp: number;
}

/**
 * Processes a single frame tick: evaluates elapsed time, progress, and detects face landmarks on video frames.
 */
export function processSingleFrame({
  video,
  landmarker,
  now,
  startTime,
  durationMs,
  lastDetectTimestamp,
  recordedFrames,
}: ProcessFrameParams): ProcessFrameResult {
  const elapsedMs = now - startTime;
  if (elapsedMs >= durationMs) {
    return {
      done: true,
      elapsedMs,
      progressPercent: 100,
      remainingSec: 0,
      newLastDetectTimestamp: lastDetectTimestamp,
    };
  }

  const progressPercent = Math.min(
    100,
    Math.round((elapsedMs / durationMs) * 100)
  );
  const remainingSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
  let newLastDetectTimestamp = lastDetectTimestamp;

  if (video && video.readyState >= 2 && now > lastDetectTimestamp) {
    newLastDetectTimestamp = now;
    try {
      const detection = landmarker.detectForVideo(video, now);
      recordedFrames.push(extractCameraFrame(detection, elapsedMs));
    } catch {
      // Continue if a single frame dropped
    }
  }

  return {
    done: false,
    elapsedMs,
    progressPercent,
    remainingSec,
    newLastDetectTimestamp,
  };
}

/**
 * Evaluates session configuration limits relative to target duration and calculates movement summary numbers.
 */
export function evaluateSessionResult(
  frames: CameraFrameInput[],
  totalDurationMs: number,
  config: CameraSessionConfig,
  durationMs: number
): Result<CameraSessionOutput> {
  const effectiveConfig: CameraSessionConfig = {
    ...config,
    minDurationMs: Math.min(config.minDurationMs, durationMs * 0.75),
    minFrames: Math.min(
      config.minFrames,
      Math.floor((durationMs / 1000) * 5)
    ),
  };

  return calculateCameraSession(
    {
      frames,
      sessionDurationMs: totalDurationMs,
    },
    effectiveConfig
  );
}
