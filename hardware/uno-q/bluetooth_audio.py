"""
Bluetooth headphone detection, routing, TTS playback, and live PCM mic capture
for the Arduino UNO Q bedside unit.

Keeps all audio strictly in RAM (zero .wav or raw PCM files written to disk).
Automatically routes spoken questions to connected Bluetooth headphones
(PipeWire / PulseAudio `bluez_output.*` or `bluez_sink.*`) and selects the
active Bluetooth headset mic or USB webcam mic for voice answers.
"""

from __future__ import annotations

import dataclasses
import os
import re
import shutil
import subprocess
import sys
import time


@dataclasses.dataclass(frozen=True)
class AudioRoute:
    bt_connected: bool
    bt_device_name: str | None
    output_backend: str
    output_sink: str | None
    input_backend: str
    input_source: str | None


AUDIO_UUID_PREFIXES = ("0000110b", "00001108", "0000111e", "0000110d")


def _run_cmd(args: list[str], timeout: float = 3.0) -> str:
    try:
        res = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return res.stdout if res.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def _parse_pactl_names(output: str) -> list[str]:
    names: list[str] = []
    for line in output.splitlines():
        parts = line.strip().split("\t")
        if len(parts) >= 2 and parts[1]:
            names.append(parts[1].strip())
    return names


def _detect_bluez_connected_name() -> str | None:
    if not shutil.which("bluetoothctl"):
        return None
    info = _run_cmd(["bluetoothctl", "info"])
    if "Connected: yes" in info and any(u in info.lower() for u in AUDIO_UUID_PREFIXES):
        match = re.search(r"^\s*Name:\s*(.+)$", info, flags=re.MULTILINE)
        return match.group(1).strip() if match else "Bluetooth Headphones"

    connected = _run_cmd(["bluetoothctl", "devices", "Connected"])
    for line in connected.splitlines():
        parts = line.strip().split(" ", 2)
        if len(parts) >= 3 and parts[0] == "Device":
            dev_info = _run_cmd(["bluetoothctl", "info", parts[1]])
            if "Connected: yes" in dev_info:
                return parts[2].strip()
    return None


def _ensure_bt_card_profile(
    cards: list[str],
    sinks: list[str],
    sources: list[str],
    prefer_bt_mic: bool,
) -> tuple[list[str], list[str]]:
    bt_cards = [c for c in cards if c.startswith("bluez_card.")]
    if not bt_cards:
        return sinks, sources

    has_bt_sink = any(s.startswith(("bluez_output.", "bluez_sink.")) for s in sinks)
    real_sources = [s for s in sources if not s.endswith(".monitor")]
    has_bt_mic = any(s.startswith(("bluez_input.", "bluez_source.")) for s in real_sources)
    need_bt_mic = (prefer_bt_mic or not real_sources) and not has_bt_mic

    if has_bt_sink and not need_bt_mic:
        return sinks, sources

    profiles = (
        ("headset-head-unit", "handsfree_head_unit", "a2dp-sink")
        if need_bt_mic
        else ("a2dp-sink", "headset-head-unit", "handsfree_head_unit")
    )
    for profile in profiles:
        _run_cmd(["pactl", "set-card-profile", bt_cards[0], profile])
        time.sleep(0.25)
        new_sinks = _parse_pactl_names(_run_cmd(["pactl", "list", "short", "sinks"]))
        new_sources = _parse_pactl_names(_run_cmd(["pactl", "list", "short", "sources"]))
        has_sink_now = any(s.startswith(("bluez_output.", "bluez_sink.")) for s in new_sinks)
        has_mic_now = any(
            s.startswith(("bluez_input.", "bluez_source.")) and not s.endswith(".monitor")
            for s in new_sources
        )
        if has_sink_now and (not need_bt_mic or has_mic_now):
            return new_sinks, new_sources
        if has_sink_now:
            sinks, sources = new_sinks, new_sources
    return sinks, sources


def _pick_pulse_sink(sinks: list[str], env_out: str) -> str | None:
    if env_out:
        return env_out
    for sink in sinks:
        if sink.startswith(("bluez_output.", "bluez_sink.")):
            _run_cmd(["pactl", "set-default-sink", sink])
            return sink
    return sinks[0] if sinks else None


