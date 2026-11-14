# Wearable + Arduino UNO Q Home Monitoring Workflow

This document describes the passive home-monitoring pipeline added on top of Cepheus's core post-TMS check-in flow.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. ON-DEVICE HOME EDGE: Arduino UNO Q + External USB Camera             │
│    - Processes 720p frames strictly in RAM (0 bytes video/audio saved)  │
│    - Tracks daytime stationary bouts + ambient room lux + brief facial  │
│      expressivity & head movement dispersion                            │
│    - Sends ONLY numeric JSON to POST /api/arduino/ingest (Bearer auth)  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│ 2. PASSIVE WEARABLE (Shared RingDay + RhythmWindow Pipeline)            │
│    Option A: Android Health Connect / Apple Health Webhook (Trail #23)  │
│      - Free Play Store / App Store bridge (Health Connect to Webhook    │
│        or Life Dashboard Companion) pushes sleep, steps, HR, HRV to     │
│        POST /api/webhooks/health-connect (HMAC-SHA256 / Bearer auth)    │
│    Option B: Fitbit Web API (OAuth2 + PKCE S256)                        │
│      - Pulls sleep stages, steps, and resting HR via /api/fitbit/*      │
│    -> Both feed src/domain/signals/ (RA, IS, IV, SRI, Midpoint SD)      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│ 3. CONSENT-GATED POSTGRESQL STORAGE & /monitoring VIEW                  │
│    - Enforces per-method MeasurementConsent (ring_rhythm,               │
│      camera_expressivity, home_routine) before writing any row          │
│    - Simulated runs are always marked isSimulated: true                 │
│    - Home routine signals never raise a clinic flag alone (D12)         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Health Connect / Apple Health Webhook Setup (Trail #23)

Works with **Fitbit, Oura, Garmin, Samsung Health, Gadgetbridge, or Apple Watch** without vendor developer keys. See **[docs/health-connect-setup.md](health-connect-setup.md)** for the full end-user phone guide, troubleshooting, and developer `curl` verification.

1. **Option 1 — Per-participant QR / 1-tap pairing (recommended):** Open `/monitoring`, click **Pair phone (QR / Companion app)**, and scan the QR code (or tap the `lifedashboard://pair#...` deep link) with **Life Dashboard Companion** (Android/iOS), or copy the `?token=<tokenId>` URL and `Authorization: Bearer <secret>` / `X-API-Key: <secret>` header into **Health Connect to Webhook** (`com.hcwebhook.app`).
2. **Option 2 — Server environment secret:** Set `HEALTH_CONNECT_WEBHOOK_SECRET` (16+ random chars) in `.env` and send `Authorization: Bearer <secret>`, `X-Webhook-Token: <secret>`, `X-API-Key: <secret>`, or `X-Signature: sha256=<HMAC-SHA256>` to `POST /api/webhooks/health-connect`.
3. Initial `{"test": true}` pings return `204 No Content` without writing data; real sync batches upsert `RingDay` (`source: "health_connect"`) and recompute `RhythmWindow`.
4. Without a phone connected, click **Simulate Health Connect webhook push** on `/monitoring` (records are marked `isSimulated: true`).

## Fitbit Setup (Real OAuth2 PKCE)

1. Go to [dev.fitbit.com](https://dev.fitbit.com/apps/new) and register an app:
   - **OAuth 2.0 Application Type:** `Personal` (unlocks 15-minute intraday steps on your own Fitbit account for RA/IS/IV calculations; falls back cleanly to daily totals if unavailable).
   - **Callback URL:** `http://localhost:3000/api/fitbit/callback` (or your HTTPS production URL).
2. Copy the credentials into `.env` (never commit `.env`):
   ```env
   APP_SESSION_SECRET="<32+ random characters>"
   FITBIT_CLIENT_ID="<your client id>"
   FITBIT_CLIENT_SECRET="<your client secret>"
   FITBIT_REDIRECT_URI="http://localhost:3000/api/fitbit/callback"
   ```
3. Open `/monitoring` → click **Connect Fitbit (PKCE)** → click **Sync last 7 days (Fitbit)**.
4. Without Fitbit credentials, use **Simulate 7-day Fitbit sync** on `/monitoring` (records are marked `isSimulated: true`).

## Session-Scoped Participant Binding

Authenticated `/monitoring`, `/api/monitoring/summary`, `/api/fitbit/*`, and `/api/monitoring/health-connect/pairing` bind per-patient to the signed-in `PatientAuthSession` (isolating `MeasurementConsent`, `WebhookCredential`, `RingDay`, and `RhythmWindow` per participant, with D8 redaction of raw sensor numbers for `staff` sessions). Headless hardware or environment-secret ingests without a user session or `?token=` (such as `/api/arduino/ingest` or env-secret `/api/webhooks/health-connect`) fall back to `demo-home-node-01`, and every read/write passes through `decideAccess()` in `src/domain/access`.

## Arduino UNO Q Setup

1. Install system audio/Bluetooth packages (`sudo apt install -y bluez pulseaudio-utils alsa-utils espeak-ng`) and Python dependencies on the Arduino UNO Q (`pip install -r hardware/uno-q/requirements.txt`). See `hardware/uno-q/deploy-2gb.md` for Bluetooth headphone pairing (`bluetoothctl`).
2. Configure per-device SHA-256 hashed credentials in `.env` (`ARDUINO_DEVICE_KEYS_JSON='{"unoq-home-01":{"tokenHash":"<sha256-hex>","revoked":false}}'` or `ARDUINO_INGEST_TOKEN`) and set the matching `ARDUINO_INGEST_TOKEN` on the board. `edge_monitor.py` and `voice_kiosk.py` automatically attach `timestampMs` and a single-use `nonce` for replay protection.
3. Run standalone passive camera sampling or the **Bluetooth headphone voice + simultaneous facial detection check-in**:
   ```bash
   CEPHEUS_BASE_URL="http://<host-ip>:3000" \
   CEPHEUS_INGEST_URL="http://<host-ip>:3000/api/arduino/ingest" \
   ARDUINO_INGEST_TOKEN="<device-token>" \
   python3 hardware/uno-q/voice_kiosk.py --watch-bluetooth
   ```
4. View incoming numeric check-ins, facial/ambient summaries, and desk ring-light cue status on `/monitoring`.
5. **On-device voice & privacy rules (Trail #24):** `voice_kiosk.py` keeps all audio and camera frames strictly in RAM on the UNO Q, maps spoken answers deterministically via local Vosk without voice mood reading, and exposes an immediate crisis path (`112`, MIELI `09 2525 0111`, TMS Clinic Nurse Line) with zero automated gating.

## Clinical & Privacy Boundaries Enforced

- **No diagnostic or mood-reading AI:** Neither Health Connect, Fitbit, nor Arduino data is sent to any AI to infer mood or diagnose depression.
- **No raw media:** `evaluateArduinoEdgePayload` rejects any payload containing raw media fields (`frame`, `imageBase64`, `video`, `audio`, etc.), and `/api/arduino/ingest` caps body size at 16 KB.
- **Broad-area clinic view only (D8/D12):** Home routine signals belong to `daily_routine` and never trigger a clinic alert on their own.
