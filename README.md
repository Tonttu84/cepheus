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

## Features

### Built and tested

- Validated instruments (`src/domain/instruments`): official English PHQ-9 wording and
  scoring, and twice-weekly two-tap check-in prompts (mood and interest).
- Scheduling and rounds (`src/domain/rounds`): twice-weekly rounds in Helsinki time with
  daylight saving support, fortnightly PHQ-9 rounds, next-morning reminders, late answers,
  and deliberate "Not today" skips.
- Personal baselines (`src/domain/baseline`): tap medians over the first eight answered
  rounds, and initial PHQ-9 baseline calculation.
- Round classification (`src/domain/classify`): pure logic classifying each round into
  normal, low, or unanswered based on score drops or baseline offsets.
- Crisis trigger logic (`src/domain/crisis`): immediate trigger on any non-zero response
  to PHQ-9 question 9, including during an unfinished questionnaire.
- Privacy rules (`src/domain/flags`, `src/domain/consent`, `src/domain/access`): clinic
  flags limited to broad life areas and dates, three-layer consent controls, and a unified
  `decideAccess` permission table.
- Circadian signal mathematics (`src/domain/signals`): pure functions for non-parametric
  rhythm analysis (interdaily stability, intradaily variability, relative amplitude, sleep
  regularity index) and rolling personal baselines.
- On-device camera kinematics (`src/domain/camera`): head pose estimation (yaw, pitch,
  roll), angular velocity paths, and facial expressivity blendshape statistics.
- Sensor integrations (`src/domain/fitbit`, `src/domain/health-connect`,
  `src/domain/arduino`): Fitbit OAuth2 PKCE client and mapper, Android Health Connect and
  Apple Health webhook mapper with per-participant QR / companion-app pairing on
  `/monitoring` (see [docs/health-connect-setup.md](docs/health-connect-setup.md)), and
  Arduino UNO Q edge validation rejecting raw media.
- Security controls (`src/server/security/`): AES-256-GCM encrypted session cookies,
  HMAC-SHA256 webhook verification, proxy-safe rate limiting, and strict input validation.
- User interfaces (`src/app/`, `src/components/`): an interactive on-device camera check
  session, a passive sensor monitoring dashboard, and a three-moment demo preview (well,
  small dip, sustained drift).
- Automated tests: unit test suites covering domain calculations, access rules, security,
  and Playwright browser tests for main pages.

### Built, not yet connected to the screens

- Application use cases (`src/usecases/`): transactional operations for `submitTaps`,
  `submitNotToday`, `submitPhq9Answer`, `getCheckInState`, `closeElapsedRounds`, and
  `evaluatePatient` check access, verify consent, and write audit logs. No screen or
  component under `src/app` or `src/components` imports `src/usecases`.
- Warning rule engine (`src/domain/warning`, `src/domain/history`): the multi-round rule
  that flags sustained dips (two consecutive non-normal rounds), initial PHQ-9 scores of
  10 or more, or silence to the clinic. It is tested in isolation but not yet wired to UI
  actions.
- Check-in screen (`src/app/check-in/`): an interactive visual prototype showing the
  four-prompt check-in cards and a "Not today" skip button. It is a front-end shell that
  does not save answers to the database.
- Clinic and patient action buttons: buttons to request a nurse call or offer a booster
  on `/clinic`, and buttons to accept a suggestion on `/patient`, render simulated state
  and are not wired to persistent storage.

### Decided, not built

- Rotating extra question (Decision D25): at most one optional question per round from a
  curated set on a 0 to 4 scale, off by default, marked experimental, and excluded from
  the warning rule.
- Patient direct messaging (Decision D26): an option for the patient to send a note to the
  clinic about matters not covered in check-ins, read by a person, with crisis guidance
  beside it.
- Server-side urgency screening (Decision D27): an internal server model to flag patient
  messages as possibly urgent to elevate their priority, without delaying or summarising.
- Pseudonymous authentication (Decisions D20, B7): staff login and one-time patient
  enrolment codes managed via Better Auth.
- Managed database hosting (Decision D18): deployment to a managed PostgreSQL in Helsinki
  from a Finnish-owned provider (currently simulated with a local development database).
- Note on unadopted ideas: strong electronic identification and an anxiety questionnaire
  were raised in preliminary planning and research, but were not adopted as decisions in
  `docs/decisions.md` on this branch.

## How it is built

The application is built with Next.js 15 (App Router), strict TypeScript, and Tailwind CSS.
Data is stored in PostgreSQL via Prisma with Zod schema validation. MediaPipe Face
Landmarker runs in the browser using WebAssembly. Signal calculations are implemented as
pure TypeScript functions tested with Vitest, and browser paths are verified with
Playwright.

| Directory | Contents and architectural role |
| --- | --- |
| `src/domain/` | Pure logic: instruments, rounds, signal maths, consent, access rules |
| `src/usecases/` | Application use cases checking access and coordinating domain rules |
| `src/server/` | Database persistence, security helpers, Fitbit client, monitoring store |
| `src/app/` | Next.js screens, prototypes, and API routes for sync and ingest |
| `hardware/` | Arduino UNO Q edge monitor (`hardware/uno-q/`) and 3D-printable Desk Buddy enclosure (`hardware/enclosure/`) |
| `docs/` | Architecture plans, decisions (`docs/decisions.md`), and research checks |

## Run it

Set up a fresh clone:

```bash
npm install && npm run db:setup
```

Run the development server (starts the local database automatically):

```bash
npm run dev
```

Stop the local database:

```bash
npm run db:stop
```

Run the full verification gate before publishing a branch:

```bash
npm run check && npm run test:db && npm run build && npm run test:e2e
```

## How we work

Every change is developed on a separate branch, published as an Entire trail, reviewed by
someone who did not write it, and merged after approval. Architectural decisions between
alternatives are recorded as permanent, immutable rows in `docs/decisions.md`. AI coding
agents write most of the code from written briefs, a separate agent reviews each change
cold, and tests are written first for all domain logic.

## Safety

The crisis path is visible on every screen at all times, providing direct telephone and
online links to emergency services and 24/7 human crisis support with nothing automated
in between. Any check-in response indicating thoughts of self-harm triggers immediate
crisis guidance and alerts the clinic. Where clinical evidence for sensor measures is thin,
the system states so explicitly, treating them as supporting context rather than diagnostic
signals; full citations and evidence evaluations are documented in `docs/research/`.
