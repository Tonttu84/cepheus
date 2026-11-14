"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  DEFAULT_CAMERA_SESSION_CONFIG,
  type CameraFrameInput,
  type CameraSessionConfig,
  type CameraSessionOutput,
} from "@/domain/camera";
import {
  attachStreamToVideo,
  obtainCameraMediaStream,
  releaseCameraHardware,
  stopMediaStream,
} from "./camera-stream";
import { closeFaceLandmarker, loadFaceLandmarker } from "./camera-model";
import { evaluateSessionResult, processSingleFrame } from "./camera-frame-loop";

export { stopMediaStream };

export type SessionState =
  | "idle"
  | "loading_model"
  | "requesting_camera"
  | "recording"
  | "completed"
  | "stopped"
  | "permission_denied"
  | "no_camera"
  | "model_error"
  | "no_face_found"
  | "error";

export interface UseCameraSessionOptions {
  durationMs: number;
  config?: CameraSessionConfig;
}

export function useCameraSession({
  durationMs,
  config = DEFAULT_CAMERA_SESSION_CONFIG,
}: UseCameraSessionOptions) {
  const [state, setState] = useState<SessionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(
    Math.ceil(durationMs / 1000)
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>(
    "Camera check is ready to start."
  );
  const [sessionResult, setSessionResult] = useState<CameraSessionOutput | null>(
    null
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const recordedFramesRef = useRef<CameraFrameInput[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastDetectTimestampRef = useRef<number>(0);

  const isMountedRef = useRef<boolean>(true);
  const sessionTokenRef = useRef<number>(0);

  const releaseCamera = useCallback(() => {
    isRunningRef.current = false;
    releaseCameraHardware({
      animationFrameId: animationFrameRef.current,
      stream: streamRef.current,
      video: videoRef.current,
    });
    animationFrameRef.current = null;
    streamRef.current = null;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const tokenRef = sessionTokenRef;

    return () => {
      isMountedRef.current = false;
      tokenRef.current += 1;
      releaseCamera();
      closeFaceLandmarker(landmarkerRef.current);
      landmarkerRef.current = null;
    };
  }, [releaseCamera]);

  const finishSession = useCallback(
    (frames: CameraFrameInput[], totalDurationMs: number) => {
      releaseCamera();

      const result = evaluateSessionResult(
        frames,
        totalDurationMs,
        config,
        durationMs
      );
      recordedFramesRef.current = [];

      if (!result.ok) {
        setState("error");
        setErrorMessage(result.error);
        setLiveAnnouncement(`Check-in encountered an error: ${result.error}`);
        return;
      }

      setSessionResult(result.value);

      if (!result.value.hasNumbers) {
        setState("no_face_found");
        setLiveAnnouncement(
          "No face was detected for enough of the check-in. Please try again."
        );
      } else {
        setState("completed");
        setLiveAnnouncement(
          "Camera check-in complete. Movement measurements are ready."
        );
      }
    },
    [config, durationMs, releaseCamera]
  );

  const processFrame = useCallback(
    (landmarker: FaceLandmarker, currentToken: number) => {
      if (!isRunningRef.current || sessionTokenRef.current !== currentToken) {
        return;
      }

      const tick = processSingleFrame({
        video: videoRef.current,
        landmarker,
        now: performance.now(),
        startTime: startTimeRef.current,
        durationMs,
        lastDetectTimestamp: lastDetectTimestampRef.current,
        recordedFrames: recordedFramesRef.current,
      });

      if (tick.done) {
        finishSession(recordedFramesRef.current, tick.elapsedMs);
        return;
      }

      setProgressPercent(tick.progressPercent);
      setRemainingSec(tick.remainingSec);
      lastDetectTimestampRef.current = tick.newLastDetectTimestamp;

      animationFrameRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, currentToken)
      );
    },
    [durationMs, finishSession]
  );

  const prepareModel = useCallback(
    async (isCancelled: () => boolean): Promise<FaceLandmarker | null> => {
      setState("loading_model");
      setLiveAnnouncement("Loading local face landmarker model...");
      try {
        const landmarker = await loadFaceLandmarker(landmarkerRef.current);
        if (isCancelled()) return null;
        landmarkerRef.current = landmarker;
        return landmarker;
      } catch (err) {
        if (isCancelled()) return null;
        setState("model_error");
        const msg = err instanceof Error ? err.message : "Failed to load model";
        setErrorMessage(msg);
        setLiveAnnouncement("Could not load on-device model. Please try again.");
        return null;
      }
    },
    []
  );

  const obtainCameraStream = useCallback(
    async (isCancelled: () => boolean): Promise<MediaStream | null> => {
      setState("requesting_camera");
      setLiveAnnouncement("Opening camera...");

      const outcome = await obtainCameraMediaStream(isCancelled);
      if (isCancelled() || !outcome.ok) {
        if (!outcome.ok && !outcome.cancelled) {
          if (outcome.failure.kind === "permission_denied") {
            setState("permission_denied");
            setLiveAnnouncement(
              "Camera access permission was denied. Please allow camera access."
            );
          } else if (outcome.failure.kind === "no_camera") {
            setState("no_camera");
            setLiveAnnouncement("No camera was found on this device.");
          } else {
            setState("error");
            setErrorMessage(outcome.failure.message);
            setLiveAnnouncement("Failed to start camera. Please try again.");
          }
        }
        return null;
      }

      return outcome.stream;
    },
    []
  );

  const startRecording = useCallback(
    async (
      stream: MediaStream,
      landmarker: FaceLandmarker,
      currentToken: number,
      isCancelled: () => boolean
    ): Promise<void> => {
      streamRef.current = stream;

      setState("recording");
      setLiveAnnouncement(
        "Camera check-in has started. Keep your face in view."
      );
      isRunningRef.current = true;
      startTimeRef.current = performance.now();
      lastDetectTimestampRef.current = 0;

      const attached = await attachStreamToVideo(
        videoRef.current,
        stream,
        isCancelled
      );

      if (!attached || isCancelled()) {
        if (streamRef.current === stream) {
          streamRef.current = null;
        }
        return;
      }

      animationFrameRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, currentToken)
      );
    },
    [processFrame]
  );

  const handleStart = useCallback(async () => {
    const currentToken = ++sessionTokenRef.current;
    const isCancelled = () =>
      !isMountedRef.current || sessionTokenRef.current !== currentToken;

    releaseCamera();
    setErrorMessage(null);
    setSessionResult(null);
    recordedFramesRef.current = [];
    setProgressPercent(0);
    setRemainingSec(Math.ceil(durationMs / 1000));

    const landmarker = await prepareModel(isCancelled);
    if (!landmarker || isCancelled()) {
      return;
    }

    const stream = await obtainCameraStream(isCancelled);
    if (!stream || isCancelled()) {
      return;
    }

    await startRecording(stream, landmarker, currentToken, isCancelled);
  }, [
    durationMs,
    obtainCameraStream,
    prepareModel,
    releaseCamera,
    startRecording,
  ]);

  const handleStop = useCallback(() => {
    sessionTokenRef.current++;
    releaseCamera();
    recordedFramesRef.current = [];
    setState("stopped");
    setLiveAnnouncement(
      "Camera check-in was stopped. Hardware has been released."
    );
  }, [releaseCamera]);

  const handleReset = useCallback(() => {
    sessionTokenRef.current++;
    releaseCamera();
    setErrorMessage(null);
    setSessionResult(null);
    recordedFramesRef.current = [];
    setProgressPercent(0);
    setRemainingSec(Math.ceil(durationMs / 1000));
    setState("idle");
    setLiveAnnouncement("Ready to start check-in.");
  }, [durationMs, releaseCamera]);

  return {
    state,
    errorMessage,
    progressPercent,
    remainingSec,
    liveAnnouncement,
    sessionResult,
    videoRef,
    handleStart,
    handleStop,
    handleReset,
  };
}
