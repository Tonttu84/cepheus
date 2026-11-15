# Cepheus

## What it is

A home product that helps people stay well after depression treatment with Transcranial
Magnetic Stimulation (TMS), built for the Aalto University challenge "Beyond the Clinic"
at Junction 2026. The core flow is simple: short validated questions twice a week, and
the standard nine-question depression questionnaire (PHQ-9) every two weeks. A warning
is sent to the clinic when answers stay low against the person's own baseline or are
missed, and a nurse calls to find out what is happening. Passive sensing from a smart
ring, wearables, and an on-device camera supports the questions rather than replacing them.

## What it does not do

- No diagnosis and no treatment claims: the product supports clinical judgement and does
  not treat or diagnose depression.
- The product flags possible relapse risk for a nurse or doctor, who makes the clinical
  judgement, and never tells the patient about relapse.
- No mood reading from a face or voice by an AI model, and no automated triage decisions.
- Camera and microphone input is processed entirely on the device; only derived numbers
  are stored, never video, image frames, or audio recordings.
- No real patient data: all data in the repository and interface is simulated or from open
  research datasets, and simulated data is labelled wherever it is shown.
- Crisis path: anything asking about mood or self-harm shows a direct human crisis path
  to emergency help and 24/7 human crisis support with nothing automated in between.

## What it does today

- **Check-in flow (`/check-in` & bedside unit)**: twice-weekly mood and interest taps,
  fortnightly PHQ-9, and skip option ("Not today"). Answers are validated, access-checked,
  and saved to PostgreSQL through transactional use cases (`src/usecases/`). Individual
  questionnaire answers are kept in memory only; only aggregate status, scores, and
  derived states are stored (D45). Bedside voice check-in (Arduino UNO Q) answers rounds
  via shared use cases (D43). Immediate crisis trigger on any non-zero response to PHQ-9
  question 9 or the bedside crisis button, displaying human emergency help and alerting
  the clinic.
- **Clinic overview (`/clinic`)**: displays open follow-up flags from the database via
  `/api/clinic/flags`. When staff read flags, elapsed rounds close and the multi-round
  warning rule runs for that clinic's patients. Flags show broad life areas (`check_in`,
  `sleep`, `daily_routine`) and start dates, never raw answers. Includes the Verda Gemma
  nurse brief panel (off by default, D44).
- **Passive sensing & monitoring (`/monitoring`)**: circadian rhythm signal mathematics
  (interdaily stability, intradaily variability, relative amplitude, sleep regularity index)
  and rolling personal baselines. On-device camera kinematics (head pose, expressivity
  blendshapes) via MediaPipe in the browser. Fitbit OAuth2 PKCE sync and Health Connect /
  Apple Health webhooks with authenticated QR pairing (see
  [docs/health-connect-setup.md](docs/health-connect-setup.md)). Passive consent defaults
  off (`ring_rhythm`, `camera_expressivity`, `home_routine` paused until opted in), with
  device connection status displayed separately from consent.
- **Authentication & security**: sealed session cookies (AES-256-GCM), role-scoped
  navigation and API route guards (`requirePatientPageSession`, `requireStaffPageSession`,
  `requireApiSession`), one-click simulated sign-in for sample patients and clinic nurse
  on `/sign-in`, strict security headers and CSP, and tests enforcing zero raw logging and
  strict storage boundaries.
- **Hardware & media**: Arduino UNO Q edge monitor (`hardware/uno-q/`) with 3D-printable
  Desk Buddy enclosure (`hardware/enclosure/`), and promotional video assets in
  `promotional-video/`.

## What is coming

- The interactive demo page (time progression, package J) and the data protection /
  privacy page (`/privacy`, package P) are coming (currently listed as taken in
  `docs/tasks.md`), not done.
- Persistent clinic actions (recording nurse calls and booster offers from `/clinic`
  directly to storage) and patient suggestion card storage (packages C and D1).
- GAD-7 on the check-in screen and typed/voice answers on web check-in (packages D3 and I).
- Rewards and small tasks (D48, package F).

## Run it

Set up a fresh clone (starts local PostgreSQL, pushes schema, seeds sample clinic, nurse
and patients, and fetches MediaPipe face model):

```bash
npm install && npm run db:setup
```

Run the development server (starts the local database automatically):

```bash
npm run dev
```

Sign in: visit `/sign-in` and use the one-click simulated sign-in buttons for the sample
patients (`P-SIM-001`, `P-SIM-002`, `P-SIM-003`) or the clinic nurse
(`nurse@clinic.example.com`).

Stop the local database:

```bash
npm run db:stop
```

## Run the tests

- Unit tests: `npm test`
- Database integration tests (starts its own temporary database on a free port): `npm run test:db`
- Browser / end-to-end tests: `npm run test:e2e`
- Fast check gate (typecheck, lint, audit, unit tests): `npm run check`

## Work plan

The single list of what is on `main`, open trails, and taken versus free work packages is
in `docs/tasks.md`. Architectural decisions between alternatives are recorded as permanent,
immutable rows in `docs/decisions.md`. Full citations and evidence evaluations are
documented in `docs/research/`.
