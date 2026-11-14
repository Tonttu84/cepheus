"""
Cepheus — Arduino UNO Q Edge Monitor (USB Camera)

Runs locally on the Arduino UNO Q (2 GB / 4 GB) with the external USB webcam.
Privacy & project-rule invariants (AGENTS.md + Trail #24/#25 review notes):
  - Video frames and microphone audio stay strictly on the device in RAM and are
    discarded immediately. Never stream audio/video to any cloud speech or AI API.
  - Only derived numeric summaries (motion-bout duration, ambient brightness
    proxy, and optional face/head movement dispersion) are sent to Cepheus.
  - Any future on-device spoken question adapter (e.g. Piper TTS + whisper.cpp
    run sequentially in 2 GB RAM) must map answers strictly to fixed item scores
    without voice mood reading and provide an always-available crisis path to a
    person and 112 on the physical unit.

Environment variables:
  CEPHEUS_INGEST_URL   e.g. http://192.168.1.50:3000/api/arduino/ingest
  ARDUINO_INGEST_TOKEN Per-device bearer token matching server configuration
  CEPHEUS_DEVICE_ID    Device identifier (default: unoq-home-01)
  CAMERA_INDEX         UVC camera index (default: 0)
"""

from __future__ import annotations

import argparse
import datetime as dt
import gc
import math
import os
import secrets
import time
from typing import Any

import cv2
import numpy as np
import requests


def extract_euler_deg(matrix_4x4: np.ndarray) -> tuple[float, float, float]:
    """Converts a 4x4 facial transformation matrix rotation block to pitch/yaw/roll in deg."""
    r = matrix_4x4[:3, :3]
    sy = math.sqrt(float(r[0, 0] ** 2 + r[1, 0] ** 2))
    singular = sy < 1e-6
    if not singular:
        pitch = math.atan2(float(r[2, 1]), float(r[2, 2]))
        yaw = math.atan2(float(-r[2, 0]), sy)
        roll = math.atan2(float(r[1, 0]), float(r[0, 0]))
    else:
        pitch = math.atan2(float(-r[1, 2]), float(r[1, 1]))
        yaw = math.atan2(float(-r[2, 0]), sy)
        roll = 0.0
    return (math.degrees(pitch), math.degrees(yaw), math.degrees(roll))


def estimate_lux_proxy(gray_frame: np.ndarray) -> float:
    """Rough relative room brightness proxy (0..500 lux scale) from luma mean."""
    mean_luma = float(np.mean(gray_frame))
    return round(max(0.0, (mean_luma / 255.0) * 500.0), 1)


