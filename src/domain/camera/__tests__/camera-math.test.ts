import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_SESSION_CONFIG,
  calculateCameraSession,
  poseAnglesFromMatrix,
  type CameraSessionConfig,
  type CameraSessionInput,
} from "../index";

describe("poseAnglesFromMatrix", () => {
  it("extracts zero angles from an identity matrix", () => {
    // Identity matrix in column-major 4x4 representation:
    // [ 1, 0, 0, 0,
    //   0, 1, 0, 0,
    //   0, 0, 1, 0,
    //   0, 0, 0, 1 ]
    // Pitch = asin(-0) = 0 deg
    // Yaw = atan2(0, 1) = 0 deg
    // Roll = atan2(0, 1) = 0 deg
    const identityMatrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];

    const result = poseAnglesFromMatrix(identityMatrix);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.pitch).toBeCloseTo(0, 5);
    expect(result.value.yaw).toBeCloseTo(0, 5);
    expect(result.value.roll).toBeCloseTo(0, 5);
  });

  it("extracts exact angles from known 3D rotations", () => {
    // Rotation around Y axis (Yaw) by +30 degrees:
    // cos(30 deg) = sqrt(3)/2 ~= 0.8660254038
    // sin(30 deg) = 0.5
    // In column-major format:
    // Col 0: [cos(30), 0, -sin(30), 0]
    // Col 1: [0,       1,  0,       0]
    // Col 2: [sin(30), 0,  cos(30), 0]
    // Col 3: [0,       0,  0,       1]
    const c30 = Math.cos((30 * Math.PI) / 180);
    const s30 = Math.sin((30 * Math.PI) / 180);
    const yaw30Matrix = [
      c30, 0, -s30, 0,
      0,   1, 0,    0,
      s30, 0, c30,  0,
      0,   0, 0,    1,
    ];

    const yawResult = poseAnglesFromMatrix(yaw30Matrix);
    expect(yawResult.ok).toBe(true);
    if (!yawResult.ok) return;

    expect(yawResult.value.pitch).toBeCloseTo(0, 4);
    expect(yawResult.value.yaw).toBeCloseTo(30, 4);
    expect(yawResult.value.roll).toBeCloseTo(0, 4);

    // Rotation around X axis (Pitch) by +45 degrees:
    // cos(45 deg) = sin(45 deg) = sqrt(2)/2 ~= 0.70710678
    // Col 0: [1,  0,       0,       0]
    // Col 1: [0,  cos(45), sin(45), 0]
    // Col 2: [0, -sin(45), cos(45), 0]
    // Col 3: [0,  0,       0,       1]
    const c45 = Math.cos((45 * Math.PI) / 180);
    const s45 = Math.sin((45 * Math.PI) / 180);
    const pitch45Matrix = [
      1, 0,    0,    0,
      0, c45,  s45,  0,
      0, -s45, c45,  0,
      0, 0,    0,    1,
    ];

    const pitchResult = poseAnglesFromMatrix(pitch45Matrix);
    expect(pitchResult.ok).toBe(true);
    if (!pitchResult.ok) return;

    expect(pitchResult.value.pitch).toBeCloseTo(45, 4);
    expect(pitchResult.value.yaw).toBeCloseTo(0, 4);
    expect(pitchResult.value.roll).toBeCloseTo(0, 4);
  });

  it("refuses invalid matrices with non-finite values or wrong length", () => {
    expect(poseAnglesFromMatrix([1, 2, 3]).ok).toBe(false);
    expect(
      poseAnglesFromMatrix([
        1, 0, 0, 0,
        0, NaN, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]).ok
    ).toBe(false);
  });
});

