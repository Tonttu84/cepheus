import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/**
 * Loads the MediaPipe Face Landmarker model using local assets with GPU and CPU fallback.
 */
export async function loadFaceLandmarker(
  cached?: FaceLandmarker | null
): Promise<FaceLandmarker> {
  if (cached) {
    return cached;
  }

  const { FilesetResolver, FaceLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );

  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  } catch {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }
}

/**
 * Safely closes a FaceLandmarker instance, ignoring errors.
 */
export function closeFaceLandmarker(landmarker: FaceLandmarker | null): void {
  if (!landmarker) return;
  try {
    landmarker.close();
  } catch {
    // ignore close error
  }
}
