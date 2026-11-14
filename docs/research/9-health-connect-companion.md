# Android Health Connect sync: companion app versus existing webhook bridge

Checked 2026-11-14 with web search and repository documentation. Builds on
`6-sensing-feasibility.md` (sections B and C), `../plan.md` and `../build-plan.md`. Each
claim states its source: **official docs**, **repo docs**, or **secondary** (search
summary or forum report).

`../build-plan.md` is on trail 12 and not yet on `main`. Every build time in this report
is an estimate, not a measurement.

## The answer in one paragraph

**Use an existing open-source Health Connect webhook companion app and add one verified
webhook route (`POST /api/webhooks/health-connect`) to our Next.js backend; do not build
a custom Android app from scratch.** The Oura Android app (along with Samsung Health,
Fitbit, Garmin Connect and Gadgetbridge) writes sleep sessions with stages, steps, active
calories, heart rate and heart rate variability (RMSSD) into Android Health Connect,
which is built into the OS from Android 14 onward. Two actively maintained open-source
Android apps—**Life Dashboard Companion** (`owen282000/life-dashboard-companion-app`, MIT)
and **Health Connect to Webhook** (`mcnaveen/health-connect-webhook`, AGPL-3.0, free on
Google Play)—read Health Connect in the background via `WorkManager` and `POST` JSON
directly to any custom webhook URL. Both also have iOS Apple Health counterparts that
post the same JSON structure. Supporting their webhook payload in our Next.js app takes
2 to 3 hours in TypeScript with Vitest unit tests, keeps the entire product in one
repository (decision D15), supports 1-scan QR code pairing with per-patient HMAC-SHA256
signing so the patient stays pseudonymous (decision B3), and backfills 30+ days of
history for personal baseline calculation. Building a custom Android APK from scratch
would take 8 to 14 hours of Kotlin and Gradle work, require Google Play's Health Apps
declaration review for store distribution, and duplicate background sync, permission
rationale and retry outbox logic that is already solved under an MIT licence.

---

## A. What our backend needs and what Health Connect holds

### A1. Target fields in our schema (`prisma/schema.prisma`)

Our circadian rhythm and sleep regularity functions (`1-physical-signs.md`,
`6-sensing-feasibility.md` section B4) and the silence check (`plan.md`) read `RingDay`
and `RhythmWindow`:

| `RingDay` field | What it supports | Health Connect record type |
| --- | --- | --- |
| `bedtimeStart`, `bedtimeEnd`, `totalSleepMin`, `timeInBedMin`, `sleepMidpointMin` | Sleep duration and sleep midpoint SD across nights | `SleepSessionRecord` (`session_end_time`, `duration_seconds`) |
| `sleepWakeGrid` (1440-char `'0'`/`'1'`), `wasoMinutes` | Exact per-minute Sleep Regularity Index (SRI) and wake after sleep onset | `SleepSessionRecord.Stage` (`awake`, `awake_in_bed`, `out_of_bed`, `light`, `deep`, `rem`, `sleeping`) |
| `hourlyActivityJson` (24 floats), `m10`, `l5`, `relativeAmplitude` | Relative amplitude (RA), interdaily stability (IS) and intradaily variability (IV) | `StepsRecord` and `ActiveCaloriesBurnedRecord` (hourly buckets or raw intervals) |
| `steps`, `activeCaloriesKcal` | Daily step trend against personal baseline | `StepsRecord`, `ActiveCaloriesBurnedRecord`, or Health Connect `daily_totals` aggregate |
| `lowestHrBpm`, `avgHrBpm`, `avgHrvRmssdMs` | Supporting nightly physiological context | `HeartRateRecord`, `HeartRateVariabilityRmssdRecord` |
| `ringActive` | `ringActiveDuringSilence` when two check-in rounds go unanswered | Presence of sleep, step or heart-rate records for that date |

### A2. What wearable apps write to Health Connect