def run_edge_window(
    duration_sec: int = 20,
    camera_index: int = 0,
    face_landmarker_model: str | None = None,
    width: int = 640,
    height: int = 480,
    target_fps: int = 10,
) -> dict[str, Any]:
    """
    Captures frames in RAM for `duration_sec`, computes derived immobility,
    brightness, and optional MediaPipe movement metrics, then releases camera.
    Defaults to 640x480 @ 10 fps to fit comfortably in Arduino UNO Q (2 GB RAM).
    """
    cap = cv2.VideoCapture(camera_index)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, target_fps)

    if not cap.isOpened():
        raise RuntimeError(f"Could not open USB camera at index {camera_index}")

    landmarker = None
    if face_landmarker_model and os.path.exists(face_landmarker_model):
        import mediapipe as mp

        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=face_landmarker_model),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
        )
        landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)

    prev_gray: np.ndarray | None = None
    motion_scores: list[float] = []
    lux_samples: list[float] = []
    blendshape_series: dict[str, list[float]] = {}
    poses: list[tuple[float, float, float, float]] = []
    total_frames = 0
    face_frames = 0

    start_mono = time.monotonic()
    last_ts_ms = -1

    try:
        while (time.monotonic() - start_mono) < duration_sec:
            ok, frame_bgr = cap.read()
            if not ok or frame_bgr is None:
                continue

            total_frames += 1
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            lux_samples.append(estimate_lux_proxy(gray))

            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
                motion_scores.append(float(np.mean(diff)))
            prev_gray = gray

            if landmarker is not None:
                import mediapipe as mp

                ts_ms = int((time.monotonic() - start_mono) * 1000)
                if ts_ms <= last_ts_ms:
                    ts_ms = last_ts_ms + 1
                last_ts_ms = ts_ms

                rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                res = landmarker.detect_for_video(mp_img, ts_ms)

                if res.face_blendshapes and res.facial_transformation_matrixes:
                    face_frames += 1
                    for cat in res.face_blendshapes[0]:
                        if cat.category_name.startswith(("eyeLook", "eyeBlink", "_")):
                            continue
                        blendshape_series.setdefault(cat.category_name, []).append(
                            float(cat.score)
                        )
                    mat = np.array(
                        res.facial_transformation_matrixes[0], dtype=np.float64
                    ).reshape(4, 4)
                    pitch, yaw, roll = extract_euler_deg(mat)
                    poses.append((ts_ms / 1000.0, pitch, yaw, roll))
    finally:
        cap.release()
        if landmarker is not None:
            landmarker.close()
        del landmarker
        gc.collect()

    elapsed = max(1.0, time.monotonic() - start_mono)
    effective_fps = round(total_frames / elapsed, 2)
    ambient_lux = round(float(np.mean(lux_samples)), 1) if lux_samples else 0.0

    # Simple stationary estimate for this sampling window (scaled in production over 24h)
    still_ratio = (
        sum(1 for m in motion_scores if m < 2.2) / len(motion_scores)
        if motion_scores
        else 1.0
    )
    stationary_minutes_est = round((elapsed / 60.0) * still_ratio, 1)

    now = dt.datetime.now(dt.timezone.utc)
    payload: dict[str, Any] = {
        "deviceId": os.environ.get("CEPHEUS_DEVICE_ID", "unoq-home-01"),
        "date": now.strftime("%Y-%m-%d"),
        "hourOfDay": now.hour,
        "timestampMs": int(time.time() * 1000),
        "nonce": secrets.token_hex(16),
        "isSimulated": False,
        "routine": {
            "sensorActive": True,
            "stationaryMinutes": stationary_minutes_est,
            "longestBoutMinutes": stationary_minutes_est,
            "prolongedBoutCount": 1 if stationary_minutes_est >= 60 else 0,
            "ambientLuxMean": ambient_lux,
        },
    }

    if total_frames > 0 and face_frames > 0:
        sds = [float(np.std(vals)) for vals in blendshape_series.values() if len(vals) > 1]
        expressivity = round(float(np.mean(sds)), 4) if sds else 0.0
        angular_path = 0.0
        if len(poses) >= 2:
            total_deg = 0.0
            for i in range(1, len(poses)):
                _, p0, y0, r0 = poses[i - 1]
                _, p1, y1, r1 = poses[i]
                total_deg += math.sqrt((p1 - p0) ** 2 + (y1 - y0) ** 2 + (r1 - r0) ** 2)
            angular_path = round((total_deg / elapsed) * 60.0, 2)

        yaw_sd = round(float(np.std([p[2] for p in poses])), 2) if len(poses) > 1 else 0.0
        pitch_sd = round(float(np.std([p[1] for p in poses])), 2) if len(poses) > 1 else 0.0

        payload["camera"] = {
            "taskId": "uno_q_edge_check",
            "durationSec": round(elapsed, 2),
            "effectiveFps": effective_fps,
            "faceDetectedRatio": round(face_frames / total_frames, 3),
            "expressivityScore": expressivity,
            "yawSdDeg": yaw_sd,
            "pitchSdDeg": pitch_sd,
            "angularPathDegPerMin": angular_path,
        }

    return payload


def post_derived_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    ingest_url = os.environ.get(
        "CEPHEUS_INGEST_URL", "http://localhost:3000/api/arduino/ingest"
    )
    token = os.environ.get("ARDUINO_INGEST_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resp = requests.post(ingest_url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cepheus UNO Q Edge Monitor")
    parser.add_argument("--duration", type=int, default=20)
    parser.add_argument("--width", type=int, default=int(os.environ.get("CAMERA_WIDTH", "640")))
    parser.add_argument("--height", type=int, default=int(os.environ.get("CAMERA_HEIGHT", "480")))
    parser.add_argument("--fps", type=int, default=int(os.environ.get("CAMERA_FPS", "10")))
    args = parser.parse_args()

    model_path = os.environ.get("MEDIAPIPE_FACE_MODEL", "face_landmarker.task")
    cam_idx = int(os.environ.get("CAMERA_INDEX", "0"))
    summary = run_edge_window(
        duration_sec=args.duration,
        camera_index=cam_idx,
        face_landmarker_model=model_path,
        width=args.width,
        height=args.height,
        target_fps=args.fps,
    )
    result = post_derived_metrics(summary)
    print("Ingest response:", result)
