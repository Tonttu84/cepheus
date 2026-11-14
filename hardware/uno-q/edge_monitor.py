"""
Cepheus — Arduino UNO Q Edge Monitor (USB Camera)

Runs locally on the Arduino UNO Q (2 GB / 4 GB) with the external USB webcam,
either standalone or simultaneously alongside Bluetooth headphone voice check-ins
(`ConcurrentEdgeCamera`).

Privacy & project-rule invariants (AGENTS.md + Trail #24/#25):
  - Video frames stay strictly on the device in RAM and are discarded immediately.
  - Only derived numeric summaries (motion-bout duration, ambient brightness
    proxy, and facial expressivity / head movement dispersion) are sent to Cepheus.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import gc
import glob
import math
import os
import re
import secrets
import threading
import time
import urllib.request
from typing import Any

import requests

try:
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover - guarded so unit tests run without cv2
    cv2 = None  # type: ignore[assignment]
    np = None  # type: ignore[assignment]

LBF_MODEL_URL = (
    "https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml"
)


@dataclasses.dataclass(frozen=True)
class EdgeWindowConfig:
    duration_sec: float = 20.0
    min_duration_sec: float = 1.5
    camera_index: int = 0
    face_landmarker_model: str | None = None
    width: int = 640
    height: int = 480
    target_fps: int = 10
    task_id: str = "uno_q_edge_check"


@dataclasses.dataclass
class _WindowAccumulator:
    prev_gray: Any = None
    motion_scores: list[float] = dataclasses.field(default_factory=list)
    lux_samples: list[float] = dataclasses.field(default_factory=list)
    blendshape_series: dict[str, list[float]] = dataclasses.field(default_factory=dict)
    poses: list[tuple[float, float, float, float]] = dataclasses.field(default_factory=list)
    smile_hits: int = 0
    total_frames: int = 0
    face_frames: int = 0
    last_ts_ms: int = -1


def extract_euler_deg(matrix_4x4: Any) -> tuple[float, float, float]:
    """Converts a 4x4 facial transformation matrix rotation block to pitch/yaw/roll in deg."""
    r = matrix_4x4[:3, :3]
    sy = math.sqrt(float(r[0, 0] ** 2 + r[1, 0] ** 2))
    if sy >= 1e-6:
        pitch = math.atan2(float(r[2, 1]), float(r[2, 2]))
        yaw = math.atan2(float(-r[2, 0]), sy)
        roll = math.atan2(float(r[1, 0]), float(r[0, 0]))
    else:
        pitch = math.atan2(float(-r[1, 2]), float(r[1, 1]))
        yaw = math.atan2(float(-r[2, 0]), sy)
        roll = 0.0
    return (math.degrees(pitch), math.degrees(yaw), math.degrees(roll))


def estimate_lux_proxy(gray_frame: Any) -> float:
    """Rough relative room brightness proxy (0..500 lux scale) from luma mean."""
    mean_luma = float(np.mean(gray_frame))
    return round(max(0.0, (mean_luma / 255.0) * 500.0), 1)


def cpu_supports_mediapipe() -> bool:
    """MediaPipe's aarch64 wheel requires ARMv8.2+ LSE atomics (unavailable on Cortex-A53)."""
    if os.uname().machine != "aarch64":
        return True
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as fh:
            return "atomics" in fh.read()
    except OSError:
        return True


def detect_default_camera_index() -> int:
    """Picks explicit CAMERA_INDEX or first UVC camera (skipping Qualcomm Venus codecs)."""
    raw_env = os.environ.get("CAMERA_INDEX", "").strip()
    if raw_env:
        return int(raw_env)

    skip_tokens = ("venus", "codec", "decoder", "encoder", "isp")
    for name_file in sorted(glob.glob("/sys/class/video4linux/video*/name")):
        match = re.search(r"video(\d+)/name$", name_file)
        if not match:
            continue
        try:
            with open(name_file, encoding="utf-8") as fh:
                label = fh.read().strip().lower()
        except OSError:
            continue
        if label and not any(tok in label for tok in skip_tokens):
            return int(match.group(1))
    return 0