def _pick_pulse_source(sources: list[str], env_in: str) -> str | None:
    if env_in:
        return env_in
    real = [s for s in sources if not s.endswith(".monitor")]
    for prefix in ("bluez_input.", "bluez_source.", "alsa_input.usb-"):
        for src in real:
            if src.startswith(prefix):
                return src
    return real[0] if real else None


def _detect_alsa_capture_device() -> str | None:
    if not shutil.which("arecord"):
        return None
    listing = _run_cmd(["arecord", "-l"])
    usb_match = re.search(
        r"card\s+(\d+):[^\n]*USB[^\n]*device\s+(\d+):", listing, flags=re.IGNORECASE
    )
    if usb_match:
        return f"plughw:{usb_match.group(1)},{usb_match.group(2)}"
    any_match = re.search(r"card\s+(\d+):[^\n]*device\s+(\d+):", listing)
    if any_match:
        return f"plughw:{any_match.group(1)},{any_match.group(2)}"
    return "default"


def detect_audio_route(prefer_bt_mic: bool = False) -> AudioRoute:
    """Detects connected Bluetooth headphones and picks output sink + mic source."""
    env_out = (
        os.environ.get("AUDIO_OUTPUT_DEVICE", "").strip()
        or os.environ.get("BLUETOOTH_SINK", "").strip()
    )
    env_in = os.environ.get("AUDIO_INPUT_DEVICE", "").strip()
    use_bt_mic = prefer_bt_mic or os.environ.get("USE_BLUETOOTH_MIC", "").lower() == "true"
    bt_name = _detect_bluez_connected_name()

    if shutil.which("pactl"):
        sinks = _parse_pactl_names(_run_cmd(["pactl", "list", "short", "sinks"]))
        sources = _parse_pactl_names(_run_cmd(["pactl", "list", "short", "sources"]))
        cards = _parse_pactl_names(_run_cmd(["pactl", "list", "short", "cards"]))
        sinks, sources = _ensure_bt_card_profile(cards, sinks, sources, use_bt_mic)
        out_sink = _pick_pulse_sink(sinks, env_out)
        in_src = _pick_pulse_source(sources, env_in)
        bt_active = bool(
            bt_name
            or (out_sink and out_sink.startswith(("bluez_output.", "bluez_sink.")))
        )
        return AudioRoute(
            bt_connected=bt_active,
            bt_device_name=bt_name or (out_sink if bt_active else None),
            output_backend="pulse",
            output_sink=out_sink,
            input_backend="pulse" if in_src or shutil.which("parec") else "alsa",
            input_source=in_src,
        )

    alsa_in = env_in or _detect_alsa_capture_device()
    return AudioRoute(
        bt_connected=bool(bt_name),
        bt_device_name=bt_name,
        output_backend="alsa" if shutil.which("aplay") else "none",
        output_sink=env_out or None,
        input_backend="alsa" if alsa_in else "none",
        input_source=alsa_in,
    )


def wait_for_bluetooth_headphones(
    poll_interval_sec: float = 1.5,
    timeout_sec: float | None = None,
    prefer_bt_mic: bool = False,
) -> AudioRoute | None:
    """Blocks until Bluetooth headphones connect and their audio sink is ready."""
    start = time.monotonic()
    while True:
        route = detect_audio_route(prefer_bt_mic=prefer_bt_mic)
        if route.bt_connected:
            if route.output_backend == "pulse" and not (
                route.output_sink
                and route.output_sink.startswith(("bluez_output.", "bluez_sink."))
            ):
                time.sleep(1.2)
                route = detect_audio_route(prefer_bt_mic=prefer_bt_mic)
            return route
        if timeout_sec is not None and (time.monotonic() - start) >= timeout_sec:
            return None
        time.sleep(poll_interval_sec)


