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

Works with **Fitbit, Oura, Garmin, Samsung Health, Gadgetbridge, or Apple Watch** without vendor developer keys:

1. Set `HEALTH_CONNECT_WEBHOOK_SECRET` (16+ random chars) in `.env`.
2. On Android, enable **Health Connect** sync inside the Fitbit / Oura / Garmin app.
3. Install **Health Connect to Webhook** (`com.hcwebhook.app`, free on Google Play) or **Life Dashboard Companion** (Android/iOS):
   - **Endpoint URL:** `https://<your-host>/api/webhooks/health-connect`
   - **Authentication:** either `Authorization: Bearer <HEALTH_CONNECT_WEBHOOK_SECRET>`, `X-Webhook-Token: <HEALTH_CONNECT_WEBHOOK_SECRET>`, or Life Dashboard's `X-Signature: sha256=<HMAC-SHA256>` using that secret.
4. Initial `{"test": true}` pings return `204 No Content` without writing data; real sync batches upsert `RingDay` (`source: "health_connect"`) and recompute `RhythmWindow`.
5. Without a phone connected, click **Simulate Health Connect webhook push** on `/monitoring` (records are marked `isSimulated: true`).

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

## Demo-Only Scoping Notice

Currently, `/monitoring`, `/api/monitoring/summary`, `/api/fitbit/*`, `/api/arduino/ingest`, and `/api/webhooks/health-connect` bind to a single pseudonymous demo participant (`demo-home-node-01`, no real patient data) pending Step 6 (`Better Auth` patient & clinic sessions). Once sign-in lands, device credentials and wearable webhooks will bind to the authenticated `session.patientId`, and every read/write already passes through `decideAccess()` in `src/domain/access` (redacting raw numbers for `staff` viewers per Decision `D8`).

## Arduino UNO Q Setup

1. Install Python dependencies on the Arduino UNO Q (`hardware/uno-q/requirements.txt`) and download MediaPipe's `face_landmarker.task`.
2. Configure per-device SHA-256 hashed credentials in `.env` (`ARDUINO_DEVICE_KEYS_JSON='{"unoq-home-01":{"tokenHash":"<sha256-hex>","revoked":false}}'` or `ARDUINO_INGEST_TOKEN`) and set the matching `ARDUINO_INGEST_TOKEN` on the board. `edge_monitor.py` automatically attaches `timestampMs` and a single-use `nonce` for replay protection.
3. Run:
   ```bash
   CEPHEUS_INGEST_URL="http://<host-ip>:3000/api/arduino/ingest" \
   ARDUINO_INGEST_TOKEN="<device-token>" \
   python hardware/uno-q/edge_monitor.py
   ```
4. View incoming numeric summaries and desk ring-light cue status on `/monitoring`.
5. **On-device voice note (Trail #24):** Any future spoken question mode on the UNO Q must keep audio on-device (e.g. sequential Piper TTS + `whisper.cpp`), never infer mood from voice, and expose an always-available crisis path to a human and `112`.

## Clinical & Privacy Boundaries Enforced

- **No diagnostic or mood-reading AI:** Neither Health Connect, Fitbit, nor Arduino data is sent to any AI to infer mood or diagnose depression.
- **No raw media:** `evaluateArduinoEdgePayload` rejects any payload containing raw media fields (`frame`, `imageBase64`, `video`, `audio`, etc.), and `/api/arduino/ingest` caps body size at 16 KB.
- **Broad-area clinic view only (D8/D12):** Home routine signals belong to `daily_routine` and never trigger a clinic alert on their own.