describe("calculateCameraSession - pure hand-calculated sessions", () => {
  it("exposes default camera session configuration with expected thresholds", () => {
    expect(DEFAULT_CAMERA_SESSION_CONFIG.minDurationMs).toBe(15_000);
    expect(DEFAULT_CAMERA_SESSION_CONFIG.minFrames).toBe(100);
    expect(DEFAULT_CAMERA_SESSION_CONFIG.minFaceShare).toBe(0.6);
  });

  const smallTestConfig: CameraSessionConfig = {
    minDurationMs: 1000,
    minFrames: 3,
    minFaceShare: 0.5,
  };

  it("evaluates a completely still face: expressivity 0 and head movement 0", () => {
    // Hand calculation:
    // 3 frames at t = 0, 1000, 2000 ms.
    // mouthSmileLeft = 0.2 constant, browInnerUp = 0.1 constant.
    // Standard deviation for each blendshape = 0.
    // Mean SD = (0 + 0) / 2 = 0.
    // Head angles at (0, 0, 0) constant.
    // Frame-to-frame change = 0 deg/s for each transition.
    // Mean head movement = 0 deg/s.
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: 0.2, browInnerUp: 0.1 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 1000,
          blendshapes: { mouthSmileLeft: 0.2, browInnerUp: 0.1 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 2000,
          blendshapes: { mouthSmileLeft: 0.2, browInnerUp: 0.1 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input, smallTestConfig);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.hasNumbers).toBe(true);
    if (!res.value.hasNumbers) return;

    expect(res.value.expressivity).toBe(0);
    expect(res.value.headMovement).toBe(0);
    expect(res.value.quality.analysedFrames).toBe(3);
    expect(res.value.quality.faceShare).toBe(1);
    expect(res.value.quality.sessionDurationMs).toBe(2000);
  });

  it("evaluates one blendshape alternating between two values", () => {
    // Hand calculation:
    // 4 frames at t = 0, 1000, 2000, 3000 ms.
    // mouthSmileLeft alternates: [0.2, 0.8, 0.2, 0.8]
    // Mean = (0.2 + 0.8 + 0.2 + 0.8) / 4 = 0.5.
    // Deviations from mean: [-0.3, +0.3, -0.3, +0.3]
    // Squared deviations: [0.09, 0.09, 0.09, 0.09]
    // Population variance = 0.09
    // Population SD = sqrt(0.09) = 0.3
    // Single blendshape evaluated -> mean expressivity = 0.3.
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 1000,
          blendshapes: { mouthSmileLeft: 0.8 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 2000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 3000,
          blendshapes: { mouthSmileLeft: 0.8 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input, smallTestConfig);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.hasNumbers).toBe(true);
    if (!res.value.hasNumbers) return;

    expect(res.value.expressivity).toBeCloseTo(0.3, 5);
  });

  it("evaluates a head turning at a constant rate", () => {
    // Hand calculation:
    // 4 frames at t = 0, 1000, 2000, 3000 ms (delta t = 1.0 s).
    // Yaw turns by 10 degrees every 1.0 s: [0, 10, 20, 30].
    // Pitch and roll are constant 0.
    // Transition 1: delta yaw = 10 deg, delta t = 1.0 s -> rate = 10.0 deg/s
    // Transition 2: delta yaw = 10 deg, delta t = 1.0 s -> rate = 10.0 deg/s
    // Transition 3: delta yaw = 10 deg, delta t = 1.0 s -> rate = 10.0 deg/s
    // Mean frame-to-frame change = (10 + 10 + 10) / 3 = 10.0 deg/s.
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 1000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 10, roll: 0 },
        },
        {
          timestampMs: 2000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 20, roll: 0 },
        },
        {
          timestampMs: 3000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 30, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input, smallTestConfig);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.hasNumbers).toBe(true);
    if (!res.value.hasNumbers) return;

    expect(res.value.headMovement).toBeCloseTo(10.0, 4);
    expect(res.value.expressivity).toBe(0);
  });

  it("excludes gaze and blink blendshapes so that expressivity is 0 when only gaze/blinks change", () => {
    // Hand calculation:
    // 3 frames at t = 0, 1000, 2000 ms.
    // eyeBlinkLeft and eyeLookUpRight change intensely across frames.
    // mouthSmileLeft is constant at 0.1 (SD = 0).
    // eyeBlinkLeft and eyeLookUpRight must be excluded from expressivity.
    // The only remaining blendshape is mouthSmileLeft (SD = 0).
    // Expressivity = 0.
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: {
            eyeBlinkLeft: 0.0,
            eyeLookUpRight: 0.8,
            mouthSmileLeft: 0.1,
          },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 1000,
          blendshapes: {
            eyeBlinkLeft: 0.9,
            eyeLookUpRight: 0.1,
            mouthSmileLeft: 0.1,
          },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 2000,
          blendshapes: {
            eyeBlinkLeft: 0.2,
            eyeLookUpRight: 0.7,
            mouthSmileLeft: 0.1,
          },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input, smallTestConfig);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.hasNumbers).toBe(true);
    if (!res.value.hasNumbers) return;

    expect(res.value.expressivity).toBe(0);
  });
});

describe("calculateCameraSession - input validation and refusals", () => {
  it("refuses timestamps that go backwards", () => {
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 1000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 500, // goes backwards
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/timestamp/i);
    }
  });

  it("refuses frames with repeated timestamps", () => {
    const input: CameraSessionInput = {
      frames: [
        {
          timestampMs: 1000,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
        {
          timestampMs: 1000, // identical timestamp
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };

    const res = calculateCameraSession(input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/timestamp/i);
    }
  });

  it("refuses blendshape scores outside 0 to 1", () => {
    const inputTooHigh: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: 1.05 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };
    const resHigh = calculateCameraSession(inputTooHigh);
    expect(resHigh.ok).toBe(false);

    const inputNegative: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: -0.01 },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };
    const resNeg = calculateCameraSession(inputNegative);
    expect(resNeg.ok).toBe(false);
  });

  it("refuses non-finite numbers anywhere in frames or pose", () => {
    const nanInput: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: NaN },
          headPose: { pitch: 0, yaw: 0, roll: 0 },
        },
      ],
    };
    expect(calculateCameraSession(nanInput).ok).toBe(false);

    const infPose: CameraSessionInput = {
      frames: [
        {
          timestampMs: 0,
          blendshapes: { mouthSmileLeft: 0.2 },
          headPose: { pitch: Infinity, yaw: 0, roll: 0 },
        },
      ],
    };
    expect(calculateCameraSession(infPose).ok).toBe(false);
  });
});

