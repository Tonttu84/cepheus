"""
Bluetooth headphone detection, routing, in-RAM Piper TTS playback, and live PCM
mic capture for the Arduino UNO Q bedside unit.

Supports native PipeWire (`pw-dump`, `wpctl`, `pw-play`, `pw-record --raw`),
PulseAudio / pipewire-pulse (`pactl`, `paplay`, `parec`), and ALSA (`aplay`,
`arecord`). Keeps all audio strictly in RAM (zero .wav or raw PCM files written
to disk).
"""

from __future__ import annotations

import dataclasses
import glob
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import wave
from typing import Any


@dataclasses.dataclass(frozen=True)
class AudioRoute:
    bt_connected: bool
    bt_sink_ready: bool
    bt_device_name: str | None
    output_backend: str
    output_sink: str | None
    input_backend: str
    input_source: str | None


AUDIO_UUID_PREFIXES = ("0000110b", "00001108", "0000111e", "0000110d")
_PIPER_VOICE_INSTANCE: Any = None
_PIPER_VOICE_MODEL_LOADED: str | None = None
_WAV_CACHE: dict[str, bytes] = {}


def _audio_env() -> dict[str, str]:
    env = os.environ.copy()
    if "XDG_RUNTIME_DIR" not in env and hasattr(os, "getuid"):
        runtime_dir = f"/run/user/{os.getuid()}"
        if os.path.isdir(runtime_dir):
            env["XDG_RUNTIME_DIR"] = runtime_dir
    return env


def _run_cmd(args: list[str], timeout: float = 3.0) -> str:
    try:
        res = subprocess.run(
            args,
            capture_output=True,
            text=True,
            env=_audio_env(),
            timeout=timeout,
            check=False,
        )
        return res.stdout if res.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def ensure_headless_wireplumber_bluetooth() -> None:
    """Ensures WirePlumber allows Bluetooth audio over headless SSH sessions."""
    if not shutil.which("wireplumber"):
        return
    conf_dir = os.path.expanduser("~/.config/wireplumber/wireplumber.conf.d")
    conf_file = os.path.join(conf_dir, "51-bluez-headless.conf")
    if os.path.isfile(conf_file):
        return
    try:
        os.makedirs(conf_dir, exist_ok=True)
        with open(conf_file, "w", encoding="utf-8") as fh:
            fh.write(
                "wireplumber.profiles = {\n"
                "  main = {\n"
                "    monitor.bluez.seat-monitoring = disabled\n"
                "  }\n"
                "}\n"
            )
        _run_cmd(["systemctl", "--user", "restart", "wireplumber"], timeout=5.0)
        time.sleep(1.0)
    except OSError:
        pass


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


