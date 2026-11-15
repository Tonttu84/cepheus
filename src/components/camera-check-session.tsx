"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_CAMERA_SESSION_CONFIG,
  type CameraSessionConfig,
  type CameraSessionOutput,
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
  canSave?: boolean;
  patientId?: string;
}

export async function saveCompletedCameraReading({
  patientId,
  sessionResult,
  canSave,
}: {
  patientId?: string;
  sessionResult: CameraSessionOutput & { hasNumbers: true };
  canSave?: boolean;
}): Promise<boolean> {
  if (!canSave || !patientId) return false;

  try {
    await fetch("/api/camera/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: patientId,
        date: new Date().toISOString().split("T")[0],
        durationSec:
          Math.round(sessionResult.quality.sessionDurationMs / 1000) || 20,
        effectiveFps: 30,
        faceDetectedRatio: sessionResult.quality.faceShare,
        expressivityScore: sessionResult.expressivity,
        smileFraction: 0,
        yawSdDeg: 1,
        pitchSdDeg: 1,
        angularPathDegPerMin: sessionResult.headMovement * 60,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

function SessionStateBody({
  state,
  errorMessage,
  sessionResult,
  onStart,
  onStop,
  onReset,
  canSave = true,
}: {
  state: SessionState;
  errorMessage: string | null;
  sessionResult: ReturnType<typeof useCameraSession>["sessionResult"];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  canSave?: boolean;
}) {
  switch (state) {
    case "idle":
      return <CameraIdleView onStart={onStart} />;
    case "loading_model":
    case "requesting_camera":
      return <CameraPreparingView state={state} onCancel={onStop} />;
    case "completed":
      return sessionResult && sessionResult.hasNumbers ? (
        <CameraCompletedView
          sessionResult={sessionResult}
          onReset={onReset}
          canSave={canSave}
        />
      ) : null;
    case "stopped":
      return <CameraStoppedView onReset={onReset} />;
    case "permission_denied":
      return <CameraPermissionDeniedView onRetry={onStart} />;
    case "no_camera":
      return <CameraNotFoundView onRetry={onStart} />;
    case "model_error":
      return (
        <CameraModelErrorView onRetry={onStart} errorMessage={errorMessage} />
      );
    case "no_face_found":
      return <CameraNoFaceFoundView onRetry={onStart} />;
    case "error":
      return (
        <CameraGenericErrorView onRetry={onStart} errorMessage={errorMessage} />
      );
    default:
      return null;
  }
}

export function CameraCheckSession({
  durationMs: propDurationMs = 20_000,
  config = DEFAULT_CAMERA_SESSION_CONFIG,
  canSave = true,
  patientId,
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

  useEffect(() => {
    if (
      state === "completed" &&
      sessionResult &&
      sessionResult.hasNumbers &&
      canSave &&
      patientId
    ) {
      void saveCompletedCameraReading({
        patientId,
        sessionResult,
        canSave,
      });
    }
  }, [state, sessionResult, canSave, patientId]);

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

      {/* Recording stays mounted so videoRef remains attached */}
      <div className={state === "recording" ? "" : "hidden"}>
        <CameraRecordingView
          videoRef={videoRef}
          progressPercent={progressPercent}
          remainingSec={remainingSec}
          onStop={handleStop}
        />
      </div>

      <SessionStateBody
        state={state}
        errorMessage={errorMessage}
        sessionResult={sessionResult}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
        canSave={canSave}
      />
    </div>
  );
}