def _build_pcm_player_cmd(
    route: AudioRoute, raw_22k: bool
) -> list[str] | None:
    paplay = shutil.which("paplay")
    if paplay and route.output_backend == "pulse":
        cmd = [paplay]
        if raw_22k:
            cmd.extend(["--raw", "--rate=22050", "--format=s16le", "--channels=1"])
        if route.output_sink:
            cmd.append(f"--device={route.output_sink}")
        return cmd

    pw_play = shutil.which("pw-play")
    if pw_play:
        cmd = [pw_play]
        if raw_22k:
            cmd.extend(["--rate=22050", "--format=s16", "--channels=1"])
        if route.output_sink:
            cmd.append(f"--target={route.output_sink}")
        cmd.append("-")
        return cmd

    aplay = shutil.which("aplay")
    if aplay:
        cmd = [aplay, "-q"]
        if route.output_sink and route.output_backend == "alsa":
            cmd.extend(["-D", route.output_sink])
        if raw_22k:
            cmd.extend(["-r", "22050", "-f", "S16_LE", "-c", "1", "-t", "raw"])
        cmd.append("-")
        return cmd
    return None


def _pipe_tts_to_player(tts_cmd: list[str], player_cmd: list[str], stdin_bytes: bytes | None) -> bool:
    p_tts = subprocess.Popen(
        tts_cmd,
        stdin=subprocess.PIPE if stdin_bytes is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    p_play = subprocess.Popen(
        player_cmd,
        stdin=p_tts.stdout,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if p_tts.stdout is not None:
        p_tts.stdout.close()
    if stdin_bytes is not None and p_tts.stdin is not None:
        p_tts.stdin.write(stdin_bytes)
        p_tts.stdin.close()
    p_tts.wait(timeout=25)
    p_play.wait(timeout=25)
    return p_play.returncode == 0


def speak_text_routed(text: str, route: AudioRoute | None = None) -> bool:
    """Speaks text through Bluetooth headphones (or active output sink)."""
    active_route = route or detect_audio_route()
    target_label = active_route.output_sink or active_route.output_backend
    print(f"[TTS -> {target_label}] {text}", flush=True)

    piper_bin = shutil.which("piper")
    piper_model = os.environ.get("PIPER_MODEL_PATH", "").strip()
    raw_player = _build_pcm_player_cmd(active_route, raw_22k=True)
    if piper_bin and piper_model and os.path.exists(piper_model) and raw_player:
        return _pipe_tts_to_player(
            [piper_bin, "--model", piper_model, "--output-raw"],
            raw_player,
            text.encode("utf-8"),
        )

    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    wav_player = _build_pcm_player_cmd(active_route, raw_22k=False)
    if espeak and wav_player:
        return _pipe_tts_to_player([espeak, "-s", "155", "--stdout", text], wav_player, None)

    if espeak:
        env = os.environ.copy()
        if active_route.output_sink and active_route.output_backend == "pulse":
            env["PULSE_SINK"] = active_route.output_sink
        res = subprocess.run([espeak, "-s", "155", text], env=env, check=False, timeout=25)
        return res.returncode == 0

    print(
        "[WARN] No local TTS binary found. Install `espeak-ng` and `pulseaudio-utils` "
        "(or set PIPER_MODEL_PATH with `piper`) so Bluetooth headphones speak prompts.",
        file=sys.stderr,
    )
    return False


def open_mic_pcm_stream(
    route: AudioRoute | None = None, sample_rate: int = 16000
) -> subprocess.Popen[bytes]:
    """Starts a live 16-bit mono PCM capture stream strictly in RAM."""
    active_route = route or detect_audio_route()
    parec = shutil.which("parec")
    if parec and active_route.input_backend == "pulse":
        cmd = [
            parec,
            "--raw",
            f"--rate={sample_rate}",
            "--format=s16le",
            "--channels=1",
            "--latency-msec=100",
        ]
        if active_route.input_source:
            cmd.append(f"--device={active_route.input_source}")
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    pw_rec = shutil.which("pw-record")
    if pw_rec and active_route.input_backend == "pulse":
        cmd = [pw_rec, f"--rate={sample_rate}", "--format=s16", "--channels=1"]
        if active_route.input_source:
            cmd.append(f"--target={active_route.input_source}")
        cmd.append("-")
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    arecord = shutil.which("arecord")
    if arecord:
        cmd = [arecord, "-q"]
        if active_route.input_source and active_route.input_backend == "alsa":
            cmd.extend(["-D", active_route.input_source])
        cmd.extend(["-f", "S16_LE", "-r", str(sample_rate), "-c", "1", "-t", "raw"])
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    raise RuntimeError(
        "No microphone capture binary found. Install `pulseaudio-utils` (parec) or `alsa-utils` (arecord)."
    )
