import { poseAnglesFromMatrix } from "./matrix";
import type { CameraFrameInput, HeadPoseAngles } from "./types";

export interface FaceLandmarkerDetectionResult {
  faceLandmarks?: unknown[] | null;
  faceBlendshapes?: Array<{
    categories?: Array<{ categoryName: string; score: number }>;
  }> | null;
  facialTransformationMatrixes?: Array<number[] | { data: number[] }> | null;
}

export interface FrameData {
  blendshapes: Record<string, number> | null;
  headPose: HeadPoseAngles | null;
}

/**
 * Reads blendshapes and head pose from a face detector result.
 * Returns null for blendshapes and head pose if no face is detected
 * or if head pose extraction fails.
 */
export function readFrameData(
  detection: FaceLandmarkerDetectionResult | null | undefined
): FrameData {
  const hasFace = Boolean(
    detection?.faceLandmarks && detection.faceLandmarks.length > 0
  );

  if (!hasFace) {
    return {
      blendshapes: null,
      headPose: null,
    };
  }

  const blendshapes: Record<string, number> = {};
  if (detection?.faceBlendshapes?.[0]?.categories) {
    for (const c of detection.faceBlendshapes[0].categories) {
      blendshapes[c.categoryName] = c.score;
    }
  }

  const rawMatrix = detection?.facialTransformationMatrixes?.[0];
  const poseRes = rawMatrix ? poseAnglesFromMatrix(rawMatrix) : null;
  const headPose = poseRes?.ok ? poseRes.value : null;

  return {
    blendshapes: headPose ? blendshapes : null,
    headPose: headPose ?? null,
  };
}

/**
 * Builds a CameraFrameInput from a detector result and timestamp.
 */
export function extractCameraFrame(
  detection: FaceLandmarkerDetectionResult | null | undefined,
  timestampMs: number
): CameraFrameInput {
  const { blendshapes, headPose } = readFrameData(detection);
  return {
    timestampMs,
    blendshapes,
    headPose,
  };
}
