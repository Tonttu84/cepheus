"""Unit tests for Bluetooth headphone routing, streaming voice detection, and simultaneous camera."""

from __future__ import annotations

import io
import json
import os
import sys
import threading
import time
import types
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import bluetooth_audio  # noqa: E402
import edge_monitor  # noqa: E402
import voice_kiosk  # noqa: E402


class _FakeMicProc:
    def __init__(self, chunks: list[bytes]) -> None:
        self.stdout = io.BytesIO(b"".join(chunks))
        self.terminated = False

    def terminate(self) -> None:
        self.terminated = True

    def wait(self, timeout: float | None = None) -> int:
        return 0

    def kill(self) -> None:
        self.terminated = True


class _FakeRecognizer:
    def __init__(self, scripted_steps: list[tuple[bool, str]]) -> None:
        self._steps = list(scripted_steps)
        self._current_text = ""

    def AcceptWaveform(self, data: bytes) -> bool:
        if not self._steps:
            return False
        accepted, text = self._steps.pop(0)
        self._current_text = text
        return accepted

    def Result(self) -> str:
        return json.dumps({"text": self._current_text})

    def PartialResult(self) -> str:
        return json.dumps({"partial": self._current_text})

    def FinalResult(self) -> str:
        return json.dumps({"text": self._current_text})


