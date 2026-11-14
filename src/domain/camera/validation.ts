import type { CameraFrameInput, CameraSessionInput, Result } from "./types";

/**
 * Validates a single frame's blendshapes and head pose.
 */
function validateFrameContent(frame: CameraFrameInput, index: number): Result<true> {
  if (frame.headPose) {
    const { pitch, yaw, roll } = frame.headPose;
    if (
      !Number.isFinite(pitch) ||
      !Number.isFinite(yaw) ||
      !Number.isFinite(roll)
    ) {
      return {
        ok: false,
        error: `Frame ${index} contains non-finite head pose angle`,
      };
    }
  }

  if (frame.blendshapes) {
    for (const [name, score] of Object.entries(frame.blendshapes)) {
      if (typeof score !== "number" || !Number.isFinite(score)) {
        return {
          ok: false,
          error: `Frame ${index} blendshape "${name}" is not a finite number`,
        };
      }
      if (score < 0 || score > 1) {
        return {
          ok: false,
          error: `Frame ${index} blendshape "${name}" score ${score} is outside [0, 1]`,
        };
      }
    }
  }

  return { ok: true, value: true };
}

/**
 * Validates that an entire camera session input has valid types and monotonic timestamps.
 */
export function validateSessionInput(session: CameraSessionInput): Result<true> {
  if (!session || !Array.isArray(session.frames)) {
    return { ok: false, error: "Session input must have a frames array" };
  }

  if (
    session.totalFrames !== undefined &&
    (!Number.isFinite(session.totalFrames) || session.totalFrames < 0)
  ) {
    return { ok: false, error: "totalFrames must be a non-negative finite number" };
  }

  if (
    session.sessionDurationMs !== undefined &&
    (!Number.isFinite(session.sessionDurationMs) || session.sessionDurationMs < 0)
  ) {
    return { ok: false, error: "sessionDurationMs must be a non-negative finite number" };
  }

  let lastTimestamp = -Infinity;

  for (let i = 0; i < session.frames.length; i++) {
    const frame = session.frames[i];
    if (!frame || typeof frame.timestampMs !== "number" || !Number.isFinite(frame.timestampMs)) {
      return { ok: false, error: `Frame ${i} timestamp must be a finite number` };
    }

    if (frame.timestampMs <= lastTimestamp) {
      return {
        ok: false,
        error:
          frame.timestampMs === lastTimestamp
            ? `Frame ${i} timestamp (${frame.timestampMs}) is identical to previous (${lastTimestamp}); timestamps must strictly increase`
            : `Frame ${i} timestamp (${frame.timestampMs}) goes backwards from previous (${lastTimestamp})`,
      };
    }
    lastTimestamp = frame.timestampMs;

    const contentCheck = validateFrameContent(frame, i);
    if (!contentCheck.ok) {
      return contentCheck;
    }
  }

  return { ok: true, value: true };
}
