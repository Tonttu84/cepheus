import { describe, expect, it } from "vitest";
import {
  extractCameraFrame,
  readFrameData,
  type FaceLandmarkerDetectionResult,
} from "../index";

const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

describe("readFrameData and extractCameraFrame", () => {
  it("returns null blendshapes and headPose when detection is null or undefined", () => {
    expect(readFrameData(null)).toEqual({
      blendshapes: null,
      headPose: null,
    });
    expect(readFrameData(undefined)).toEqual({
      blendshapes: null,
      headPose: null,
    });

    expect(extractCameraFrame(null, 150)).toEqual({
      timestampMs: 150,
      blendshapes: null,
      headPose: null,
    });
  });

  it("returns null blendshapes and headPose when faceLandmarks is empty", () => {
    const detection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [],
      faceBlendshapes: [
        {
          categories: [{ categoryName: "mouthSmileLeft", score: 0.5 }],
        },
      ],
      facialTransformationMatrixes: [IDENTITY_MATRIX],
    };

    expect(readFrameData(detection)).toEqual({
      blendshapes: null,
      headPose: null,
    });
  });

  it("extracts blendshapes and head pose when face is detected and matrix is valid", () => {
    const detection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: "browDownLeft", score: 0.15 },
            { categoryName: "mouthSmileLeft", score: 0.8 },
          ],
        },
      ],
      facialTransformationMatrixes: [IDENTITY_MATRIX],
    };

    const result = readFrameData(detection);
    expect(result.blendshapes).toEqual({
      browDownLeft: 0.15,
      mouthSmileLeft: 0.8,
    });
    expect(result.headPose).toEqual({
      pitch: 0,
      yaw: 0,
      roll: 0,
    });

    const frame = extractCameraFrame(detection, 1250);
    expect(frame).toEqual({
      timestampMs: 1250,
      blendshapes: {
        browDownLeft: 0.15,
        mouthSmileLeft: 0.8,
      },
      headPose: {
        pitch: 0,
        yaw: 0,
        roll: 0,
      },
    });
  });

  it("supports matrix wrapped in { data: number[] } format", () => {
    const detection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [{}],
      faceBlendshapes: [
        {
          categories: [{ categoryName: "jawOpen", score: 0.42 }],
        },
      ],
      facialTransformationMatrixes: [{ data: IDENTITY_MATRIX }],
    };

    const result = readFrameData(detection);
    expect(result.blendshapes).toEqual({ jawOpen: 0.42 });
    expect(result.headPose).toEqual({ pitch: 0, yaw: 0, roll: 0 });
  });

  it("nullifies blendshapes if facial transformation matrix is invalid or missing", () => {
    // When pose cannot be reliably estimated, blendshapes must also be null
    // so downstream metric calculators treat the frame as invalid
    const invalidMatrixDetection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [{}],
      faceBlendshapes: [
        {
          categories: [{ categoryName: "mouthSmileLeft", score: 0.9 }],
        },
      ],
      facialTransformationMatrixes: [[1, 2, 3]], // incomplete matrix
    };

    const res1 = readFrameData(invalidMatrixDetection);
    expect(res1.headPose).toBeNull();
    expect(res1.blendshapes).toBeNull();

    const missingMatrixDetection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [{}],
      faceBlendshapes: [
        {
          categories: [{ categoryName: "mouthSmileLeft", score: 0.9 }],
        },
      ],
      facialTransformationMatrixes: [],
    };

    const res2 = readFrameData(missingMatrixDetection);
    expect(res2.headPose).toBeNull();
    expect(res2.blendshapes).toBeNull();
  });

  it("provides empty blendshapes record if face detected and pose valid but no categories present", () => {
    const noCategoriesDetection: FaceLandmarkerDetectionResult = {
      faceLandmarks: [{}],
      faceBlendshapes: [],
      facialTransformationMatrixes: [IDENTITY_MATRIX],
    };

    const result = readFrameData(noCategoriesDetection);
    expect(result.blendshapes).toEqual({});
    expect(result.headPose).toEqual({ pitch: 0, yaw: 0, roll: 0 });
  });
});