def _load_haar_cascade(filename: str) -> Any | None:
    local_path = os.path.join(os.path.dirname(__file__), filename)
    cascade_path = (
        local_path if os.path.exists(local_path) else cv2.data.haarcascades + filename
    )
    if not os.path.exists(cascade_path):
        return None
    cascade = cv2.CascadeClassifier(cascade_path)
    return None if cascade.empty() else cascade


def _resolve_lbf_model_path(explicit_path: str | None) -> str | None:
    cache_path = os.path.expanduser("~/.cache/cepheus/lbfmodel.yaml")
    candidates = [
        explicit_path,
        os.environ.get("OPENCV_FACEMARK_MODEL"),
        os.path.join(os.path.dirname(__file__), "lbfmodel.yaml"),
        cache_path,
    ]
    found = next((p for p in candidates if p and os.path.exists(p)), None)
    if found or os.environ.get("AUTO_DOWNLOAD_MODELS", "true").lower() == "false":
        return found
    if not hasattr(cv2, "face"):
        return None
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        urllib.request.urlretrieve(LBF_MODEL_URL, cache_path)
        return cache_path if os.path.exists(cache_path) else None
    except Exception:
        return None


def init_opencv_facemark(model_path: str | None) -> tuple[Any, Any] | None:
    """Loads Haar frontal face detector + OpenCV FacemarkLBF 68-point model if present."""
    if not hasattr(cv2, "face"):
        return None
    resolved = _resolve_lbf_model_path(model_path)
    cascade = _load_haar_cascade("haarcascade_frontalface_default.xml")
    if not resolved or cascade is None:
        return None
    facemark = cv2.face.createFacemarkLBF()
    facemark.loadModel(resolved)
    return cascade, facemark


def init_haar_fallback_detectors() -> tuple[Any, Any | None, Any | None] | None:
    """Zero-download fallback using bundled OpenCV Haar face/eye/smile cascades."""
    face_cascade = _load_haar_cascade("haarcascade_frontalface_default.xml")
    if face_cascade is None:
        return None
    eye_cascade = _load_haar_cascade("haarcascade_eye.xml")
    smile_cascade = _load_haar_cascade("haarcascade_smile.xml")
    return face_cascade, eye_cascade, smile_cascade