- **Oura (`com.ouraring.oura`):** writes sleep sessions with stages, steps, distance,
  active calories, exercise sessions, heart rate, heart rate variability (HRV), height
  and weight into Health Connect (repo docs:
  https://github.com/owen282000/life-dashboard-companion-app/blob/main/docs/brands/oura.md ;
  official support page:
  https://support.ouraring.com/hc/en-us/articles/10786105824531-Health-Connect-by-Android-Integration ;
  Google announcement:
  https://android-developers.googleblog.com/2023/08/health-connect-brings-together-peloton-oura-lifesum-for-deeper-health-and-fitness-insights.html ).
  - **What stays in Oura:** proprietary Readiness, Sleep and Activity scores (Health
    Connect has no score type), blood oxygen, skin temperature and respiratory rate (repo
    docs). None of those is needed for RA, IS, IV, SRI or sleep midpoint SD.
  - **Membership:** Oura lists the Health Connect integration for Gen2 rings without a
    subscription and for Gen3 / Oura Ring 4 with an active membership (repo docs, citing
    Oura support).
  - **Sync timing:** data moves ring → Oura app → Health Connect → webhook companion app.
    A night's sleep is written to Health Connect after the ring syncs with the Oura app
    in the morning, keeping its original overnight timestamps (repo docs).
- **Fitbit (`com.fitbit.FitbitMobile`):** writes sleep with stages, steps, active
  calories, heart rate and 5-minute RMSSD HRV samples into Health Connect after waking
  (repo docs:
  https://github.com/owen282000/life-dashboard-companion-app/blob/main/docs/DATA_SOURCES.md ).
  Note that Google switched off the legacy Fitbit Web API on 2 November 2026 (repo docs),
  making Health Connect the standard path for Fitbit devices too.
- **Garmin Connect (`com.garmin.android.apps.connectmobile`):** one-way write into Health
  Connect for sleep, steps, activities and heart rate (secondary and repo docs).
- **Samsung Health:** writes steps, sleep sessions, exercise and basic heart rate, but
  does not write HRV or skin temperature to Health Connect, and often writes steps as
  coarse daily aggregates unless a finer source has higher priority in Health Connect
  (secondary: Samsung developer blog and community reports).
- **Gadgetbridge (`nodomain.freeyourgadget.gadgetbridge`):** open-source companion for
  PineTime, Xiaomi, Amazfit, Huawei and Bangle.js; writes per-minute steps, distance,
  calories and sleep to Health Connect without any vendor cloud (repo docs).

---

## B. Pre-existing companion apps that sync Health Connect to a backend

### B1. Comparison of existing apps

| App | Licence | Install channels | Auth & pairing | Background sync & history | Payload format | iOS counterpart |
| --- | --- | --- | --- | --- | --- | --- |
| **Life Dashboard Companion** (`owen282000/life-dashboard-companion-app`) | **MIT** | Signed APK on GitHub Releases, F-Droid, Obtainium (all free, reproducible build); Google Play (EUR 4.99) | **1-scan QR code pairing** (`lifedashboard://pair#v=1&url=...&secret=...`) + **`X-Signature: sha256=<HMAC>`** over raw body, custom headers, optional mTLS | `WorkManager` periodic or scheduled sync; **backfill from 30 days to 5 years** in 72h windows; local outbox up to 700 payloads (1 week of 15-min syncs) | JSON `POST` (`sleep`, `steps`, `active_calories`, `heart_rate`, `heart_rate_variability`, `daily_totals`, `_resolutions`, `deleted_records`) | Yes (`life-dashboard-companion-app-ios`, Apple Health, posts the same JSON with `source: "healthkit_ios"`) |
| **Health Connect to Webhook (HC Webhook)** (`mcnaveen/health-connect-webhook`) | **AGPL-3.0-only** (with commercial store addendum) | **Free on Google Play** (`com.hcwebhook.app`) and GitHub Releases | Custom HTTP headers (e.g. `Authorization: Bearer <token>` or `x-api-key`) | `WorkManager` interval or schedule; rolling 48h default window + Changes API for edits/late writes up to 31 days; **built-in local HTTP server on port 8787** (`GET /?days=7`) | JSON `POST` (`sleep`, `steps`, `active_calories`, `heart_rate`, `heart_rate_variability`, `deleted`) or Protobuf/gRPC | Yes (App Store `id6763619597`) |
| **HCGateway** (`ShuchirJ/HCGateway`) | **GPL-3.0** | Build from source / APK | User login to HCGateway's own relay server | Pushes every 2 hours to a Python + MongoDB server (Fernet-encrypted) | Custom REST API on the relay server | No |

Sources (B1):
- Life Dashboard Companion: https://github.com/owen282000/life-dashboard-companion-app ;
  webhook spec: https://github.com/owen282000/life-dashboard-companion-app/blob/main/docs/webhook.md ;
  QR pairing spec: https://github.com/owen282000/life-dashboard-companion-app/blob/main/docs/pairing.md
- Health Connect to Webhook: https://github.com/mcnaveen/health-connect-webhook ;
  Play Store: https://play.google.com/store/apps/details?id=com.hcwebhook.app ;
  webhook spec: https://github.com/mcnaveen/health-connect-webhook/blob/main/docs/webhook.md
- HCGateway: https://github.com/ShuchirJ/HCGateway

### B2. Why Life Dashboard Companion + HC Webhook fit our design rules

1. **Near-zero patient effort (`AGENTS.md` rule):** With Life Dashboard Companion's QR
   pairing protocol, our web app shows one QR code encoding:
   `https://owen282000.github.io/life-dashboard-companion-app/pair#v=1&url=<encoded-webhook-url>&secret=<per-patient-hmac-secret>&name=Cepheus&sources=health_connect`
   (or `lifedashboard://pair#...` from a button on the phone's browser). The patient scans
   it once, taps **Pair**, and the app immediately sends a signed test ping (`{"test": true,
   "source": "health_connect"}`) so our screen can confirm connection without the patient
   ever typing a URL or secret (repo docs: `docs/pairing.md`).
   - **Review note:** the `https://owen282000.github.io/...` form of this link sends the
     patient's browser, with the secret in it, through a page on the companion app
     author's site. The secret sits after `#`, so the browser does not send it to that
     server, but the page's own script can read it. Pairing through the app's own
     `lifedashboard://pair#...` link, or through a page we serve ourselves, keeps the
     secret off a third party's page and is safer.
2. **Pseudonymity (`build-plan.md` decision B3):** The webhook URL carries only an opaque
   webhook token or the pseudonymous participant ID, and the request is authenticated via
   `X-Signature: sha256=<HMAC-SHA256(secret, rawBody)>` (Life Dashboard) or a bearer token
   header (HC Webhook). Neither companion app uses an account or cloud server of its own;
   packets go straight from the patient's phone to our EU server.
3. **Separate consent switches (`AGENTS.md`, decisions D13 and B4):** Both companion apps
   let the user toggle each Health Connect category separately on the phone, and our
   webhook route checks `MeasurementConsent` (`method: "ring"`) before storing any
   incoming payload—refusing or dropping data if the patient switched ring/wearable
   collection off in our web app.
4. **Overlapping step sources handled cleanly:** If both the phone and the ring write
   steps into Health Connect, summing raw records double-counts them. Life Dashboard
   includes `daily_totals` from Health Connect's aggregate API (which deduplicates
   overlapping intervals by source priority), and HC Webhook has a "Count overlapping
   apps once" aggregate mode for N-minute and daily buckets (repo docs).

### B3. Payload mapping to `RingDay`

Both top apps use nearly identical field names for `sleep`, `steps`, `active_calories`,
`heart_rate` and `heart_rate_variability`:

- **Sleep (`sleep` array):**
  ```json
  {
    "session_end_time": "2026-10-04T06:30:00Z",
    "duration_seconds": 28800,
    "stages": [
      {
        "stage": "deep",
        "start_time": "2026-10-03T23:00:00Z",
        "end_time": "2026-10-04T01:00:00Z",
        "duration_seconds": 7200
      }
    ]
  }
  ```
  - `bedtimeStart` = `session_end_time - duration_seconds`; `bedtimeEnd` =
    `session_end_time`; `timeInBedMin` = `duration_seconds / 60`.
  - Stage strings in Life Dashboard are lowercase (`awake`, `awake_in_bed`, `out_of_bed`,
    `light`, `deep`, `rem`, `sleeping`, `unknown`); in HC Webhook they come from AndroidX
    `SleepSessionRecord.Stage` constants or strings. Treating any stage matching `awake`,
    `awake_in_bed`, `out_of_bed` or `STAGE_TYPE_AWAKE*` as wake (`'0'`) and the rest of
    the session window as sleep (`'1'`) produces the 1440-character `sleepWakeGrid`,
    `wasoMinutes` and `totalSleepMin`.
- **Hourly activity (`steps` and `active_calories`):**
  - Raw interval records (`{ count, start_time, end_time }`) or hourly buckets
    (`{ bucket_start, bucket_end, total }`) are distributed across the 24 local clock
    hours (`0..23`) using the patient's timezone (or the payload's `timezone` /
    `start_zone_offset`), producing `hourlyActivityJson` for `m10`, `l5`,
    `relativeAmplitude`, `interdailyStability` and `intradailyVariability`.
- **Heart rate & HRV (`heart_rate` and `heart_rate_variability`):**
  - Supports both raw sample objects (`{ bpm, time }` / `{ rmssd_millis, time }`) and
    bucketed objects (`{ avg, min, max, sample_count }`), computing daily `lowestHrBpm`,
    `avgHrBpm` and `avgHrvRmssdMs`.

---

## C. Building a custom Android companion app: what it takes

### C1. Official Android Health Connect requirements

- **Bundling in Android:** Health Connect is built into the Android framework as a system
  module starting in **Android 14 (API level 34)**. On Android 9 to 13, it is installed
  from Google Play (`com.google.android.apps.healthdata`) (official docs:
  https://developer.android.com/health-and-fitness/health-connect/get-started ).
- **SDK version:** `androidx.health.connect:connect-client:1.1.0` requires `compileSdk =
  36` (search summary of official release notes).
- **Permissions required in `AndroidManifest.xml`:**
  - `android.permission.health.READ_STEPS`
  - `android.permission.health.READ_SLEEP`
  - `android.permission.health.READ_HEART_RATE`
  - `android.permission.health.READ_HEART_RATE_VARIABILITY`
  - `android.permission.health.READ_ACTIVE_CALORIES_BURNED`
  - `android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND` — required to read Health
    Connect from a background `WorkManager` worker when the app is not in the foreground
    (official reference:
    https://developer.android.com/reference/android/health/connect/HealthPermissions ).
  - `android.permission.health.READ_HEALTH_DATA_HISTORY` — without this permission, an
    app cannot read records older than **30 days** before the permission was first
    granted (official docs and issue tracker:
    https://github.com/matinzd/react-native-health-connect/issues/192 ).
- **Required manifest declarations for Android 14+:**
  To open the system Health Connect permission prompt on Android 14+, the app must declare
  a `<queries>` block for `com.google.android.apps.healthdata`, an activity handling
  `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`, and an exported `<activity-alias>`
  with `android.permission.START_VIEW_PERMISSION_USAGE`, action
  `android.intent.action.VIEW_PERMISSION_USAGE` and category
  `android.intent.category.HEALTH_PERMISSIONS`. If the `activity-alias` is missing,
  requesting permissions fails silently (official docs and troubleshooting reports:
  https://developer.android.com/health-and-fitness/health-connect/get-started ;
  https://openwearables.io/docs/sdk/android/troubleshooting ).

### C2. Sideloading vs. Google Play Store approval

- **Local / sideloaded APK (hackathon demo):** A debug or signed release APK built in
  Android Studio and installed via USB (`adb install`) or direct APK download **can**
  request and receive Health Connect permissions on Android 14+ without being on Google
  Play, provided the manifest `<queries>` and `<activity-alias>` above are present
  (official docs and developer reports). However, sideloading an unknown APK triggers
  Google Play Protect warnings on a patient's phone.
- **Google Play publication (real deployment):** Publishing an app that declares
  `android.permission.health.*` requires completing the **Health Apps declaration form**
  in Google Play Console, justifying each data type against Play policy, matching the
  Data Safety section and privacy policy, and waiting for Google review (official docs:
  https://developer.android.com/health-and-fitness/health-connect/publish ).

### C3. Cost of custom build vs. existing app + webhook

| Dimension | Existing webhook app + Next.js route | Custom Cepheus Android app from scratch | Forking `life-dashboard-companion-app` (MIT) |
| --- | --- | --- | --- |
| Build time (estimate) | **2–3 hours** (TypeScript only) | **8–14 hours** (Kotlin, Compose, WorkManager, outbox, QR scanner, plus the Next.js route) | **4–6 hours** (strip UI, hardcode Cepheus branding, build APK, plus the Next.js route) |
| Fits single-repo TypeScript stack (D15) | Yes | No (adds Android Gradle build and Kotlin codebase) | No (adds Android Gradle build) |
| Play Store review needed | Already passed (`com.hcwebhook.app` and `com.owen282000.lifedashboard` are on Google Play) | Yes, for Play Store distribution | Yes, for Play Store distribution |
| iOS Apple Health support | Included (both apps have iOS versions posting the same JSON) | None (Android only) | Requires also forking `life-dashboard-companion-app-ios` |
| Backfill (>30 days) & retry outbox | Already built and tested | Must be written and tested | Already built |

**Open: licence.** Asking a patient to install HC Webhook (AGPL-3.0) unchanged, as a
separate app that talks to our server, is one thing. Distributing a rebranded or
modified copy is another and brings the AGPL's duties with it. Life Dashboard Companion
is MIT, which allows a fork with its notice kept. Neither case has been checked with
anyone who knows licensing; treat this as open.

---

## D. Recommended architecture for Cepheus

1. **Webhook ingestion route (`POST /api/webhooks/health-connect`):**
   - Authenticates the request using either:
     - Life Dashboard Companion's `X-Signature: sha256=<HMAC-SHA256(secret, rawBody)>`
       (verified in constant time with `crypto.timingSafeEqual` over the raw request
       bytes before JSON parsing), or
     - A per-participant bearer secret in `Authorization` / `X-Webhook-Token` for HC
       Webhook.
   - Checks `server/access` and `domain/consent`: if the participant has not switched on
     the wearable/ring measurement layer (`MeasurementConsent`), returns `403` and stores
     nothing.
   - Parses the payload with a Zod schema (`HealthConnectWebhookSchema`) that accepts
     both Life Dashboard Companion and HC Webhook JSON shapes (and ignores `"test": true`
     pings after returning `204` and marking the webhook connected).
   - Maps `sleep`, `steps`, `active_calories`, `heart_rate`, `heart_rate_variability` and
     `daily_totals` into daily `RingDay` records (`source: "health_connect"`,
     `isSimulated: false`, `ringActive: true`) and updates the participant's rolling
     `RhythmWindow`.
2. **One-scan QR pairing on the patient setup screen:**
   - When the patient switches on wearable sensing, the page generates a random 32-byte
     per-participant webhook secret (stored as a hash or secret row for that
     pseudonymous participant) and renders a QR code with the Life Dashboard pairing link
     plus the plain webhook URL and header for HC Webhook users.

### D1. Review notes on this design

These notes answer review points on the design above. They add to it; they do not
replace it.

- **Secret storage.** An HMAC secret cannot be stored as a hash: the server needs the
  secret itself to recompute the signature. Store it encrypted or as a protected secret
  row. Only a bearer token can be stored as a hash.
- **Rules still to state.** How a secret is rotated and revoked (for example when a
  phone is lost or the patient switches wearable collection off); a size limit and a
  rate limit on the route; and one uniform answer for a wrong signature and for an
  unknown patient, so the route does not reveal which patients exist.
- **Unknown fields and logs.** Fields the schema does not know are dropped, not stored.
  The raw request body is never logged; logs carry an event id, never health values.
- **Shape of the route.** The route should only check the signature and parse the body,
  then hand over to a use case. That use case acts as the patient the secret belongs
  to and asks the shared access rules (`server/access`) whether this write is allowed,
  including the consent switch, before it maps and stores anything. This keeps the
  consent check in one place instead of inside the route.
- **Real data at the demo.** Data from a teammate's own ring is a real person's health
  data, not simulated data. Using it needs that person's agreement, and every screen
  that shows it needs a "live demo" label.

---

## What was built, and what the build plan would need

This report first came with a proposed addition to the build plan. That addition is
recorded here so the ideas are not lost:

- **Decision B12:** health data from Android Health Connect (and Apple Health on iOS)
  arrives through an existing open-source companion app posting to
  `POST /api/webhooks/health-connect`, authenticated per patient by an HMAC-SHA256
  secret paired by QR code, instead of a custom Android app or a per-vendor login.
- **Module 17:** the route that receives that webhook, checks the signature and the
  wearable consent switch, maps the payload into `RingDay` and updates `RhythmWindow`,
  plus the QR pairing link on the patient settings screen.
- **A `WebhookCredential` table:** one secret per patient, created when wearable
  collection is switched on and deleted when it is switched off or the data is deleted.
- **A protection row:** the route listed as an exception to "every route needs a
  session", because it requires a valid signature or token instead.
- **Step 11:** build the route, the pairing link and the mapping, after the sign-in
  step.

The route has since been built on trail 25 (`src/app/api/webhooks/health-connect/route.ts`
and `src/domain/health-connect/`). As read on that branch, it rate-limits requests,
refuses bodies over 512 KB, parses them with a Zod schema, accepts either an
`X-Signature` HMAC or a bearer token checked against one shared secret from the
environment, answers a test ping with `204`, and saves the mapped days for a single
pseudonymous demo participant; per-patient secrets and pairing are not built yet. The
points above, with the review notes in D1, should be folded into the build plan on
trail 12 by its author.

---

## E. Not confirmed in this run

- Whether the Oura Android app on a team member's phone at the venue currently writes
  fine-grained sleep stages (`deep`, `light`, `rem`, `awake`) or only session bounds in
  their specific regional app build: Google's announcement and Life Dashboard's Oura
  guide state stages are exported, while Oura's consumer support article says "Sleep"
  without listing sub-stages. Check under Android Settings → Health Connect → App
  permissions → Oura on a physical phone if one is available.
- Exact rate limits or battery-optimisation behaviour on every phone vendor (Samsung One
  UI, Xiaomi HyperOS) when `WorkManager` runs every 15–60 minutes without the user
  opening the companion app. Both companion apps document turning off Android battery
  optimisation for reliable background delivery.
