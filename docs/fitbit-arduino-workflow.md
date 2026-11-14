# Fitbit + Arduino UNO Q Home Monitoring Workflow

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
│ 2. PASSIVE WEARABLE: Fitbit Web API (OAuth2 + PKCE S256)                │
│    - One-time pairing (no Apple Health / Health Connect native app)     │
│    - Pulls sleep stages -> 1440-min sleepWakeGrid, WASO, sleep midpoint │
│    - Pulls daily & 15-min intraday steps + resting HR                   │
│    - Feeds src/domain/signals/ (RA, IS, IV, SRI, Sleep Midpoint SD)     │
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

## Arduino UNO Q Setup

1. Install Python dependencies on the Arduino UNO Q (`hardware/uno-q/requirements.txt`) and download MediaPipe's `face_landmarker.task`.
2. Set `ARDUINO_INGEST_TOKEN` in both Cepheus's `.env` and the Arduino UNO Q environment.
3. Run:
   ```bash
   CEPHEUS_INGEST_URL="http://<host-ip>:3000/api/arduino/ingest" \
   ARDUINO_INGEST_TOKEN="<same-token>" \
   python hardware/uno-q/edge_monitor.py
   ```
4. View incoming numeric summaries and desk ring-light cue status on `/monitoring`.

## Clinical & Privacy Boundaries Enforced

- **No diagnostic or mood-reading AI:** Neither Fitbit nor Arduino data is sent to any AI to infer mood or diagnose depression.
- **No raw media:** `evaluateArduinoEdgePayload` rejects any payload containing raw media fields (`frame`, `imageBase64`, `video`, `audio`, etc.), and `/api/arduino/ingest` caps body size at 16 KB.
- **Broad-area clinic view only (D8/D12):** Home routine signals belong to `daily_routine` and never trigger a clinic alert on their own.