def extract_facemark_metrics(
    pts: Any, frame_shape: tuple[int, ...]
) -> tuple[dict[str, float], tuple[float, float, float] | None]:
    """Computes normalized 68-point expression ratios and head Euler angles (deg)."""
    eye_dist = max(1.0, float(np.linalg.norm(pts[45] - pts[36])))
    ratios = {
        "mouthOpen": float(np.linalg.norm(pts[66] - pts[62])) / eye_dist,
        "mouthWidth": float(np.linalg.norm(pts[54] - pts[48])) / eye_dist,
        "leftEyeOpen": float(np.linalg.norm(pts[41] - pts[37])) / eye_dist,
        "rightEyeOpen": float(np.linalg.norm(pts[47] - pts[43])) / eye_dist,
        "leftBrowLift": float(pts[37][1] - pts[19][1]) / eye_dist,
        "rightBrowLift": float(pts[44][1] - pts[24][1]) / eye_dist,
    }
    h, w = frame_shape[:2]
    model_3d = np.array(
        [
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0),
        ],
        dtype=np.float64,
    )
    image_2d = np.array(
        [pts[30], pts[8], pts[36], pts[45], pts[48], pts[54]], dtype=np.float64
    )
    cam_mat = np.array([[w, 0, w / 2], [0, w, h / 2], [0, 0, 1]], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(
        model_3d, image_2d, cam_mat, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not ok:
        return ratios, None
    rmat, _ = cv2.Rodrigues(rvec)
    mat4 = np.eye(4, dtype=np.float64)
    mat4[:3, :3] = rmat
    return ratios, extract_euler_deg(mat4)


def _extract_haar_roi_metrics(
    gray: Any,
    face_box: tuple[int, int, int, int],
    eye_cascade: Any | None,
    smile_cascade: Any | None,
) -> tuple[dict[str, float], tuple[float, float, float], bool]:
    x, y, fw, fh = [int(v) for v in face_box]
    h_img, w_img = gray.shape[:2]
    roi = gray[max(0, y) : min(h_img, y + fh), max(0, x) : min(w_img, x + fw)]
    upper = roi[: max(1, fh // 2), :]
    lower = roi[max(0, (fh * 3) // 5) :, :]

    face_std = max(1.0, float(np.std(roi)))
    gx = cv2.Sobel(lower, cv2.CV_32F, 1, 0, ksize=3) if lower.size > 0 else np.zeros((1, 1))
    gy = cv2.Sobel(lower, cv2.CV_32F, 0, 1, ksize=3) if lower.size > 0 else np.zeros((1, 1))
    ratios = {
        "mouthContrast": float(np.std(lower)) / 255.0 if lower.size > 0 else 0.0,
        "mouthEdge": min(1.0, float(np.mean(np.hypot(gx, gy))) / (face_std * 4.0)),
        "upperTone": float(np.std(upper)) / 255.0 if upper.size > 0 else 0.0,
    }

    roll_deg = 0.0
    if eye_cascade is not None and upper.size > 0:
        eyes = eye_cascade.detectMultiScale(upper, scaleFactor=1.15, minNeighbors=4)
        if len(eyes) >= 2:
            e_sorted = sorted(eyes, key=lambda e: e[0])[:2]
            dx = float((e_sorted[1][0] + e_sorted[1][2] / 2) - (e_sorted[0][0] + e_sorted[0][2] / 2))
            dy = float((e_sorted[1][1] + e_sorted[1][3] / 2) - (e_sorted[0][1] + e_sorted[0][3] / 2))
            if abs(dx) > 1.0:
                roll_deg = math.degrees(math.atan2(dy, dx))

    smiling = False
    if smile_cascade is not None and lower.size > 0:
        smiles = smile_cascade.detectMultiScale(lower, scaleFactor=1.7, minNeighbors=18)
        smiling = len(smiles) > 0

    cx = x + fw / 2.0
    cy = y + fh / 2.0
    yaw_deg = ((cx - w_img / 2.0) / max(1.0, float(w_img))) * 60.0
    pitch_deg = ((cy - h_img / 2.0) / max(1.0, float(h_img))) * 45.0
    return ratios, (pitch_deg, yaw_deg, roll_deg), smiling


def _open_mediapipe_landmarker(model_path: str | None) -> Any | None:
    if not (model_path and os.path.exists(model_path) and cpu_supports_mediapipe()):
        return None
    import mediapipe as mp

    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_faces=1,
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=True,
    )
    return mp.tasks.vision.FaceLandmarker.create_from_options(options)


def _record_mediapipe_frame(
    landmarker: Any, frame_bgr: Any, elapsed_sec: float, acc: _WindowAccumulator
) -> None:
    import mediapipe as mp

    ts_ms = max(acc.last_ts_ms + 1, int(elapsed_sec * 1000))
    acc.last_ts_ms = ts_ms
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    res = landmarker.detect_for_video(mp_img, ts_ms)
    if not (res.face_blendshapes and res.facial_transformation_matrixes):
        return

    acc.face_frames += 1
    smile_scores: list[float] = []
    for cat in res.face_blendshapes[0]:
        if cat.category_name in ("mouthSmileLeft", "mouthSmileRight"):
            smile_scores.append(float(cat.score))
        if cat.category_name.startswith(("eyeLook", "eyeBlink", "_")):
            continue
        acc.blendshape_series.setdefault(cat.category_name, []).append(float(cat.score))
    if smile_scores and (sum(smile_scores) / len(smile_scores)) >= 0.35:
        acc.smile_hits += 1
    mat = np.array(res.facial_transformation_matrixes[0], dtype=np.float64).reshape(4, 4)
    acc.poses.append((ts_ms / 1000.0, *extract_euler_deg(mat)))


def _record_facemark_frame(
    cv_facemark: tuple[Any, Any],
    gray: Any,
    frame_shape: tuple[int, ...],
    elapsed_sec: float,
    acc: _WindowAccumulator,
) -> None:
    cascade, facemark = cv_facemark
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        return
    largest = max(faces, key=lambda f: f[2] * f[3])
    ok_fit, lm = facemark.fit(gray, np.array([largest]))
    if not ok_fit or len(lm) == 0:
        return
    pts = np.asarray(lm[0], dtype=np.float64).reshape(-1, 2)
    if len(pts) < 68:
        return
    acc.face_frames += 1
    ratios, euler = extract_facemark_metrics(pts, frame_shape)
    for key, val in ratios.items():
        acc.blendshape_series.setdefault(key, []).append(val)
    if euler is not None:
        acc.poses.append((elapsed_sec, *euler))


def _record_haar_frame(
    haar_bundle: tuple[Any, Any | None, Any | None],
    gray: Any,
    elapsed_sec: float,
    acc: _WindowAccumulator,
) -> None:
    face_cascade, eye_cascade, smile_cascade = haar_bundle
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(72, 72))
    if len(faces) == 0:
        return
    largest = max(faces, key=lambda f: f[2] * f[3])
    acc.face_frames += 1
    ratios, euler, smiling = _extract_haar_roi_metrics(
        gray, tuple(largest), eye_cascade, smile_cascade
    )
    for key, val in ratios.items():
        acc.blendshape_series.setdefault(key, []).append(val)
    if smiling:
        acc.smile_hits += 1
    acc.poses.append((elapsed_sec, *euler))


def _build_summary_payload(
    acc: _WindowAccumulator, elapsed: float, task_id: str
) -> dict[str, Any]:
    effective_fps = round(max(0.5, min(120.0, acc.total_frames / elapsed)), 2)
    ambient_lux = round(float(np.mean(acc.lux_samples)), 1) if acc.lux_samples else 0.0
    still_ratio = (
        sum(1 for m in acc.motion_scores if m < 2.2) / len(acc.motion_scores)
        if acc.motion_scores
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

    if acc.total_frames > 0 and acc.face_frames > 0:
        sds = [
            float(np.std(vals))
            for vals in acc.blendshape_series.values()
            if len(vals) > 1
        ]
        expressivity = round(min(2.0, max(0.0, float(np.mean(sds)) if sds else 0.0)), 4)
        angular_path = 0.0
        if len(acc.poses) >= 2:
            total_deg = 0.0
            for idx in range(1, len(acc.poses)):
                _, p0, y0, r0 = acc.poses[idx - 1]
                _, p1, y1, r1 = acc.poses[idx]
                total_deg += math.sqrt((p1 - p0) ** 2 + (y1 - y0) ** 2 + (r1 - r0) ** 2)
            angular_path = round(min(5000.0, (total_deg / elapsed) * 60.0), 2)

        yaw_sd = round(float(np.std([p[2] for p in acc.poses])), 2) if len(acc.poses) > 1 else 0.0
        pitch_sd = round(float(np.std([p[1] for p in acc.poses])), 2) if len(acc.poses) > 1 else 0.0
        payload["camera"] = {
            "taskId": task_id,
            "durationSec": round(max(1.0, elapsed), 2),
            "effectiveFps": effective_fps,
            "faceDetectedRatio": round(acc.face_frames / acc.total_frames, 3),
            "expressivityScore": expressivity,
            "smileFraction": round(acc.smile_hits / acc.face_frames, 3),
            "yawSdDeg": min(180.0, yaw_sd),
            "pitchSdDeg": min(180.0, pitch_sd),
            "angularPathDegPerMin": angular_path,
        }

    return payload


def run_edge_window_with_config(
    config: EdgeWindowConfig,
    stop_event: threading.Event | None = None,
    abort_event: threading.Event | None = None,
) -> dict[str, Any]:
    """Captures camera frames in RAM until duration or `stop_event`, returning derived metrics."""
    if cv2 is None or np is None:
        raise RuntimeError(
            "OpenCV and NumPy are required (`pip install -r hardware/uno-q/requirements.txt`)."
        )

    cap = cv2.VideoCapture(config.camera_index)
    if hasattr(cv2, "CAP_PROP_BUFFERSIZE"):
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.height)
    cap.set(cv2.CAP_PROP_FPS, config.target_fps)

    if not cap.isOpened():
        raise RuntimeError(f"Could not open USB camera at index {config.camera_index}")

    landmarker = _open_mediapipe_landmarker(config.face_landmarker_model)
    cv_facemark = None if landmarker is not None else init_opencv_facemark(None)
    haar_bundle = (
        None if (landmarker is not None or cv_facemark is not None) else init_haar_fallback_detectors()
    )

    acc = _WindowAccumulator()
    start_mono = time.monotonic()
    frame_interval = 1.0 / max(1, config.target_fps)

    try:
        while True:
            if abort_event is not None and abort_event.is_set():
                break
            elapsed_now = time.monotonic() - start_mono
            if elapsed_now >= config.duration_sec:
                break
            if stop_event is not None and stop_event.is_set() and elapsed_now >= config.min_duration_sec:
                break

            frame_start = time.monotonic()
            ok, frame_bgr = cap.read()
            if not ok or frame_bgr is None:
                time.sleep(0.02)
                continue

            acc.total_frames += 1
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            acc.lux_samples.append(estimate_lux_proxy(gray))
            if acc.prev_gray is not None:
                diff = cv2.absdiff(gray, acc.prev_gray)
                acc.motion_scores.append(float(np.mean(diff)))
            acc.prev_gray = gray

            rel_sec = time.monotonic() - start_mono
            if landmarker is not None:
                _record_mediapipe_frame(landmarker, frame_bgr, rel_sec, acc)
            elif cv_facemark is not None:
                _record_facemark_frame(cv_facemark, gray, frame_bgr.shape, rel_sec, acc)
            elif haar_bundle is not None:
                _record_haar_frame(haar_bundle, gray, rel_sec, acc)

            sleep_rem = frame_interval - (time.monotonic() - frame_start)
            if sleep_rem > 0.002:
                time.sleep(sleep_rem)
    finally:
        cap.release()
        if landmarker is not None:
            landmarker.close()
        del landmarker
        gc.collect()

    elapsed = max(1.0, time.monotonic() - start_mono)
    return _build_summary_payload(acc, elapsed, config.task_id)


def run_edge_window(
    duration_sec: int = 20,
    camera_index: int = 0,
    face_landmarker_model: str | None = None,
    width: int = 640,
    height: int = 480,
    target_fps: int = 10,
) -> dict[str, Any]:
    """Backward-compatible entry point for standalone sampling windows."""
    cfg = EdgeWindowConfig(
        duration_sec=float(duration_sec),
        camera_index=camera_index,
        face_landmarker_model=face_landmarker_model,
        width=width,
        height=height,
        target_fps=target_fps,
    )
    return run_edge_window_with_config(cfg)


class ConcurrentEdgeCamera:
    """Runs on-device facial & ambient monitoring simultaneously during voice Q&A."""

    def __init__(self, config: EdgeWindowConfig) -> None:
        self._config = config
        self._stop_event = threading.Event()
        self._abort_event = threading.Event()
        self._summary: dict[str, Any] | None = None
        self._error: Exception | None = None
        self._thread: threading.Thread | None = None

    @property
    def error(self) -> Exception | None:
        return self._error

    def _worker(self) -> None:
        try:
            self._summary = run_edge_window_with_config(
                self._config,
                stop_event=self._stop_event,
                abort_event=self._abort_event,
            )
        except Exception as exc:  # pragma: no cover - hardware fault isolation
            self._error = exc

    def start(self) -> None:
        self._thread = threading.Thread(target=self._worker, name="unoq-edge-camera", daemon=True)
        self._thread.start()

    def stop(self, abort: bool = False) -> dict[str, Any] | None:
        if abort:
            self._abort_event.set()
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0 if abort else 8.0)
        if abort or self._error is not None:
            return None
        return self._summary


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
    cam_idx = detect_default_camera_index()
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
