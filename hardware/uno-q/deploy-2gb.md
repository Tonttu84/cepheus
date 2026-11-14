# Deploying Cepheus on Arduino UNO Q (2 GB RAM / 16 GB eMMC)

## 1. 2 GB RAM Budget (Headless Mode)

Never run Chromium/desktop GUI or `next build` on the 2 GB UNO Q. View `/patient`, `/monitoring`, and `/clinic` from a phone or laptop over LAN while the UNO Q runs headless:

| Component | Est. RAM | Notes |
| :--- | :--- | :--- |
| Debian Linux + BlueZ / PipeWire | ~300 MB | Headless CLI (`multi-user.target`) |
| PostgreSQL (tuned, if local) | ~100 MB | Set `shared_buffers = 32MB`, `work_mem = 2MB` |
| Next.js production (`next start`, if local) | ~150 MB | **Pre-built on laptop** for `linux/arm64`, never built on-board |
| Simultaneous Voice + Camera (`voice_kiosk.py`) | **~220–320 MB** | Bluetooth TTS (`espeak-ng`/`piper`) + Vosk grammar STT + `640x480` @ 8 fps facial detection thread |
| **Total Peak** | **~800–900 MB** | Leaves >1 GB headroom inside 2 GB RAM |

---

## 2. Backend & Device Credentials

1. If running the backend on your laptop/server on the same LAN, note its LAN IP (`http://<host-ip>:3000`). If running on the UNO Q directly, build on your laptop first (`npm run build`) and start with `NODE_ENV=production npm run start`.
2. Configure device credentials in `.env` (SHA-256 hash of your device token):
   ```env
   ARDUINO_DEVICE_KEYS_JSON='{"unoq-home-01":{"tokenHash":"<sha256-hex>","revoked":false}}'
   ```

---

## 3. Bluetooth Headphones + Voice Answers + Simultaneous Facial Detection

### Step 1 — Install system audio/Bluetooth tools & Python packages on the UNO Q

```bash
sudo apt update
sudo apt install -y bluez pulseaudio-utils alsa-utils espeak-ng
pip install -r hardware/uno-q/requirements.txt
```

*(Note: On first run, `vosk` automatically downloads and caches the ~40 MB `vosk-model-small-en-us` speech model into `~/.cache/vosk` if `VOSK_MODEL_PATH` is not set. Optional: install `opencv-contrib-python` if you want 68-point `FacemarkLBF` landmarks in addition to the built-in OpenCV Haar facial/head kinematics.)*

### Step 2 — Pair and trust your Bluetooth headphones once

Put your Bluetooth headphones into pairing mode, then run on the UNO Q:

```bash
bluetoothctl
# Inside bluetoothctl:
power on
agent on
default-agent
scan on
# Wait until your headphones appear as XX:XX:XX:XX:XX:XX, then:
pair XX:XX:XX:XX:XX:XX
trust XX:XX:XX:XX:XX:XX
connect XX:XX:XX:XX:XX:XX
exit
```

Because the headphones are marked `trust`, turning them on later reconnects automatically.

### Step 3 — Run the Bluetooth + Simultaneous Camera Kiosk

To **watch continuously** so that whenever you turn on / connect your Bluetooth headphones, the UNO Q starts USB camera facial detection simultaneously, reads the questions out loud through your headphones, and listens to your spoken answers (no keyboard needed):

```bash
CEPHEUS_BASE_URL="http://<host-ip>:3000" \
CEPHEUS_INGEST_URL="http://<host-ip>:3000/api/arduino/ingest" \
ARDUINO_INGEST_TOKEN="<device-token>" \
python3 hardware/uno-q/voice_kiosk.py --watch-bluetooth
```

Useful flags:
- **Run once immediately** (if headphones are already connected): omit `--watch-bluetooth`.
- **Wait once for headphones to connect, run, and exit:** `--wait-for-bluetooth`.
- **Force the headphones' built-in Bluetooth mic (HFP/HSP)** even when a USB webcam mic is plugged in: add `--bluetooth-mic` (if no USB mic is present, `voice_kiosk.py` switches to the Bluetooth headset mic automatically).
- **Spoken replies recognized:** `"zero"`..`"four"` (or `"very low"`, `"not at all"`, `"low"`, `"a little"`, `"okay"`, `"good"`, `"quite a bit"`, `"very good"`, `"very much"`), `"not today"` / `"skip"`, or `"help"` / `"crisis"` / `"one one two"`.
- **Always-available crisis path:** Saying `"help"`, `"crisis"`, `"one one two"`, or pressing physical `PIN_BTN_CRISIS` immediately aborts the camera, speaks `112` + `MIELI 09 2525 0111` + `TMS Clinic Nurse Line` through the headphones, and notifies `/api/arduino/check-in` with zero automated gating.
