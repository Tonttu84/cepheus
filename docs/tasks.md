# Work plan: what is done, what is taken, what is free

Updated against `main` (`9a6f01d`) on 15 Nov 2026, about 01:00. This is the one list
of open work for people and agents. Before you start anything, read it, fetch, and
check the open trails: two of us built the same sign-in protection in parallel on
14 Nov because neither list showed the other's work.

How to use it:

- **Taken** means a branch exists, published or not. Do not start the same work;
  build on that branch or ask its owner through `docs/requests.md`.
- **Free** means nobody has started. Take it by publishing a branch early (a draft
  trail is enough) and changing its line here in the same trail.
- When your trail merges, tick the item in that trail or the next one.

## On main

- Storage on PostgreSQL through Prisma (`src/server/db/`), individual questionnaire
  answers in memory only (D45), GAD-7 storage, consent events, the simulated mark.
- Domain rules and use cases: PHQ-9, GAD-7, the two taps, rounds, baselines, the
  warning rule, the crisis rule, flags, consent, rewards and small tasks (D48, logic
  only).
- Sign-in and protection: sealed session cookie, simulated e-ID for patients, staff
  sign-in, role-scoped navigation, protected pages and API routes, and their tests
  (P0.1 to P0.4 of the earlier list; trails 53 and 57).
- The Verda Gemma nurse brief (off by default, D44), the bedside unit's scripts and
  enclosure, the browser camera check.

What main does **not** do yet: no screen reads or writes the database through the
check-in API. The check-in, patient and clinic pages still show generated data.

## Open trails

| Trail | What | State |
| --- | --- | --- |
| 55 | Health Connect phone pairing | Reviewed, changes needed (findings on the trail): the pairing routes need a session now that sign-in is on main, and the webhook must store to the paired patient, not the fixed demo participant |
| 56 | Bedside unit: Bluetooth audio, spoken answers, live face check | Reviewed, changes needed (findings on the trail); still being tested on hardware |
| 53 | Sign-in | Contained in main through trail 57; can be closed |
| 58 | Patient state over time: a four-state trajectory, suggestions and clinic alarms across the forms, the bedside unit and the health data | Not reviewed yet. Touches suggestions and clinic alarms, so packages C and D1 below must build on it or wait for it |
| 59 | Adds task P1.4 to this file (passive consent switches default to off; device status shown apart from consent) | Not reviewed yet; P1.4 is listed below as package M |
| 60 | Monitoring, Fitbit and the Health Connect pairing bound to the signed-in patient | Not reviewed yet. Contains trail 55 and answers its findings; it also covers the Fitbit part of package H, which H therefore leaves out |

## Work packages

Order matters where "needs" says so. Everything marked taken is built on local
branches and goes up as trails as each passes the full gate and a cold review.

