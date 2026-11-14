"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CAMERA_SESSION_CONFIG,
  type CameraSessionConfig,
} from "@/domain/camera";
import {
  useCameraSession,
  type SessionState,
} from "./camera/use-camera-session";
import { CameraIdleView } from "./camera/camera-idle-view";
import { CameraPreparingView } from "./camera/camera-preparing-view";
import { CameraRecordingView } from "./camera/camera-recording-view";
import { CameraCompletedView } from "./camera/camera-completed-view";
import { CameraStoppedView } from "./camera/camera-stopped-view";
import {
  CameraGenericErrorView,
  CameraModelErrorView,
  CameraNoFaceFoundView,
  CameraNotFoundView,
  CameraPermissionDeniedView,
} from "./camera/camera-problem-views";

export type { SessionState };

export interface CameraCheckSessionProps {
  durationMs?: number;
  config?: CameraSessionConfig;
}

export function CameraCheckSession({
  durationMs: propDurationMs = 20_000,
  config = DEFAULT_CAMERA_SESSION_CONFIG,
}: CameraCheckSessionProps) {
  const [durationMs, setDurationMs] = useState<number>(propDurationMs);

  // Allow optional URL search parameter for automated testing (e.g. ?durationMs=2500)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlDuration = params.get("durationMs");
      if (urlDuration) {
        const parsed = parseInt(urlDuration, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setDurationMs(parsed);
        }
      }
    }
  }, []);

  const {
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
  } = useCameraSession({ durationMs, config });

  return (
    <div className="space-y-6">
      {/* Screen-reader live status announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* State 1: IDLE */}
      {state === "idle" && <CameraIdleView onStart={handleStart} />}

      {/* State 2 & 3: Loading or Requesting */}
      {(state === "loading_model" || state === "requesting_camera") && (
        <CameraPreparingView state={state} onCancel={handleStop} />
      )}

      {/* State 4: Recording */}
      <div className={state === "recording" ? "" : "hidden"}>
        <CameraRecordingView
          videoRef={videoRef}
          progressPercent={progressPercent}
          remainingSec={remainingSec}
          onStop={handleStop}
        />
      </div>

      {/* State 5: COMPLETED */}
      {state === "completed" && sessionResult && sessionResult.hasNumbers && (
        <CameraCompletedView
          sessionResult={sessionResult}
          onReset={handleReset}
        />
      )}

      {/* State 6: STOPPED */}
      {state === "stopped" && <CameraStoppedView onReset={handleReset} />}

      {/* State 7: PERMISSION DENIED */}
      {state === "permission_denied" && (
        <CameraPermissionDeniedView onRetry={handleStart} />
      )}

      {/* State 8: NO CAMERA FOUND */}
      {state === "no_camera" && <CameraNotFoundView onRetry={handleStart} />}

      {/* State 9: MODEL ERROR */}
      {state === "model_error" && (
        <CameraModelErrorView
          onRetry={handleStart}
          errorMessage={errorMessage}
        />
      )}

      {/* State 10: NO FACE FOUND FOR MOST OF SESSION */}
      {state === "no_face_found" && (
        <CameraNoFaceFoundView onRetry={handleStart} />
      )}

      {/* State 11: GENERIC ERROR */}
      {state === "error" && (
        <CameraGenericErrorView
          onRetry={handleStart}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
