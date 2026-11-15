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
- Camera input is processed entirely on the device; only derived numbers
  are stored, never video or image frames. Spoken answers store no audio
  recordings or transcripts (the strict on-device voice gate arrives with
  463917e).
- No real patient data: all data in the repository and interface is simulated or from open
  research datasets, and simulated data is labelled wherever it is shown.
- Crisis path: anything asking about mood or self-harm shows a direct human crisis path
  to emergency help and 24/7 human crisis support with nothing automated in between.

## What it does today

- **Check-in flow (`/check-in` & bedside unit)**: twice-weekly mood and interest taps
  with word-labelled tactile pills ('Very low'..'Very good', 'Not at all'..'Very
  much'), fortnightly PHQ-9, and skip option ("Not today"). Spoken answers via browser
  Web Speech API and typed input, mapped deterministically to choices; crisis words
  immediately display human emergency help links. Transcripts are parsed in memory
  and dropped; no audio recordings or transcripts are stored. Bedside voice check-in
  (Arduino UNO Q) answers rounds via shared use cases (D43). Answers are validated,
  access-checked, and saved to PostgreSQL through transactional use cases
  (`src/usecases/`). Individual questionnaire answers are kept in memory only; only
  aggregate status, scores, and derived states are stored (D45). Immediate crisis trigger
  on any non-zero response to PHQ-9 question 9 or the bedside crisis button, displaying
  human emergency help and alerting the clinic.
- **Patient suggestions & guided activities (`/patient`)**: patient suggestion card with
  a guided activity widget offering a 10-minute gentle walk timer and an animated
  3-minute paced breathing circle, designed with zero streaks or scores (runs on
  simulated state; database storage wiring merges on 15 Nov).
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

## Built, merging on 15 Nov

Two feature branches will merge shortly.

From branch `463917e`:
- GAD-7 anxiety questionnaire rotating on the check-in screen (`/check-in`).
- Strict on-device voice gate (`src/components/check-in/on-device-speech.ts`):
  verifies local speech processing support before enabling microphone input,
  refusing cloud transcription.
- Direct human crisis help alert sent to the clinic from the check-in screen
  (`/api/check-in/crisis`).
- Interactive demo page (`/demo`) with time progression (advance hours or days,
  reset clock, switch sample patient).
- Privacy page (`/privacy`) and data protection documentation (`docs/privacy/`).

From branch `068cc31`:
- Persistent clinic actions: recording nurse call outcomes and booster offers
  directly to PostgreSQL storage from `/clinic` (`/api/clinic/nurse-calls`).
- Patient suggestion card wired to database storage (`/api/patient/suggestion`).
- Rewards page (`/rewards`) with simulated payouts, ledger balances, and small
  everyday tasks with "done" and "not today" options (zero streaks or punishment).
- Camera kinematics readings saved to PostgreSQL (`/api/camera/readings`).
- Layered consent screen (`/consent`) asking for consent in steps on a patient's
  first sign-in.

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
patients (`P-SIM-001`, `P-SIM-DEP-01`, `P-SIM-ANX-01`) or the clinic nurse
(`nurse@sim-clinic.local`).

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
