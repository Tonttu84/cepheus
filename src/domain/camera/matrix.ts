import type { HeadPoseAngles, Result } from "./types";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Extracts pitch, yaw, and roll in degrees from a MediaPipe 4x4 column-major matrix.
 */
export function poseAnglesFromMatrix(
  matrixInput: number[] | { data: number[] }
): Result<HeadPoseAngles> {
  const data = Array.isArray(matrixInput) ? matrixInput : matrixInput?.data;

  if (!data || data.length !== 16) {
    return {
      ok: false,
      error: `Transformation matrix must have exactly 16 elements, got ${data?.length ?? 0}`,
    };
  }

  for (let i = 0; i < 16; i++) {
    if (typeof data[i] !== "number" || !Number.isFinite(data[i])) {
      return {
        ok: false,
        error: `Matrix contains non-finite number at index ${i}`,
      };
    }
  }

  // MediaPipe column-major 4x4 matrix elements:
  // Col 0: r00=data[0], r10=data[1], r20=data[2]
  // Col 1: r01=data[4], r11=data[5], r21=data[6]
  // Col 2: r02=data[8], r12=data[9], r22=data[10]
  const r10 = data[1];
  const r11 = data[5];
  const r02 = data[8];
  const r12 = data[9];
  const r22 = data[10];

  // Clamp r12 to [-1, 1] to avoid NaN from numerical float inaccuracies in asin
  const clampedR12 = Math.max(-1, Math.min(1, r12));
  const pitchRad = Math.asin(-clampedR12);
  const yawRad = Math.atan2(r02, r22);
  const rollRad = Math.atan2(r10, r11);

  const pitchDeg = pitchRad * RAD_TO_DEG;
  const yawDeg = yawRad * RAD_TO_DEG;
  const rollDeg = rollRad * RAD_TO_DEG;

  return {
    ok: true,
    value: {
      pitch: Object.is(pitchDeg, -0) ? 0 : pitchDeg,
      yaw: Object.is(yawDeg, -0) ? 0 : yawDeg,
      roll: Object.is(rollDeg, -0) ? 0 : rollDeg,
    },
  };
}
