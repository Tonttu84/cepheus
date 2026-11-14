# Android Health Connect & Apple Health Setup Guide

This guide explains how to connect your wearable (Oura, Fitbit, Garmin, Samsung Health, Gadgetbridge, or Apple Watch) to Cepheus using **Android Health Connect** or **Apple Health**—both for end users setting up a phone and for developers running Cepheus locally.

---

## Overview

Cepheus treats wearable data as an **optional passive wellbeing support layer** alongside your regular check-ins. It never diagnoses, treats, or predicts relapse, and sensor data is never sent to an AI to read mood.

How data flows without vendor cloud developer keys:

1. Your wearable app (Oura, Fitbit, Garmin, Samsung Health, Gadgetbridge, or Apple Health) writes daily sleep timing/stages, steps, active calories, resting/overnight heart rate, and RMSSD heart rate variability (HRV) to **Health Connect** (Android) or **Apple Health** (iOS).
2. A lightweight companion app on your phone pushes those numeric summaries to `POST /api/webhooks/health-connect`.
3. Cepheus validates the request, checks that your `ring_rhythm` consent toggle is on, upserts a `RingDay` record (`source: "health_connect"`), and updates your 7-day rolling `RhythmWindow` (Relative Amplitude `RA`, Interdaily Stability `IS`, Intradaily Variability `IV`, Sleep Regularity Index `SRI`, sleep midpoint SD, and mean steps).
4. You can pause or revoke access at any time from `/monitoring` without penalty.

---

## Part 1 — End-User Setup on Your Phone (Low-Effort Guide)

### Step 1: Connect your wearable app to Android Health Connect

- **Android 14 and newer:** Health Connect is built into **Settings → Security & privacy → Privacy → Health Connect** (or search **Health Connect** in Settings).
- **Android 9–13:** Install **Health Connect** from Google Play.

In your wearable app, enable **Health Connect** sync and grant these permissions:

- `Sleep`
- `Steps`
- `Active calories burned`
- `Heart rate`
- `Heart rate variability`

#### Avoid double-counting steps

If both your phone and your watch/ring count steps, set your wearable as the primary source:

1. Open **Health Connect → Data and access → Steps → Data sources and priority**.
2. Drag your watch or ring app **above** your phone's step counter.

#### Brand notes

- **Oura:** Syncs to Health Connect after your morning ring sync; an active Oura membership is required by Oura for full sleep/HRV export.
- **Fitbit:** Enable Health Connect inside the Fitbit app (**You → Health Connect**).
- **Garmin:** Enable Health Connect inside **Garmin Connect → Settings → Connected Apps → Health Connect**.
- **Samsung Health:** Enable Health Connect in **Samsung Health → Settings → Health Connect**.
- **Gadgetbridge:** Enable Health Connect export in Gadgetbridge settings for open-source/offline bands.
- **iOS (Apple Watch / Apple Health):** Use **Life Dashboard Companion** (Option A below), which reads directly from Apple Health.

---

### Step 2: Connect Health Connect to Cepheus (pick one companion app)

#### Option A — 1-Scan QR / 1-Tap Pairing with Life Dashboard Companion (Android & iOS, MIT open-source)

1. Install **Life Dashboard Companion** (free signed APK on GitHub Releases / F-Droid / Obtainium, or Google Play / iOS App Store) and grant Health Connect (or Apple Health) **read + background** permissions (plus **30-day history** if you want to backfill your baseline).
2. In Cepheus, open `/monitoring` and click **Pair phone (QR / Companion app)**.
3. Scan the on-screen SVG QR code with your phone (or tap **Open in Life Dashboard on this phone** if you are viewing `/monitoring` on your phone, which opens a `lifedashboard://pair#...` deep link), then tap **Pair**.
4. Life Dashboard immediately sends a signed `{"test": true}` ping (`HMAC-SHA256` `X-Signature`), and Cepheus updates the status to **Phone verified** (`204 No Content`).
5. *(Optional)* Run a **7- to 30-day backfill** inside the app to populate your rolling circadian window right away.

#### Option B — Free Google Play Setup with Health Connect to Webhook (`com.hcwebhook.app`)

1. Install **Health Connect to Webhook** (`com.hcwebhook.app`) from Google Play and grant **read + background** permissions.
2. Under **Data Types**, keep **Count overlapping apps once** enabled so overlapping phone + watch steps are deduplicated.
3. In Cepheus `/monitoring`, click **Pair phone (QR / Companion app)** and copy:
   - **Webhook URL:** `https://<your-host>/api/webhooks/health-connect?token=<tokenId>`
   - **Custom Header:** `Authorization: Bearer <secret>` or `X-API-Key: <secret>`
4. Paste them under **Webhooks** in Health Connect to Webhook and tap **Test** (Cepheus returns `204 No Content`).

---

### Step 3: Controlling your data, pausing, or disconnecting

- **Pause at any time:** Toggle **Wearable sleep & activity rhythm** (`ring_rhythm`) off on `/monitoring`. Incoming webhook pushes are immediately refused with `403` and nothing is stored.
- **Switch or lose a phone:** Click **Rotate pairing key** or **Disconnect phone** on `/monitoring` to revoke the credential immediately.

---

### Troubleshooting

- **Background sync stops on Android:** Set the companion app's battery usage to **Unrestricted** in Android Settings so `WorkManager` background syncs are not paused.
- **Local Wi-Fi / LAN testing over HTTP:** When testing against `http://<computer-lan-ip>:3000` on your home network, enable **Allow plain HTTP webhooks** under **More → Advanced** in Life Dashboard. Always use **HTTPS** in production.
- **Why the RhythmWindow card is empty at first:** At least **7 days** of `RingDay` data are needed before the rolling `RhythmWindow` card computes `RA`, `IS`, `IV`, and `SRI`.

---

## Part 2 — Self-Hosted / Developer Setup & Verification

### Starting Cepheus locally

```bash
npm install && npm run db:setup && npm run dev
```

### Supported authentication modes

1. **Per-participant interactive pairing** via `/monitoring` (`POST /api/monitoring/health-connect/pairing`):
   - Bound to the signed-in `PatientAuthSession` (isolating `WebhookCredential` and incoming `RingDay`/`RhythmWindow` rows per participant).
   - Stores an AES-256-GCM sealed `WebhookCredential` in PostgreSQL.
   - Requires `APP_SESSION_SECRET` (32+ characters) in `.env` in production.
2. **Server environment secret** (`HEALTH_CONNECT_WEBHOOK_SECRET`, 16+ characters in `.env`):
   - Accepts `X-Signature: sha256=<HMAC-SHA256>`, `Authorization: Bearer <secret>`, `X-Webhook-Token: <secret>`, or `X-API-Key: <secret>`.
   - Without a `?token=` query parameter, headless env-secret ingests fall back to `demo-home-node-01`.

### Verification with `curl`

#### 1. Send a `{"test": true}` verification ping (`204 No Content`)

```bash
curl -i -X POST "http://localhost:3000/api/webhooks/health-connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEALTH_CONNECT_WEBHOOK_SECRET" \
  -d '{"test": true}'
```

#### 2. Send an HMAC-SHA256 signed payload

```bash
PAYLOAD='{"test":true}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$HEALTH_CONNECT_WEBHOOK_SECRET" | awk '{print $2}')

curl -i -X POST "http://localhost:3000/api/webhooks/health-connect" \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=$SIG" \
  -d "$PAYLOAD"
```

#### 3. Simulate without a phone

Click **Simulate Health Connect webhook push** on `/monitoring` to insert sample records marked `isSimulated: true`.
