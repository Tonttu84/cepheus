"""
Cepheus — Arduino UNO Q (2 GB RAM) Sequential Bedside Voice + Camera Kiosk (Trail #24)

Runs sequentially so Piper TTS, Vosk/Whisper STT, and Python MediaPipe never
stay resident in the 2 GB RAM simultaneously:
  1. Speak exact check-in wording via Piper TTS (or espeak-ng fallback) -> exit TTS
  2. Capture 4s mic audio strictly in RAM (zero .wav files written), transcribe
     with local Vosk or whisper.cpp -> map strictly to 0..4 / not_today / crisis_help
     -> zero buffer & unload STT model
  3. Post derived numeric check-in to POST /api/arduino/check-in
  4. Run sequential 640x480 @ 10fps camera check via edge_monitor.py -> post
     derived movement/daylight numbers to POST /api/arduino/ingest
  5. Forward LED / light-cue / crisis status to STM32U585 MCU over serial if attached.

Never infers mood from voice prosody or sends raw audio/video off the device.
"""

from __future__ import annotations

import datetime as dt
import gc
import os
import re
import secrets
import shutil
import subprocess
import time
from typing import Any

import requests

from edge_monitor import post_derived_metrics, run_edge_window

CRISIS_SPOKEN_MESSAGE = (
    "If you need someone right now: call emergency 112, "
    "or call the MIELI Crisis Helpline 24/7 at 09 2525 0111, "
    "or the TMS Clinic Nurse Line at 09 471 71200."
)

CRISIS_PHRASES = (
    "help",
    "crisis",
    "emergency",
    "112",
    "hurt myself",
    "end my life",
    "call nurse",
    "nurse",
)
NOT_TODAY_PHRASES = ("not today", "skip", "skip today", "pass", "later", "no thanks")
NUMBER_WORDS = {"0": 0, "zero": 0, "1": 1, "one": 1, "2": 2, "two": 2, "3": 3, "three": 3, "4": 4, "four": 4}
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


def parse_spoken_tap_choice(transcript: str) -> tuple[str, int | None]:
    """Deterministic mirror of src/domain/arduino/voice.ts parseSpokenChoice(..., 'tap')."""
    norm = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", transcript.lower())).strip()
    if not norm:
        return ("unclear", None)
    for phrase in CRISIS_PHRASES:
        if phrase in norm:
            return ("crisis_help", None)
    for phrase in NOT_TODAY_PHRASES:
        if phrase in norm:
            return ("not_today", None)
    for phrase, score in TAP_LABELS:
        if phrase in norm:
            return ("score", score)
    for tok in norm.split(" "):
        if tok in NUMBER_WORDS:
            return ("score", NUMBER_WORDS[tok])
    return ("unclear", None)


