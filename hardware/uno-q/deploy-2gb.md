# Deploying Cepheus on Arduino UNO Q (2 GB RAM / 16 GB eMMC) — Trail #24

## 1. 2 GB RAM Budget (Headless Mode)

Never run Chromium/desktop GUI or `next build` on the 2 GB UNO Q. View `/patient`, `/monitoring`, and `/clinic` from a phone or laptop over LAN while the UNO Q runs headless:

| Component | Est. RAM | Notes |
| :--- | :--- | :--- |
| Debian Linux + USB/audio | ~300 MB | Headless CLI (`multi-user.target`) |
| PostgreSQL (tuned) | ~100 MB | Set `shared_buffers = 32MB`, `work_mem = 2MB` |
| Next.js production (`next start`) | ~150 MB | **Pre-built on laptop** for `linux/arm64`, never built on-board |
| Sequential Python worker (`voice_kiosk.py`) | **~200–350 MB peak** | Runs **Piper TTS -> Vosk/Whisper STT -> MediaPipe (`640x480` @ 10 fps)** one at a time, unloading between steps |
| **Total Peak** | **~850–900 MB** | Leaves ~1.1 GB headroom inside 2 GB RAM |

---

## 2. Pre-Build & Deploy (Laptop -> UNO Q)

1. Build the Next.js production bundle on your laptop (`npm run build`), or build/copy `.next`, `prisma`, `node_modules`, and `public/mediapipe` to the UNO Q.
2. Start Next.js in production mode on the UNO Q:
   ```bash
   NODE_ENV=production npm run start
   ```
3. Configure device credentials in `.env` (generate SHA-256 hash of your device token):
   ```env
   ARDUINO_DEVICE_KEYS_JSON='{"unoq-home-01":{"tokenHash":"<sha256-hex>","revoked":false}}'
   ```

---

## 3. Running the Bedside Voice + Camera Cycle

1. Install Python packages (`pip install -r hardware/uno-q/requirements.txt` plus `vosk` or `whisper.cpp`, and `piper-tts`).
2. Flash `hardware/uno-q/unoq_mcu_cue.ino` to the STM32U585 MCU if using physical LEDs and buttons.
3. Run the sequential kiosk cycle:
   ```bash
   CEPHEUS_BASE_URL="http://127.0.0.1:3000" \
   CEPHEUS_INGEST_URL="http://127.0.0.1:3000/api/arduino/ingest" \
   ARDUINO_INGEST_TOKEN="<device-token>" \
   VOSK_MODEL_PATH="/opt/models/vosk-model-small-en-us-0.15" \
   PIPER_MODEL_PATH="/opt/models/en_US-lessac-medium.onnx" \
   MEDIAPIPE_FACE_MODEL="/opt/models/face_landmarker.task" \
   python hardware/uno-q/voice_kiosk.py
   ```
4. **Always-available crisis path:** Saying `"help"`, `"crisis"`, `"112"`, answering PHQ-9 item 9 > 0, or pressing the physical `PIN_BTN_CRISIS` button immediately speaks `112` + `MIELI 09 2525 0111` + `TMS Clinic Nurse Line` and notifies `/api/arduino/check-in` with zero automated gating.