def _parse_pw_dump(
    raw_json: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    try:
        items = json.loads(raw_json)
    except Exception:
        return ([], [], [])
    if not isinstance(items, list):
        return ([], [], [])

    sinks: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []
    devices: list[dict[str, Any]] = []
    for obj in items:
        if not isinstance(obj, dict):
            continue
        info = obj.get("info")
        props = info.get("props", {}) if isinstance(info, dict) else {}
        media_class = str(props.get("media.class", ""))
        if media_class == "Audio/Sink":
            sinks.append(obj)
        elif media_class == "Audio/Source":
            sources.append(obj)
        elif media_class == "Audio/Device":
            devices.append(obj)
    return (sinks, sources, devices)


def _maybe_switch_pipewire_bt_profile(
    devices: list[dict[str, Any]],
    sinks: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    prefer_bt_mic: bool,
) -> bool:
    if not shutil.which("wpctl"):
        return False
    bt_devs = [
        d
        for d in devices
        if str(d.get("info", {}).get("props", {}).get("device.name", "")).startswith(
            "bluez_card."
        )
    ]
    if not bt_devs:
        return False

    sink_names = [str(s.get("info", {}).get("props", {}).get("node.name", "")) for s in sinks]
    src_names = [
        str(s.get("info", {}).get("props", {}).get("node.name", ""))
        for s in sources
        if not str(s.get("info", {}).get("props", {}).get("node.name", "")).endswith(".monitor")
    ]
    has_bt_sink = any(n.startswith(("bluez_output.", "bluez_sink.")) for n in sink_names)
    has_bt_mic = any(n.startswith(("bluez_input.", "bluez_source.")) for n in src_names)
    need_bt_mic = (prefer_bt_mic or not src_names) and not has_bt_mic
    if has_bt_sink and not need_bt_mic:
        return False

    dev = bt_devs[0]
    dev_id = dev.get("id")
    enum_profiles = dev.get("info", {}).get("params", {}).get("EnumProfile", [])
    wanted = ("headset-head-unit", "handsfree", "hfp", "hsp") if need_bt_mic else ("a2dp", "headset")
    for keyword in wanted:
        for prof in enum_profiles if isinstance(enum_profiles, list) else []:
            pname = str(prof.get("name", "")).lower()
            pidx = prof.get("index")
            if keyword in pname and pidx is not None and dev_id is not None:
                _run_cmd(["wpctl", "set-profile", str(dev_id), str(pidx)])
                time.sleep(0.35)
                return True
    return False


def _detect_pipewire_route(
    env_out: str, env_in: str, use_bt_mic: bool, bt_name: str | None
) -> AudioRoute:
    sinks, sources, devices = _parse_pw_dump(_run_cmd(["pw-dump"]))
    if _maybe_switch_pipewire_bt_profile(devices, sinks, sources, use_bt_mic):
        sinks, sources, _ = _parse_pw_dump(_run_cmd(["pw-dump"]))

    out_sink: str | None = env_out or None
    bt_desc: str | None = bt_name
    if not out_sink:
        for sink in sinks:
            props = sink.get("info", {}).get("props", {})
            name = str(props.get("node.name", ""))
            if name.startswith(("bluez_output.", "bluez_sink.")):
                out_sink = name
                bt_desc = bt_desc or str(props.get("node.description", "")) or name
                if shutil.which("wpctl") and sink.get("id") is not None:
                    _run_cmd(["wpctl", "set-default", str(sink["id"])])
                break
    if not out_sink and sinks:
        out_sink = str(sinks[0].get("info", {}).get("props", {}).get("node.name", "")) or None

    real_sources = [
        str(s.get("info", {}).get("props", {}).get("node.name", ""))
        for s in sources
        if not str(s.get("info", {}).get("props", {}).get("node.name", "")).endswith(".monitor")
    ]
    in_src = _pick_source_by_priority(real_sources, env_in)
    bt_sink_ok = bool(out_sink and out_sink.startswith(("bluez_output.", "bluez_sink.")))
    bt_active = bool(bt_desc or bt_sink_ok)
    return AudioRoute(
        bt_connected=bt_active,
        bt_sink_ready=bt_sink_ok,
        bt_device_name=bt_desc,
        output_backend="pipewire",
        output_sink=out_sink,
        input_backend="pipewire",
        input_source=in_src,
    )


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


def _pick_source_by_priority(real_sources: list[str], env_in: str) -> str | None:
    if env_in:
        return env_in
    for prefix in ("bluez_input.", "bluez_source.", "alsa_input.usb-"):
        for src in real_sources:
            if src.startswith(prefix):
                return src
    return real_sources[0] if real_sources else None


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
        real_sources = [s for s in sources if not s.endswith(".monitor")]
        in_src = _pick_source_by_priority(real_sources, env_in)
        bt_sink_ok = bool(out_sink and out_sink.startswith(("bluez_output.", "bluez_sink.")))
        bt_active = bool(bt_name or bt_sink_ok)
        return AudioRoute(
            bt_connected=bt_active,
            bt_sink_ready=bt_sink_ok,
            bt_device_name=bt_name or (out_sink if bt_active else None),
            output_backend="pulse",
            output_sink=out_sink,
            input_backend="pulse" if in_src or shutil.which("parec") else "alsa",
            input_source=in_src,
        )

    if shutil.which("pw-dump") and shutil.which("pw-play"):
        return _detect_pipewire_route(env_out, env_in, use_bt_mic, bt_name)

    alsa_in = env_in or _detect_alsa_capture_device()
    return AudioRoute(
        bt_connected=bool(bt_name),
        bt_sink_ready=bool(env_out),
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
    """Blocks until Bluetooth headphones connect and their PipeWire/PulseAudio sink binds."""
    start = time.monotonic()
    warned_hijack = False
    while True:
        route = detect_audio_route(prefer_bt_mic=prefer_bt_mic)
        if route.bt_connected and (route.bt_sink_ready or route.output_backend == "alsa"):
            return route
        if route.bt_connected and not route.bt_sink_ready and not warned_hijack:
            time.sleep(1.5)
            route = detect_audio_route(prefer_bt_mic=prefer_bt_mic)
            if route.bt_sink_ready:
                return route
            warned_hijack = True
            print(
                f"[WARN] '{route.bt_device_name}' is connected via Bluetooth, "
                "but no PipeWire/PulseAudio Bluetooth sink appeared. "
                "If a display-manager greeter (lightdm/gdm) is holding Bluetooth audio, run:\n"
                "  sudo systemctl disable --now lightdm && systemctl --user restart wireplumber\n"
                "  bluetoothctl disconnect && sleep 1 && bluetoothctl connect <MAC>",
                file=sys.stderr,
                flush=True,
            )
        if timeout_sec is not None and (time.monotonic() - start) >= timeout_sec:
            return None
        time.sleep(poll_interval_sec)


def _find_piper_model_path() -> str | None:
    here = os.path.dirname(__file__)
    local_onnx = sorted(glob.glob(os.path.join(here, "*.onnx")))
    cached_onnx = sorted(glob.glob(os.path.expanduser("~/.cache/piper/*.onnx")))
    candidates = [
        os.environ.get("PIPER_MODEL_PATH", "").strip(),
        *local_onnx,
        *cached_onnx,
    ]
    return next((p for p in candidates if p and os.path.isfile(p)), None)


def _find_piper_binary_and_model() -> tuple[str | None, str | None]:
    venv_piper = os.path.join(os.path.dirname(sys.executable), "piper")
    piper_bin = venv_piper if os.path.isfile(venv_piper) else shutil.which("piper")
    return piper_bin, _find_piper_model_path()


def _synthesize_piper_wav_in_ram(text: str, model_path: str) -> bytes | None:
    global _PIPER_VOICE_INSTANCE, _PIPER_VOICE_MODEL_LOADED
    cached = _WAV_CACHE.get(text)
    if cached is not None:
        return cached
    try:
        from piper.voice import PiperVoice

        if _PIPER_VOICE_INSTANCE is None or _PIPER_VOICE_MODEL_LOADED != model_path:
            _PIPER_VOICE_INSTANCE = PiperVoice.load(model_path)
            _PIPER_VOICE_MODEL_LOADED = model_path
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            _PIPER_VOICE_INSTANCE.synthesize_wav(text, wf)
        wav_bytes = buf.getvalue()
        if len(_WAV_CACHE) < 32:
            _WAV_CACHE[text] = wav_bytes
        return wav_bytes
    except Exception:
        return None


def warm_tts_prompts(prompts: list[str]) -> None:
    """Pre-loads Piper voice and caches fixed check-in WAV buffers in RAM (<1.5 MB)."""
    model_path = _find_piper_model_path()
    if not model_path:
        return
    print("[TTS] Pre-warming local Piper voice in RAM...", flush=True)
    for text in prompts:
        _synthesize_piper_wav_in_ram(text, model_path)


def _build_wav_player_cmd(route: AudioRoute) -> list[str] | None:
    paplay = shutil.which("paplay")
    if paplay and route.output_backend == "pulse":
        cmd = [paplay]
        if route.output_sink:
            cmd.append(f"--device={route.output_sink}")
        return cmd

    pw_play = shutil.which("pw-play")
    if pw_play:
        cmd = [pw_play]
        if route.output_sink and route.output_backend in ("pipewire", "pulse"):
            cmd.append(f"--target={route.output_sink}")
        cmd.append("-")
        return cmd

    aplay = shutil.which("aplay")
    if aplay:
        cmd = [aplay, "-q"]
        if route.output_sink and route.output_backend == "alsa":
            cmd.extend(["-D", route.output_sink])
        cmd.append("-")
        return cmd
    return None


def _play_wav_bytes(wav_bytes: bytes, player_cmd: list[str]) -> bool:
    approx_sec = max(1.0, len(wav_bytes) / 32000.0)
    proc = subprocess.Popen(
        player_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=_audio_env(),
    )
    try:
        proc.communicate(input=wav_bytes, timeout=max(12.0, approx_sec + 8.0))
        return proc.returncode == 0
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=2.0)
        print(
            f"[WARN] Audio playback timed out on {player_cmd}; check active sink.",
            file=sys.stderr,
        )
        return False


def _pipe_tts_to_player(
    tts_cmd: list[str], player_cmd: list[str], stdin_bytes: bytes | None
) -> bool:
    env = _audio_env()
    p_tts = subprocess.Popen(
        tts_cmd,
        stdin=subprocess.PIPE if stdin_bytes is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=env,
    )
    wav_bytes, _ = p_tts.communicate(input=stdin_bytes, timeout=25)
    if p_tts.returncode != 0 or not wav_bytes:
        return False
    return _play_wav_bytes(wav_bytes, player_cmd)


def speak_text_routed(text: str, route: AudioRoute | None = None) -> bool:
    """Speaks text through Bluetooth headphones (or active output sink)."""
    active_route = route or detect_audio_route()
    target_label = active_route.output_sink or active_route.output_backend
    print(f"[TTS -> {target_label}] {text}", flush=True)

    wav_player = _build_wav_player_cmd(active_route)
    _, piper_model = _find_piper_binary_and_model()
    if piper_model and wav_player:
        wav_bytes = _synthesize_piper_wav_in_ram(text, piper_model)
        if wav_bytes:
            return _play_wav_bytes(wav_bytes, wav_player)

    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak and wav_player:
        return _pipe_tts_to_player([espeak, "-s", "155", "--stdout", text], wav_player, None)

    if espeak:
        env = _audio_env()
        if active_route.output_sink and active_route.output_backend == "pulse":
            env["PULSE_SINK"] = active_route.output_sink
        res = subprocess.run([espeak, "-s", "155", text], env=env, check=False, timeout=25)
        return res.returncode == 0

    print(
        "[WARN] No local TTS engine found. Install `piper-tts` (`pip install piper-tts`) "
        "or `espeak-ng` so Bluetooth headphones can speak prompts.",
        file=sys.stderr,
    )
    return False


def open_mic_pcm_stream(
    route: AudioRoute | None = None, sample_rate: int = 16000
) -> subprocess.Popen[bytes]:
    """Starts a live 16-bit mono PCM capture stream strictly in RAM."""
    active_route = route or detect_audio_route()
    env = _audio_env()

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
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)

    pw_rec = shutil.which("pw-record")
    if pw_rec and active_route.input_backend in ("pipewire", "pulse"):
        cmd = [
            pw_rec,
            "--raw",
            f"--rate={sample_rate}",
            "--format=s16",
            "--channels=1",
        ]
        if active_route.input_source:
            cmd.append(f"--target={active_route.input_source}")
        cmd.append("-")
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)

    arecord = shutil.which("arecord")
    if arecord:
        cmd = [arecord, "-q"]
        if active_route.input_source and active_route.input_backend == "alsa":
            cmd.extend(["-D", active_route.input_source])
        cmd.extend(["-f", "S16_LE", "-r", str(sample_rate), "-c", "1", "-t", "raw"])
        return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)

    raise RuntimeError(
        "No microphone capture binary found (`pw-record`, `parec`, or `arecord`)."
    )