def speak_text_on_device(text: str) -> None:
    """Uses local Piper TTS binary if configured, else espeak-ng, else prints to console."""
    piper_bin = shutil.which("piper")
    piper_model = os.environ.get("PIPER_MODEL_PATH", "")
    aplay_bin = shutil.which("aplay")

    if piper_bin and piper_model and os.path.exists(piper_model) and aplay_bin:
        p1 = subprocess.Popen(
            [piper_bin, "--model", piper_model, "--output-raw"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )
        p2 = subprocess.Popen(
            [aplay_bin, "-r", "22050", "-f", "S16_LE", "-t", "raw", "-"],
            stdin=p1.stdout,
        )
        assert p1.stdin is not None
        p1.stdin.write(text.encode("utf-8"))
        p1.stdin.close()
        p1.wait(timeout=20)
        p2.wait(timeout=20)
        return

    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak:
        subprocess.run([espeak, text], check=False, timeout=20)
        return

    print(f"[TTS] {text}")


def capture_and_transcribe_once_in_ram(seconds: int = 4) -> str:
    """
    Captures raw PCM 16 kHz mono audio strictly in RAM (never writes to disk),
    transcribes using local Vosk if available, then zeroes and frees the buffer.
    """
    arecord = shutil.which("arecord")
    vosk_model_path = os.environ.get("VOSK_MODEL_PATH", "")
    if not arecord or not vosk_model_path or not os.path.exists(vosk_model_path):
        # Interactive console fallback for dry-run / testing without mic hardware
        return input("[Mic dry-run — type spoken reply (0-4 / not today / help)]: ")

    import json
    from vosk import KaldiRecognizer, Model

    proc = subprocess.run(
        [arecord, "-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "raw", "-d", str(seconds)],
        capture_output=True,
        timeout=seconds + 5,
        check=False,
    )
    audio_buf = bytearray(proc.stdout)
    model = Model(vosk_model_path)
    rec = KaldiRecognizer(model, 16000)
    rec.AcceptWaveform(bytes(audio_buf))
    res = json.loads(rec.FinalResult())
    transcript = str(res.get("text", ""))

    # Zero audio buffer in RAM and unload model before next step
    for i in range(len(audio_buf)):
        audio_buf[i] = 0
    del audio_buf, rec, model
    gc.collect()
    return transcript


def send_mcu_command(cmd: str) -> None:
    """Sends a one-line status command to the STM32U585 MCU if serial port is set."""
    port = os.environ.get("UNOQ_MCU_SERIAL", "").strip()
    if not port:
        return
    try:
        import serial  # optional pyserial

        with serial.Serial(port, 115200, timeout=1) as ser:
            ser.write(f"{cmd}\n".encode("ascii"))
    except Exception:
        pass


def post_checkin_result(payload: dict[str, Any]) -> dict[str, Any]:
    base_url = os.environ.get("CEPHEUS_BASE_URL", "http://localhost:3000").rstrip("/")
    token = os.environ.get("ARDUINO_INGEST_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(f"{base_url}/api/arduino/check-in", json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


def run_sequential_bedside_cycle() -> None:
    device_id = os.environ.get("CEPHEUS_DEVICE_ID", "unoq-home-01")
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    send_mcu_command("ACTIVE")

    questions = [
        ("mood", "How is your mood right now? Say zero for very low up to four for very good, or say not today."),
        ("interest", "How much do you feel like doing things right now? Say zero for not at all up to four for very much, or say not today."),
    ]
    scores: dict[str, int] = {}

    for key, prompt in questions:
        speak_text_on_device(prompt)
        transcript = capture_and_transcribe_once_in_ram(seconds=4)
        kind, val = parse_spoken_tap_choice(transcript)

        if kind == "crisis_help":
            send_mcu_command("CRISIS")
            speak_text_on_device(CRISIS_SPOKEN_MESSAGE)
            post_checkin_result({
                "deviceId": device_id,
                "date": today,
                "timestampMs": int(time.time() * 1000),
                "nonce": secrets.token_hex(16),
                "kind": "crisis_button",
            })
            return

        if kind == "not_today":
            post_checkin_result({
                "deviceId": device_id,
                "date": today,
                "timestampMs": int(time.time() * 1000),
                "nonce": secrets.token_hex(16),
                "kind": "not_today",
            })
            speak_text_on_device("Okay, skipped for today with no penalty.")
            send_mcu_command("IDLE")
            return

        if kind == "score" and val is not None:
            scores[key] = val
        else:
            speak_text_on_device("Sorry, I did not catch that. Moving on with no penalty.")
            send_mcu_command("IDLE")
            return

    post_checkin_result({
        "deviceId": device_id,
        "date": today,
        "timestampMs": int(time.time() * 1000),
        "nonce": secrets.token_hex(16),
        "kind": "taps",
        "mood": scores["mood"],
        "interest": scores["interest"],
    })
    speak_text_on_device("Thank you. Your check-in is saved.")

    # Step 4: Run camera/immobility check sequentially only after voice models are freed
    if os.environ.get("RUN_CAMERA_AFTER_VOICE", "true").lower() == "true":
        model_path = os.environ.get("MEDIAPIPE_FACE_MODEL", "face_landmarker.task")
        cam_idx = int(os.environ.get("CAMERA_INDEX", "0"))
        summary = run_edge_window(
            duration_sec=15,
            camera_index=cam_idx,
            face_landmarker_model=model_path,
            width=640,
            height=480,
            target_fps=10,
        )
        ingest_resp = post_derived_metrics(summary)
        cue = ingest_resp.get("lightCue", {})
        send_mcu_command("LIGHT_ON" if cue.get("activateRingLightCue") else "IDLE")
    else:
        send_mcu_command("IDLE")


if __name__ == "__main__":
    run_sequential_bedside_cycle()