describe("calculateCameraSession - quality checks, reasons, and limits at their edges", () => {
  const config: CameraSessionConfig = {
    minDurationMs: 15_000,
    minFrames: 10,
    minFaceShare: 0.6,
  };

  it("reports 'too_few_frames' below threshold and accepts at threshold edge", () => {
    // 9 frames (< 10 minFrames)
    const nineFrames: CameraSessionInput = {
      sessionDurationMs: 20_000,
      frames: Array.from({ length: 9 }, (_, i) => ({
        timestampMs: i * 2000,
        blendshapes: { mouthSmileLeft: 0.2 },
        headPose: { pitch: 0, yaw: 0, roll: 0 },
      })),
    };
    const res9 = calculateCameraSession(nineFrames, config);
    expect(res9.ok).toBe(true);
    if (!res9.ok) return;
    expect(res9.value.hasNumbers).toBe(false);
    if (res9.value.hasNumbers) return;
    expect(res9.value.reason).toBe("too_few_frames");

    // Exactly 10 frames (>= 10 minFrames) at duration 18000 ms (>= 15000 ms)
    const tenFrames: CameraSessionInput = {
      frames: Array.from({ length: 10 }, (_, i) => ({
        timestampMs: i * 2000,
        blendshapes: { mouthSmileLeft: 0.2 },
        headPose: { pitch: 0, yaw: 0, roll: 0 },
      })),
    };
    const res10 = calculateCameraSession(tenFrames, config);
    expect(res10.ok).toBe(true);
    if (!res10.ok) return;
    expect(res10.value.hasNumbers).toBe(true);
  });

  it("reports 'session_too_short' below threshold and accepts at threshold edge", () => {
    // 10 frames, but duration is 14999 ms (< 15000 ms minDurationMs)
    const shortSession: CameraSessionInput = {
      frames: Array.from({ length: 10 }, (_, i) => ({
        timestampMs: (i * 14_999) / 9,
        blendshapes: { mouthSmileLeft: 0.2 },
        headPose: { pitch: 0, yaw: 0, roll: 0 },
      })),
    };
    const resShort = calculateCameraSession(shortSession, config);
    expect(resShort.ok).toBe(true);
    if (!resShort.ok) return;
    expect(resShort.value.hasNumbers).toBe(false);
    if (resShort.value.hasNumbers) return;
    expect(resShort.value.reason).toBe("session_too_short");

    // Exactly 15000 ms at edge
    const edgeSession: CameraSessionInput = {
      frames: Array.from({ length: 10 }, (_, i) => ({
        timestampMs: (i * 15_000) / 9,
        blendshapes: { mouthSmileLeft: 0.2 },
        headPose: { pitch: 0, yaw: 0, roll: 0 },
      })),
    };
    const resEdge = calculateCameraSession(edgeSession, config);
    expect(resEdge.ok).toBe(true);
    if (!resEdge.ok) return;
    expect(resEdge.value.hasNumbers).toBe(true);
  });

  it("reports 'face_share_too_low' below threshold and accepts at threshold edge", () => {
    // 10 total frames across 20000 ms, but only 5 have a detected face (5 / 10 = 0.5 < 0.6)
    const lowFaceShare: CameraSessionInput = {
      frames: Array.from({ length: 10 }, (_, i) => ({
        timestampMs: i * 2000,
        blendshapes: i < 5 ? { mouthSmileLeft: 0.2 } : null,
        headPose: i < 5 ? { pitch: 0, yaw: 0, roll: 0 } : null,
      })),
    };
    const resLow = calculateCameraSession(lowFaceShare, config);
    expect(resLow.ok).toBe(true);
    if (!resLow.ok) return;
    expect(resLow.value.hasNumbers).toBe(false);
    if (resLow.value.hasNumbers) return;
    expect(resLow.value.reason).toBe("face_share_too_low");

    // Exactly 6 of 10 frames have a face (6 / 10 = 0.6 >= 0.6)
    const edgeFaceShare: CameraSessionInput = {
      frames: Array.from({ length: 10 }, (_, i) => ({
        timestampMs: i * 2000,
        blendshapes: i < 6 ? { mouthSmileLeft: 0.2 } : null,
        headPose: i < 6 ? { pitch: 0, yaw: 0, roll: 0 } : null,
      })),
    };
    const resEdge = calculateCameraSession(edgeFaceShare, config);
    expect(resEdge.ok).toBe(true);
    if (!resEdge.ok) return;
    expect(resEdge.value.hasNumbers).toBe(true);
  });
});