class BluetoothAndSimultaneousVoiceCameraTests(unittest.TestCase):
    def test_detects_bluetooth_headphones_and_ignores_monitor_sources(self) -> None:
        def fake_which(cmd: str) -> str | None:
            return f"/usr/bin/{cmd}" if cmd in ("bluetoothctl", "pactl", "parec") else None

        def fake_run_cmd(args: list[str], timeout: float = 3.0) -> str:
            joined = " ".join(args)
            if joined == "bluetoothctl info":
                return (
                    "Device AA:BB:CC:DD:EE:FF\n"
                    "\tName: Sony WH-1000XM5\n"
                    "\tConnected: yes\n"
                    "\tUUID: Audio Sink (0000110b-0000-1000-8000-00805f9b34fb)\n"
                )
            if joined == "pactl list short sinks":
                return (
                    "1\talsa_output.platform-sound.stereo-fallback\tPipeWire\n"
                    "2\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\n"
                )
            if joined == "pactl list short sources":
                return (
                    "1\tbluez_output.AA_BB_CC_DD_EE_FF.1.monitor\tPipeWire\n"
                    "2\talsa_input.usb-Webcam_Mic-02.mono-fallback\tPipeWire\n"
                )
            if joined == "pactl list short cards":
                return "9\tbluez_card.AA_BB_CC_DD_EE_FF\tmodule-bluez5-device.c\n"
            return ""

        with (
            mock.patch.object(bluetooth_audio.shutil, "which", side_effect=fake_which),
            mock.patch.object(bluetooth_audio, "_run_cmd", side_effect=fake_run_cmd),
        ):
            route = bluetooth_audio.detect_audio_route()

        self.assertTrue(route.bt_connected)
        self.assertEqual(route.bt_device_name, "Sony WH-1000XM5")
        self.assertEqual(route.output_sink, "bluez_output.AA_BB_CC_DD_EE_FF.1")
        self.assertEqual(route.input_source, "alsa_input.usb-Webcam_Mic-02.mono-fallback")

    def test_switches_bluetooth_card_to_headset_mic_when_no_usb_mic_exists(self) -> None:
        profile_switched = {"done": False}

        def fake_which(cmd: str) -> str | None:
            return f"/usr/bin/{cmd}" if cmd in ("pactl", "parec") else None

        def fake_run_cmd(args: list[str], timeout: float = 3.0) -> str:
            joined = " ".join(args)
            if joined.startswith("pactl set-card-profile bluez_card.AA_BB headset-head-unit"):
                profile_switched["done"] = True
                return ""
            if joined == "pactl list short sinks":
                return "2\tbluez_output.AA_BB.1\tPipeWire\n"
            if joined == "pactl list short sources":
                if profile_switched["done"]:
                    return (
                        "1\tbluez_output.AA_BB.1.monitor\tPipeWire\n"
                        "3\tbluez_input.AA_BB.0\tPipeWire\n"
                    )
                return "1\tbluez_output.AA_BB.1.monitor\tPipeWire\n"
            if joined == "pactl list short cards":
                return "9\tbluez_card.AA_BB\tPipeWire\n"
            return ""

        with (
            mock.patch.object(bluetooth_audio.shutil, "which", side_effect=fake_which),
            mock.patch.object(bluetooth_audio, "_run_cmd", side_effect=fake_run_cmd),
            mock.patch.object(bluetooth_audio.time, "sleep"),
        ):
            route = bluetooth_audio.detect_audio_route()

        self.assertTrue(profile_switched["done"])
        self.assertEqual(route.input_source, "bluez_input.AA_BB.0")

    def test_routes_espeak_wav_directly_to_bluetooth_sink(self) -> None:
        route = bluetooth_audio.AudioRoute(
            bt_connected=True,
            bt_device_name="BT Headset",
            output_backend="pulse",
            output_sink="bluez_output.11_22_33_44_55_66.1",
            input_backend="pulse",
            input_source="bluez_input.11_22_33_44_55_66.0",
        )

        def fake_which(cmd: str) -> str | None:
            return f"/usr/bin/{cmd}" if cmd in ("espeak-ng", "paplay") else None

        with (
            mock.patch.object(bluetooth_audio.shutil, "which", side_effect=fake_which),
            mock.patch.object(
                bluetooth_audio, "_find_piper_binary_and_model", return_value=(None, None)
            ),
            mock.patch.object(bluetooth_audio, "_pipe_tts_to_player", return_value=True) as mock_pipe,
        ):
            ok = bluetooth_audio.speak_text_routed("How is your mood?", route=route)

        self.assertTrue(ok)
        tts_cmd, player_cmd, _ = mock_pipe.call_args[0]
        self.assertEqual(tts_cmd[:3], ["/usr/bin/espeak-ng", "-s", "155"])
        self.assertIn("--device=bluez_output.11_22_33_44_55_66.1", player_cmd)

    def test_native_pipewire_pw_dump_and_raw_pw_record(self) -> None:
        pw_json = json.dumps(
            [
                {
                    "id": 50,
                    "info": {
                        "props": {
                            "media.class": "Audio/Source",
                            "node.name": "alsa_input.usb-Web_Camera.analog-stereo",
                        }
                    },
                },
                {
                    "id": 77,
                    "info": {
                        "props": {
                            "media.class": "Audio/Sink",
                            "node.name": "bluez_output.AA_BB_CC.1",
                            "node.description": "Bose QC",
                        }
                    },
                },
            ]
        )

        def fake_which(cmd: str) -> str | None:
            return f"/usr/bin/{cmd}" if cmd in ("pw-dump", "pw-play", "pw-record", "wpctl") else None

        def fake_run_cmd(args: list[str], timeout: float = 3.0) -> str:
            return pw_json if args == ["pw-dump"] else ""

        with (
            mock.patch.object(bluetooth_audio.shutil, "which", side_effect=fake_which),
            mock.patch.object(bluetooth_audio, "_run_cmd", side_effect=fake_run_cmd),
        ):
            route = bluetooth_audio.detect_audio_route()
            with mock.patch.object(bluetooth_audio.subprocess, "Popen") as mock_popen:
                bluetooth_audio.open_mic_pcm_stream(route=route, sample_rate=16000)

        self.assertTrue(route.bt_connected)
        self.assertEqual(route.bt_device_name, "Bose QC")
        self.assertEqual(route.output_backend, "pipewire")
        self.assertEqual(route.output_sink, "bluez_output.AA_BB_CC.1")
        self.assertEqual(route.input_source, "alsa_input.usb-Web_Camera.analog-stereo")
        rec_cmd = mock_popen.call_args[0][0]
        self.assertIn("--raw", rec_cmd)
        self.assertIn("--target=alsa_input.usb-Web_Camera.analog-stereo", rec_cmd)

    def test_streams_voice_answer_without_keyboard_and_ignores_unk_noise(self) -> None:
        fake_vosk_mod = types.ModuleType("vosk")
        fake_rec = _FakeRecognizer(
            [
                (True, "[unk]"),
                (False, "very"),
                (True, "very good"),
            ]
        )
        fake_vosk_mod.KaldiRecognizer = mock.Mock(return_value=fake_rec)  # type: ignore[attr-defined]
        pcm_chunks = [b"\x10\x00" * 1600 for _ in range(3)]
        fake_proc = _FakeMicProc(pcm_chunks)

        with (
            mock.patch.dict(sys.modules, {"vosk": fake_vosk_mod}),
            mock.patch.object(voice_kiosk, "open_mic_pcm_stream", return_value=fake_proc),
            mock.patch.object(voice_kiosk, "poll_mcu_button_event", return_value=None),
        ):
            transcript, btn = voice_kiosk.listen_for_voice_transcript(
                vosk_model=object(),
                route=None,
                timeout_sec=5.0,
                allow_keyboard_fallback=False,
            )

        self.assertIsNone(btn)
        self.assertEqual(transcript, "very good")
        self.assertTrue(fake_proc.terminated)
        self.assertEqual(voice_kiosk.parse_spoken_tap_choice(transcript), ("score", 4))

    def test_does_not_prompt_keyboard_when_vosk_missing_unless_explicitly_allowed(self) -> None:
        with self.assertRaises(RuntimeError):
            voice_kiosk.listen_for_voice_transcript(
                vosk_model=None, allow_keyboard_fallback=False
            )

    def test_runs_camera_facial_detection_simultaneously_during_voice_questions(self) -> None:
        events: list[str] = []
        camera_running = threading.Event()

        class FakeCameraWorker:
            error = None

            def __init__(self, cfg: object) -> None:
                self.cfg = cfg

            def start(self) -> None:
                events.append("camera_start")
                camera_running.set()

            def stop(self, abort: bool = False) -> dict[str, object] | None:
                events.append(f"camera_stop(abort={abort})")
                camera_running.clear()
                return {
                    "deviceId": "unoq-home-01",
                    "date": "2026-11-14",
                    "routine": {
                        "sensorActive": True,
                        "stationaryMinutes": 0.4,
                        "longestBoutMinutes": 0.4,
                        "prolongedBoutCount": 0,
                        "ambientLuxMean": 140.0,
                    },
                    "camera": {
                        "taskId": "uno_q_voice_and_face_check",
                        "durationSec": 18.5,
                        "effectiveFps": 8.0,
                        "faceDetectedRatio": 0.94,
                        "expressivityScore": 0.082,
                        "smileFraction": 0.12,
                        "yawSdDeg": 2.7,
                        "pitchSdDeg": 1.9,
                        "angularPathDegPerMin": 112.4,
                    },
                }

        replies = iter([("three", None), ("quite a bit", None)])

        def fake_listen(*args: object, **kwargs: object) -> tuple[str, str | None]:
            # Prove camera thread is actively running while voice answers are captured!
            self.assertTrue(camera_running.is_set())
            events.append("voice_listen")
            return next(replies)

        def fake_speak(text: str, route: object = None) -> None:
            if "How is your mood" in text or "How much do you feel" in text:
                self.assertTrue(camera_running.is_set())
                events.append("tts_question")

        bt_route = bluetooth_audio.AudioRoute(
            bt_connected=True,
            bt_device_name="AirPods",
            output_backend="pulse",
            output_sink="bluez_output.AA_BB.1",
            input_backend="pulse",
            input_source="bluez_input.AA_BB.0",
        )

        with (
            mock.patch.object(voice_kiosk, "ConcurrentEdgeCamera", FakeCameraWorker),
            mock.patch.object(voice_kiosk, "speak_text_on_device", side_effect=fake_speak),
            mock.patch.object(voice_kiosk, "listen_for_voice_transcript", side_effect=fake_listen),
            mock.patch.object(voice_kiosk, "post_checkin_result", return_value={"ok": True}) as mock_checkin,
            mock.patch.object(
                voice_kiosk,
                "post_derived_metrics",
                return_value={"ok": True, "lightCue": {"activateRingLightCue": False}},
            ) as mock_ingest,
            mock.patch.object(voice_kiosk, "poll_mcu_button_event", return_value=None),
            mock.patch.object(voice_kiosk, "send_mcu_command"),
        ):
            voice_kiosk.run_simultaneous_bedside_cycle(
                route=bt_route, vosk_model=object()
            )

        self.assertEqual(
            events,
            [
                "camera_start",
                "tts_question",
                "voice_listen",
                "tts_question",
                "voice_listen",
                "camera_stop(abort=False)",
            ],
        )
        checkin_payload = mock_checkin.call_args[0][0]
        self.assertEqual(checkin_payload["kind"], "taps")
        self.assertEqual(checkin_payload["mood"], 3)
        self.assertEqual(checkin_payload["interest"], 3)
        ingest_payload = mock_ingest.call_args[0][0]
        self.assertEqual(ingest_payload["camera"]["taskId"], "uno_q_voice_and_face_check")

    def test_crisis_voice_phrase_aborts_camera_immediately_without_waiting(self) -> None:
        aborted = {"called": False}

        class FakeCameraWorker:
            error = None

            def start(self) -> None:
                pass

            def stop(self, abort: bool = False) -> None:
                aborted["called"] = abort
                return None

        bt_route = bluetooth_audio.AudioRoute(
            bt_connected=True,
            bt_device_name="Headphones",
            output_backend="pulse",
            output_sink="bluez_output.AA_BB.1",
            input_backend="pulse",
            input_source="bluez_input.AA_BB.0",
        )
        spoken: list[str] = []

        with (
            mock.patch.object(voice_kiosk, "_start_simultaneous_camera", return_value=FakeCameraWorker()),
            mock.patch.object(
                voice_kiosk,
                "speak_text_on_device",
                side_effect=lambda txt, route=None: spoken.append(txt),
            ),
            mock.patch.object(
                voice_kiosk,
                "listen_for_voice_transcript",
                return_value=("call one one two", None),
            ),
            mock.patch.object(voice_kiosk, "post_checkin_result", return_value={"ok": True}) as mock_checkin,
            mock.patch.object(voice_kiosk, "post_derived_metrics") as mock_ingest,
            mock.patch.object(voice_kiosk, "poll_mcu_button_event", return_value=None),
            mock.patch.object(voice_kiosk, "send_mcu_command"),
        ):
            voice_kiosk.run_simultaneous_bedside_cycle(
                route=bt_route, vosk_model=object()
            )

        self.assertTrue(aborted["called"])
        self.assertEqual(mock_checkin.call_args[0][0]["kind"], "crisis_button")
        mock_ingest.assert_not_called()
        self.assertTrue(any("112" in s for s in spoken[-1:]))

    def test_concurrent_edge_camera_stops_cleanly_on_signal(self) -> None:
        def fake_window(
            cfg: edge_monitor.EdgeWindowConfig,
            stop_event: threading.Event | None = None,
            abort_event: threading.Event | None = None,
        ) -> dict[str, object]:
            assert stop_event is not None
            while not stop_event.is_set():
                time.sleep(0.01)
            return {"deviceId": "unoq-home-01", "ok": True}

        with mock.patch.object(
            edge_monitor, "run_edge_window_with_config", side_effect=fake_window
        ):
            cam = edge_monitor.ConcurrentEdgeCamera(edge_monitor.EdgeWindowConfig())
            cam.start()
            time.sleep(0.03)
            summary = cam.stop(abort=False)

        self.assertEqual(summary, {"deviceId": "unoq-home-01", "ok": True})


if __name__ == "__main__":
    unittest.main()
