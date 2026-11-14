"""
Cepheus — Arduino UNO Q (2 GB RAM) Bedside Bluetooth Voice + Simultaneous Camera Kiosk

Features:
  1. Detects connected Bluetooth headphones (PipeWire / PulseAudio / BlueZ) and
     reads check-in questions out loud directly through them (`--watch-bluetooth`
     automatically starts a check-in whenever Bluetooth headphones connect).
  2. Runs USB webcam facial expressivity + 3D head-pose + ambient light monitoring
     SIMULTANEOUSLY in a background thread (`ConcurrentEdgeCamera`) while the user
     listens and answers by voice.
  3. Streams 16 kHz mono mic audio strictly in RAM into local Vosk with a
     constrained check-in grammar — no keyboard presses required and zero `.wav`
     files written to disk.
  4. Enforces the always-available crisis path (`112`, MIELI `09 2525 0111`,
     TMS Clinic Nurse Line) with immediate camera abort and zero automated gating.

Never infers mood from voice prosody or sends raw audio/video off the device.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gc
import glob
import json
import os
import queue
import re
import secrets
import struct
import subprocess
import sys
import threading
import time
from typing import Any

from bluetooth_audio import (
    AudioRoute,
    detect_audio_route,
    ensure_headless_wireplumber_bluetooth,
    open_mic_pcm_stream,
    speak_text_routed,
    wait_for_bluetooth_headphones,
    warm_tts_prompts,
)
from edge_monitor import (
    ConcurrentEdgeCamera,
    EdgeWindowConfig,
    detect_default_camera_index,
    post_derived_metrics,
)

CRISIS_SPOKEN_MESSAGE = (
    "If you need someone right now: call emergency 112, "
    "or call the MIELI Crisis Helpline 24/7 at 09 2525 0111, "
    "or the TMS Clinic Nurse Line at 09 471 71200."
)

CHECKIN_QUESTIONS = (
    (
        "mood",
        "How is your mood right now? Say zero for very low up to four for very good, or say not today.",
    ),
    (
        "interest",
        "How much do you feel like doing things right now? Say zero for not at all up to four for very much, or say not today.",
    ),
)

ALL_FIXED_PROMPTS = [
    f"Wellbeing check-in. {CRISIS_SPOKEN_MESSAGE}",
    CRISIS_SPOKEN_MESSAGE,
    CHECKIN_QUESTIONS[0][1],
    CHECKIN_QUESTIONS[1][1],
    "Please say a number from zero to four, say not today, or say help.",
    "Okay, skipped for today with no penalty.",
    "No problem, moving on with no penalty.",
    "Thank you. Your check-in is saved.",
]

CRISIS_PHRASES = (
    "help",
    "crisis",
    "emergency",
    "112",
    "one one two",
    "one hundred twelve",
    "hurt myself",
    "end my life",
    "call nurse",
    "nurse",
)
NOT_TODAY_PHRASES = ("not today", "skip", "skip today", "pass", "later", "no thanks")
NEGATION_WORDS = frozenset(
    (
        "not",
        "no",
        "never",
        "neither",
        "nor",
        "dont",
        "didnt",
        "isnt",
        "arent",
        "cant",
        "wont",
        "ei",
        "en",
        "et",
    )
)
NUMBER_WORDS = {
    "0": 0,
    "zero": 0,
    "1": 1,
    "one": 1,
    "2": 2,
    "two": 2,
    "3": 3,
    "three": 3,
    "4": 4,
    "four": 4,
}
TAP_LABELS = (
    ("very good", 4),
    ("very much", 4),
    ("quite a bit", 3),
    ("very low", 0),
    ("not at all", 0),
    ("a little", 1),
    ("somewhat", 2),
    ("moderate", 2),
    ("okay", 2),
    ("ok", 2),
    ("good", 3),
    ("low", 1),
)

VOSK_TAP_GRAMMAR = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "very low",
    "not at all",
    "low",
    "a little",
    "okay",
    "ok",
    "somewhat",
    "moderate",
    "good",
    "quite a bit",
    "very good",
    "very much",
    "not today",
    "skip",
    "skip today",
    "pass",
    "later",
    "no thanks",
    "help",
    "crisis",
    "emergency",
    "one one two",
    "one hundred twelve",
    "hurt myself",
    "end my life",
    "call nurse",
    "nurse",
    "not",
    "no",
    "never",
    "dont",
    "or",
    "[unk]",
]


def _contains_whole_phrase(norm: str, phrase: str) -> bool:
    return f" {phrase} " in f" {norm} "


def parse_spoken_tap_choice(transcript: str) -> tuple[str, int | None]:
    """
    Deterministic mirror of src/domain/arduino/voice.ts parseSpokenChoice(..., 'tap').
    Rejects negated ('not good', 'not three') or mixed ('two or three') replies as 'unclear'.
    """
    cleaned = re.sub(r"['’]", "", transcript.lower())
    norm = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", cleaned)).strip()
    if not norm or norm == "unk":
        return ("unclear", None)
    for phrase in CRISIS_PHRASES:
        if _contains_whole_phrase(norm, phrase):
            return ("crisis_help", None)
    for phrase in NOT_TODAY_PHRASES:
        if _contains_whole_phrase(norm, phrase):
            return ("not_today", None)

    without_not_at_all = f" {norm} ".replace(" not at all ", " ").strip()
    if any(tok in NEGATION_WORDS for tok in without_not_at_all.split()):
        return ("unclear", None)

    matched_scores: set[int] = set()
    remaining = f" {norm} "
    for phrase, score in sorted(TAP_LABELS, key=lambda x: len(x[0]), reverse=True):
        padded = f" {phrase} "
        if padded in remaining:
            matched_scores.add(score)
            remaining = remaining.replace(padded, " ")

    for tok in remaining.strip().split():
        if tok in NUMBER_WORDS:
            matched_scores.add(NUMBER_WORDS[tok])

    if len(matched_scores) != 1:
        return ("unclear", None)
    return ("score", next(iter(matched_scores)))


def speak_text_on_device(text: str, route: AudioRoute | None = None) -> None:
    """Speaks text through Bluetooth headphones (or active local audio sink)."""
    speak_text_routed(text, route=route)
    time.sleep(0.15)


def load_vosk_model() -> Any:
    """Loads local Vosk STT model, auto-downloading small-en-us (~40 MB) once if needed."""
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    here = os.path.dirname(__file__)
    cached = sorted(glob.glob(os.path.expanduser("~/.cache/vosk/vosk-model*")))
    candidates = [
        os.environ.get("VOSK_MODEL_PATH", "").strip(),
        os.path.join(here, "vosk-model-small-en-us-0.15"),
        "/opt/models/vosk-model-small-en-us-0.15",
        *cached,
    ]
    for path in candidates:
        if path and os.path.isdir(path):
            return Model(path)
    return Model(lang="en-us")


def _create_recognizer(vosk_model: Any, sample_rate: int = 16000) -> Any:
    from vosk import KaldiRecognizer

    grammar_json = json.dumps(VOSK_TAP_GRAMMAR)
    try:
        return KaldiRecognizer(vosk_model, sample_rate, grammar_json)
    except TypeError:
        return KaldiRecognizer(vosk_model, sample_rate)


def _chunk_rms(pcm_bytes: bytes) -> float:
    count = len(pcm_bytes) // 2
    if count == 0:
        return 0.0
    samples = struct.unpack(f"<{count}h", pcm_bytes[: count * 2])
    mean_sq = sum(s * s for s in samples) / count
    return float(mean_sq**0.5)


def _clean_vosk_text(raw_json: str, field: str = "text") -> str:
    try:
        raw = str(json.loads(raw_json).get(field, ""))
    except Exception:
        return ""
    tokens = [tok for tok in raw.split() if tok != "[unk]"]
    return " ".join(tokens).strip()


def _terminate_stream(proc: subprocess.Popen[bytes]) -> None:
    try:
        if proc.stdout is not None:
            proc.stdout.close()
        proc.terminate()
        proc.wait(timeout=1.5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _audio_reader_worker(
    pipe: Any,
    chunk_bytes: int,
    audio_queue: queue.Queue[bytes | None],
    stop_event: threading.Event,
) -> None:
    try:
        while not stop_event.is_set():
            data = pipe.read(chunk_bytes)
            if not data:
                break
            audio_queue.put(bytes(data))
    except Exception:
        pass
    finally:
        audio_queue.put(None)


def listen_for_voice_transcript(
    vosk_model: Any | None,
    route: AudioRoute | None = None,
    timeout_sec: float = 12.0,
    allow_keyboard_fallback: bool = False,
) -> tuple[str, str | None]:
    """
    Streams live 16 kHz mono mic audio in RAM until a spoken phrase completes
    or a physical MCU button is pressed. Returns `(transcript, mcu_event)`.
    """
    if vosk_model is None:
        if allow_keyboard_fallback and sys.stdin is not None and sys.stdin.isatty():
            try:
                return (
                    input("[Keyboard fallback — type reply (0-4 / not today / help)]: "),
                    None,
                )
            except EOFError:
                return ("", None)
        raise RuntimeError(
            "Vosk voice recognition is required. Install with `pip install vosk`."
        )

    rec = _create_recognizer(vosk_model, 16000)
    proc = open_mic_pcm_stream(route=route, sample_rate=16000)
    chunk_bytes = 3200  # 100 ms @ 16 kHz 16-bit mono
    start = time.monotonic()
    last_voice_ts: float | None = None
    saw_partial = False

    audio_queue: queue.Queue[bytes | None] = queue.Queue()
    stop_event = threading.Event()
    reader_thread: threading.Thread | None = None

    if proc.stdout is not None:
        reader_thread = threading.Thread(
            target=_audio_reader_worker,
            args=(proc.stdout, chunk_bytes, audio_queue, stop_event),
            daemon=True,
        )
        reader_thread.start()

    try:
        if proc.stdout is None:
            return ("", None)

        while (time.monotonic() - start) < timeout_sec:
            mcu_btn = poll_mcu_button_event()
            if mcu_btn is not None:
                return ("", mcu_btn)

            try:
                chunk = audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if chunk is None:
                break

            raw = bytearray(chunk)
            if not raw:
                break

            rms = _chunk_rms(raw)
            accepted = rec.AcceptWaveform(bytes(raw))
            for idx in range(len(raw)):
                raw[idx] = 0

            if accepted:
                text = _clean_vosk_text(rec.Result(), "text")
                if text:
                    print(f"[Voice] Heard: '{text}'", flush=True)
                    return (text, None)
                saw_partial = False
                continue

            partial = _clean_vosk_text(rec.PartialResult(), "partial")
            if partial:
                saw_partial = True
                if rms >= 180.0 or last_voice_ts is None:
                    last_voice_ts = time.monotonic()
                elif (time.monotonic() - last_voice_ts) >= 0.9:
                    final_text = _clean_vosk_text(rec.FinalResult(), "text") or partial
                    print(f"[Voice] Heard: '{final_text}'", flush=True)
                    return (final_text, None)

        tail = _clean_vosk_text(rec.FinalResult(), "text")
        if tail and saw_partial:
            print(f"[Voice] Heard: '{tail}'", flush=True)
            return (tail, None)
        return ("", None)
    finally:
        stop_event.set()
        _terminate_stream(proc)
        if reader_thread is not None and reader_thread.is_alive():
            reader_thread.join(timeout=0.5)
        del rec
        gc.collect()


def send_mcu_command(cmd: str) -> None:
    """Sends a one-line status command to the STM32U585 MCU if serial port is set."""
    port = os.environ.get("UNOQ_MCU_SERIAL", "").strip()
    if not port:
        return
    try:
        import serial

        with serial.Serial(port, 115200, timeout=1, write_timeout=1) as ser:
            ser.write(f"{cmd}\n".encode("ascii"))
    except Exception:
        pass


def poll_mcu_button_event() -> str | None:
    """Reads a pending BTN_CRISIS or BTN_NOT_TODAY line from the STM32U585 MCU if present."""
    port = os.environ.get("UNOQ_MCU_SERIAL", "").strip()
    if not port:
        return None
    try:
        import serial

        with serial.Serial(port, 115200, timeout=0.05, write_timeout=1) as ser:
            while ser.in_waiting > 0:
                line = ser.readline().decode("ascii", errors="ignore").strip()
                if line in ("BTN_CRISIS", "BTN_NOT_TODAY"):
                    return line
    except Exception:
        pass
    return None


def post_checkin_result(payload: dict[str, Any]) -> dict[str, Any]:
    import requests

    base_url = os.environ.get("CEPHEUS_BASE_URL", "http://localhost:3000").rstrip("/")
    token = os.environ.get("ARDUINO_INGEST_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(
        f"{base_url}/api/arduino/check-in", json=payload, headers=headers, timeout=10
    )
    try:
        body = resp.json()
    except Exception:
        body = {}
    if isinstance(body, dict) and body.get("showCrisisPath"):
        return body
    resp.raise_for_status()
    return body if isinstance(body, dict) else {}


def trigger_crisis_response(route: AudioRoute | None = None) -> None:
    send_mcu_command("CRISIS")
    speak_text_on_device(CRISIS_SPOKEN_MESSAGE, route=route)


def _start_simultaneous_camera() -> ConcurrentEdgeCamera | None:
    enabled = os.environ.get(
        "RUN_CAMERA_DURING_VOICE",
        os.environ.get("RUN_CAMERA_AFTER_VOICE", "true"),
    ).lower()
    if enabled == "false":
        return None

    cfg = EdgeWindowConfig(
        duration_sec=float(os.environ.get("CAMERA_MAX_DURATION_SEC", "180")),
        min_duration_sec=1.5,
        camera_index=detect_default_camera_index(),
        face_landmarker_model=os.environ.get("MEDIAPIPE_FACE_MODEL", "face_landmarker.task"),
        width=int(os.environ.get("CAMERA_WIDTH", "640")),
        height=int(os.environ.get("CAMERA_HEIGHT", "480")),
        target_fps=int(os.environ.get("CAMERA_FPS", "8")),
        task_id="uno_q_voice_and_face_check",
    )
    worker = ConcurrentEdgeCamera(cfg)
    worker.start()
    return worker


def _finish_camera_and_ingest(camera: ConcurrentEdgeCamera | None) -> None:
    if camera is None:
        send_mcu_command("IDLE")
        return
    summary = camera.stop(abort=False)
    if camera.error is not None:
        print(
            f"[WARN] Simultaneous camera facial check unavailable: {camera.error}",
            file=sys.stderr,
        )
        send_mcu_command("IDLE")
        return
    if summary is None:
        send_mcu_command("IDLE")
        return

    ingest_resp = post_derived_metrics(summary)
    cue = ingest_resp.get("lightCue", {})
    send_mcu_command("LIGHT_ON" if cue.get("activateRingLightCue") else "IDLE")


def _ask_single_voice_question(
    prompt: str,
    vosk_model: Any | None,
    route: AudioRoute,
    listen_timeout_sec: float,
    allow_keyboard_fallback: bool,
) -> tuple[str, int | None]:
    mcu_btn = poll_mcu_button_event()
    if mcu_btn == "BTN_CRISIS":
        return ("crisis_help", None)
    if mcu_btn == "BTN_NOT_TODAY":
        return ("not_today", None)

    speak_text_on_device(prompt, route=route)
    for attempt in range(2):
        transcript, btn = listen_for_voice_transcript(
            vosk_model=vosk_model,
            route=route,
            timeout_sec=listen_timeout_sec,
            allow_keyboard_fallback=allow_keyboard_fallback,
        )
        if btn == "BTN_CRISIS":
            return ("crisis_help", None)
        if btn == "BTN_NOT_TODAY":
            return ("not_today", None)

        kind, val = parse_spoken_tap_choice(transcript)
        if kind != "unclear":
            return (kind, val)
        if attempt == 0:
            speak_text_on_device(
                "Please say a number from zero to four, say not today, or say help.",
                route=route,
            )
    return ("unclear", None)


def _prepare_vosk_model(allow_keyboard_fallback: bool) -> Any | None:
    try:
        return load_vosk_model()
    except Exception as exc:
        if allow_keyboard_fallback:
            print(f"[WARN] Vosk unavailable ({exc}); keyboard fallback active.", file=sys.stderr)
            return None
        raise RuntimeError(
            f"Could not initialize local Vosk speech recognition ({exc}). "
            "Run `pip install -r hardware/uno-q/requirements.txt` on the UNO Q."
        ) from exc


def _handle_crisis_abort(
    camera: ConcurrentEdgeCamera | None,
    route: AudioRoute,
    device_id: str,
    today: str,
    post_button: bool = True,
) -> None:
    if camera is not None:
        camera.stop(abort=True)
    trigger_crisis_response(route=route)
    if post_button:
        post_checkin_result(
            {
                "deviceId": device_id,
                "date": today,
                "timestampMs": int(time.time() * 1000),
                "nonce": secrets.token_hex(16),
                "kind": "crisis_button",
            }
        )


def _handle_not_today(
    camera: ConcurrentEdgeCamera | None,
    route: AudioRoute,
    device_id: str,
    today: str,
) -> None:
    resp = post_checkin_result(
        {
            "deviceId": device_id,
            "date": today,
            "timestampMs": int(time.time() * 1000),
            "nonce": secrets.token_hex(16),
            "kind": "not_today",
        }
    )
    if resp.get("showCrisisPath"):
        _handle_crisis_abort(camera, route, device_id, today, post_button=False)
        return
    speak_text_on_device("Okay, skipped for today with no penalty.", route=route)
    _finish_camera_and_ingest(camera)


def _submit_completed_taps(
    scores: dict[str, int],
    camera: ConcurrentEdgeCamera | None,
    route: AudioRoute,
    device_id: str,
    today: str,
) -> None:
    resp = post_checkin_result(
        {
            "deviceId": device_id,
            "date": today,
            "timestampMs": int(time.time() * 1000),
            "nonce": secrets.token_hex(16),
            "kind": "taps",
            "mood": scores["mood"],
            "interest": scores["interest"],
        }
    )
    if resp.get("showCrisisPath"):
        _handle_crisis_abort(camera, route, device_id, today, post_button=False)
        return
    speak_text_on_device("Thank you. Your check-in is saved.", route=route)
    _finish_camera_and_ingest(camera)


# Control-flow coordinator across Bluetooth TTS, live Vosk STT, and concurrent camera.
def run_simultaneous_bedside_cycle(
    route: AudioRoute | None = None,
    vosk_model: Any | None = None,
    listen_timeout_sec: float = 12.0,
    allow_keyboard_fallback: bool = False,
) -> None:
    """
    Runs spoken check-in over Bluetooth headphones (or active output) while
    simultaneously measuring facial expressivity & head movement on the USB camera.
    """
    active_route = route or detect_audio_route()
    label = active_route.bt_device_name if active_route.bt_connected else "local"
    print(
        f"[Audio] Route ({label}): out={active_route.output_sink}, mic={active_route.input_source}",
        flush=True,
    )

    active_vosk = (
        vosk_model
        if vosk_model is not None
        else _prepare_vosk_model(allow_keyboard_fallback)
    )
    device_id = os.environ.get("CEPHEUS_DEVICE_ID", "unoq-home-01")
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    send_mcu_command("ACTIVE")
    camera = _start_simultaneous_camera()

    try:
        speak_text_on_device(
            f"Wellbeing check-in. {CRISIS_SPOKEN_MESSAGE}", route=active_route
        )
        scores: dict[str, int] = {}
        for key, prompt in CHECKIN_QUESTIONS:
            kind, val = _ask_single_voice_question(
                prompt, active_vosk, active_route, listen_timeout_sec, allow_keyboard_fallback
            )
            if kind == "crisis_help":
                _handle_crisis_abort(camera, active_route, device_id, today)
                return
            if kind == "not_today":
                _handle_not_today(camera, active_route, device_id, today)
                return
            if kind != "score" or val is None:
                speak_text_on_device("No problem, moving on with no penalty.", route=active_route)
                _finish_camera_and_ingest(camera)
                return
            scores[key] = val

        _submit_completed_taps(scores, camera, active_route, device_id, today)
    except Exception:
        if camera is not None:
            camera.stop(abort=True)
        send_mcu_command("IDLE")
        raise


def run_sequential_bedside_cycle() -> None:
    """Backward-compatible entry point; now runs camera & voice simultaneously."""
    run_simultaneous_bedside_cycle()


def watch_bluetooth_and_run(
    listen_timeout_sec: float = 12.0,
    prefer_bt_mic: bool = False,
    allow_keyboard_fallback: bool = False,
) -> None:
    """
    Daemon loop: whenever Bluetooth headphones connect, automatically reads the
    check-in questions through them while running facial detection simultaneously.
    """
    ensure_headless_wireplumber_bluetooth()
    vosk_model = _prepare_vosk_model(allow_keyboard_fallback)
    warm_tts_prompts(ALL_FIXED_PROMPTS)
    print("[Bluetooth] Waiting for Bluetooth headphones to connect...", flush=True)
    was_connected = False

    while True:
        route = detect_audio_route(prefer_bt_mic=prefer_bt_mic)
        if route.bt_connected and not was_connected:
            ready_route = (
                route
                if route.bt_sink_ready
                else wait_for_bluetooth_headphones(
                    poll_interval_sec=0.5, timeout_sec=5.0, prefer_bt_mic=prefer_bt_mic
                )
            )
            if ready_route is None:
                time.sleep(2.0)
                continue

            run_simultaneous_bedside_cycle(
                route=ready_route,
                vosk_model=vosk_model,
                listen_timeout_sec=listen_timeout_sec,
                allow_keyboard_fallback=allow_keyboard_fallback,
            )
            was_connected = True
            print(
                "[Bluetooth] Session complete. Disconnect & reconnect headphones for next check-in.",
                flush=True,
            )
        elif not route.bt_connected and was_connected:
            was_connected = False
            print("[Bluetooth] Headphones disconnected. Ready for next connection.", flush=True)
        time.sleep(1.5)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cepheus UNO Q Bluetooth Headphone Voice + Simultaneous Camera Check-In"
    )
    parser.add_argument(
        "--watch-bluetooth",
        action="store_true",
        default=os.environ.get("WATCH_BLUETOOTH", "").lower() == "true",
        help="Continuously watch for Bluetooth headphones connecting and start check-in automatically.",
    )
    parser.add_argument(
        "--wait-for-bluetooth",
        action="store_true",
        default=os.environ.get("WAIT_FOR_BLUETOOTH", "").lower() == "true",
        help="Wait until Bluetooth headphones connect once, run the check-in through them, and exit.",
    )
    parser.add_argument(
        "--bluetooth-mic",
        action="store_true",
        default=os.environ.get("USE_BLUETOOTH_MIC", "").lower() == "true",
        help="Switch Bluetooth headphones to HFP/HSP headset profile to use their built-in mic.",
    )
    parser.add_argument(
        "--listen-timeout",
        type=float,
        default=float(os.environ.get("VOICE_LISTEN_TIMEOUT_SEC", "12")),
        help="Seconds to listen for each spoken answer (default: 12).",
    )
    parser.add_argument(
        "--keyboard-fallback",
        action="store_true",
        default=os.environ.get("ALLOW_KEYBOARD_FALLBACK", "").lower() == "true",
        help="Allow typing replies only when explicitly enabled for dry-run debugging.",
    )
    args = parser.parse_args()

    if args.watch_bluetooth:
        watch_bluetooth_and_run(
            listen_timeout_sec=args.listen_timeout,
            prefer_bt_mic=args.bluetooth_mic,
            allow_keyboard_fallback=args.keyboard_fallback,
        )
        return

    ensure_headless_wireplumber_bluetooth()
    warm_tts_prompts(ALL_FIXED_PROMPTS)
    if args.wait_for_bluetooth:
        print("[Bluetooth] Waiting for Bluetooth headphones to connect...", flush=True)
        route = wait_for_bluetooth_headphones(prefer_bt_mic=args.bluetooth_mic)
    else:
        route = detect_audio_route(prefer_bt_mic=args.bluetooth_mic)

    run_simultaneous_bedside_cycle(
        route=route,
        listen_timeout_sec=args.listen_timeout,
        allow_keyboard_fallback=args.keyboard_fallback,
    )


if __name__ == "__main__":
    main()
