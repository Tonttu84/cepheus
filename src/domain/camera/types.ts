/**
 * Pure domain types for camera session processing.
 * No dependencies outside src/domain/camera/.
 */

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface HeadPoseAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface CameraFrameInput {
  timestampMs: number;
  blendshapes?: Record<string, number> | null;
  headPose?: HeadPoseAngles | null;
}

export interface CameraSessionInput {
  frames: CameraFrameInput[];
  totalFrames?: number;
  sessionDurationMs?: number;
}

export interface CameraSessionConfig {
  minDurationMs: number;
  minFrames: number;
  minFaceShare: number;
}

export const DEFAULT_CAMERA_SESSION_CONFIG: CameraSessionConfig = {
  minDurationMs: 15_000,
  minFrames: 100,
  minFaceShare: 0.6,
};

export interface CameraQualityMetrics {
  analysedFrames: number;
  faceShare: number;
  sessionDurationMs: number;
}

export type NoNumbersReason =
  | "too_few_frames"
  | "session_too_short"
  | "face_share_too_low";

export type CameraSessionOutput =
  | {
      hasNumbers: true;
      expressivity: number;
      headMovement: number;
      quality: CameraQualityMetrics;
    }
  | {
      hasNumbers: false;
      reason: NoNumbersReason;
      quality: CameraQualityMetrics;
    };