| # | Package | Covers | Needs | State |
| --- | --- | --- | --- | --- |
| A | **Core loop, one combined trail**: check-in and clinic API routes on the use cases; the seed with a clinic, a nurse and three simulated patients; `/check-in` and `/clinic` on the API; clinic routes for crisis alerts and nurse calls; the bedside unit's route on the shared use cases (D43) | P1.1 (check-in), P1.2 (storage and routes), P1.3 | main | Taken: `feat/wire-routes-v3`, `feat/functional-flow`, `feat/clinic-alerts-api`, `feat/kiosk-shared-routes`; rebased onto main, fixes in progress |
| H | **Sign-in follow-up**: staff code as a setting (default 123456, real time-based codes when a secret is set), input length limits, generic errors, one-click simulated sign-in, landing on the right page after sign-in, a test that fails when a route is added without a guard, 44 px touch targets (the Fitbit link is left to trail 60) | Review findings on trail 57 | main | Taken: `feat/sign-in-follow-up` |
| B | **Rounds close and the warning rule runs without an answer**: when staff read their flags, the server first closes elapsed rounds and runs the rule for that clinic's patients. Today the rule runs only when a patient answers, so a silent patient never raises a warning | Not in the earlier list | A (routes) | Taken: `feat/rule-on-clinic-read` |
| C | **Clinic screen wiring**: the card's buttons record a nurse call through the API; unacknowledged crisis alerts are shown and can be acknowledged; the nurse brief panel gets the flag's real numbers and accepts every warning kind (it accepts two of six today) | Rest of P1.2 | A | Free once A is published |
| D1 | **Patient page on storage**: the suggestion comes from storage, the card's two buttons save the choice, the consent switches write consent events | Rest of P1.1 | A | Free once A is published |
| D2 | **Camera check saves its derived numbers**: a route that accepts only the derived numbers, with the camera consent checked | Not in the earlier list | A (routes) | Taken: `feat/camera-reading-route` |
| D3 | **GAD-7 on the check-in screen** for patients it is assigned to; check both sample patients | P2.1 | A | Free once A is published |
| E | **Consistency**: one item id for crisis events (three are in use: "9", "item9SelfHarm", "crisis_button"); the sign-in unit test must not need a running database | Not in the earlier list | A for the id, H for the test | Free |
| F | **Rewards and small tasks** (D48): tables and storage, routes, the patient's page with the balance and the tasks they choose | P2.2 | D1 for the page | Taken: `feat/rewards-storage`, `feat/rewards-screens`; routes free |
| G | **Hardening**: security headers and a content security policy, stored values parsed on the way out, a test that logs carry no answers or codes; Fitbit calls get time limits and bounded retries | P2.3 | main | Taken: `feat/security-hardening`, `fix/fitbit-time-limits` |
| I | **Text and spoken answers on `/check-in`**, speech recognised in the browser on the device only | Owner's request | D3 (same screen) | Free |
| J | **Demo page**: move forward in time (never back), reset, switches for rewards and for counters; moving time forward closes rounds and runs the rule | Owner's request | A, B | Free |
| K | **Clean the generated data out of the screens** once every screen reads storage | Owner's request | C, D1, D3, F | Last |
| M | **Passive consent defaults and device status** (P1.4): default `ring_rhythm`, `camera_expressivity` and `home_routine` in `ensureHomeDemoParticipant` (`src/server/monitoring/store.ts`) to `enabled: false` (paused) until the patient opts in, matching D13 and `INITIAL_CONSENT_STATE`; show device connection status (connected or not) apart from the consent permission on `/monitoring` (`src/components/monitoring/consent-section.tsx`); update `monitoring.dbtest.ts` and `e2e/monitoring.spec.ts` to match | P1.4 | Trail 60 (same files) | Free; proposed by the author of trail 59 |
| L | **Full gate and rehearsal**: `npm run check && npm run test:db && npm run build && npm run test:e2e`, then the whole demo path on the device and in the browser | P2.4, P3.2 | everything | Last |

Choices made for these packages (say so on the trail if you disagree):

- B uses no background timer: closing rounds on the clinic's read is testable and
  enough for the demo; J triggers the same step.
- The one-time enrolment code screen (part of the earlier P1.2) is left out: sign-in
  is simulated and nothing uses the codes.
- Tables that nothing reads or writes yet (`EnrolmentCode`, `ActivitySample`,
  `SpeechReading`, `CognitiveGameReading`, `PatientSuggestion`; `PersonalBaseline` is
  only seeded, `ConsentEvent` only written) stay in the schema for now.

## Known gaps that belong to an open trail

- Home-sensor data (Fitbit, the phone webhook, the bedside unit's ingest) is stored
  to one fixed demo participant. Trail 55's pairing table is the intended way to tie
  a device to a patient; the bedside unit's lookup should move to it afterwards.
- `POST /api/monitoring/summary` returns a generated payload, not stored data.

## Running several gates on one machine

- The database port comes from each worktree's `.env` (`DATABASE_URL`), so database
  tests can run side by side on different ports. Export it before running:
  `set -a; . ./.env; set +a`. Worktrees that share one `node_modules` folder may
  otherwise read another worktree's address.
- The browser tests use the fixed port 3100: one worktree at a time.
- `npx prisma generate` writes into the shared `node_modules`: a branch that changes
  `prisma/schema.prisma` gates alone.
