# Work plan: what is done, what is taken, what is free

Updated against `main` (`814c3bd`) on 15 Nov 2026, about 04:00. This is the one list
of open work for people and agents. Before you start anything, read it, fetch, and
check the open trails: two of us built the same sign-in protection in parallel on
14 Nov because neither list showed the other's work.

How to use it:

- **Taken** means a branch exists, published or not. Do not start the same work;
  build on that branch or ask its owner through `docs/requests.md`.
- **Free** means nobody has started. Take it by publishing a branch early (a draft
  trail is enough) and changing its line here in the same trail.
- **Keep it true.** Every trail that does something from this list changes the list
  in the same trail: the package's state, the "On main" section, the open trails,
  and the date and commit in the first line. When you merge someone else's trail,
  update the list in your next trail. A list that is one merge behind is how the
  duplicate work happened.

## On main

- Storage on PostgreSQL through Prisma (`src/server/db/`), individual questionnaire
  answers in memory only (D45), GAD-7 storage, consent events, the simulated mark.
- Domain rules and use cases: PHQ-9, GAD-7, the two taps, rounds, baselines, the
  warning rule, the crisis rule, flags, consent, rewards and small tasks (D48, logic
  only).
- Sign-in and protection: sealed session cookie, simulated e-ID for patients, staff
  sign-in, role-scoped navigation, protected pages and API routes, and their tests
  (P0.1 to P0.4 of the earlier list; trails 53 and 57).
- Sign-in follow-up (package H): one-click simulated sign-in for patients and staff,
  the staff code as a setting (default 123456; real time-based codes when
  `STAFF_TOTP_SECRET` is set), input length limits, the same error for a wrong email
  and a wrong password, a test that fails when an API route is added without a
  guard, the Fitbit link tied to the signed-in patient and cleared on sign-out, and
  44 px touch targets in the header.
- The Verda Gemma nurse brief (off by default, D44), the bedside unit's scripts and
  enclosure, the browser camera check.
- The bedside unit's voice check-in (trail 56): Bluetooth headphone audio, spoken
  answers recognised on the device, a camera check while the questions are asked.
  Tested without hardware only.
- This work plan and the pointer to it in `AGENTS.md` (trails 59 and 61).
- Monitoring, Fitbit, and Health Connect QR pairing/webhooks bound to authenticated sessions (trail 60, containing trail 55).
- Passive consent defaults (`ring_rhythm`, `camera_expressivity`, `home_routine` start paused `false` until opted in) and separate device connection status on `/monitoring` (package M / P1.4, trails 65 and 68).
- Hardening (package G, trail 67): security headers and a content security policy on every
  route (strict in production; the development server additionally gets what Fast Refresh
  needs), stored warning kinds and call positions parsed on the way out of the database, a
  test that scans the source for raw logging, time limits and bounded retries on Fitbit
  calls, and database tests that pick a free port.
- The promotional video for the submission (`promotional-video/`, trail 64): a backup of the
  clips and the plan, no code.

What main does **not** do yet: no screen reads or writes the database through the
check-in API. The check-in, patient and clinic pages still show generated data. All of
that is built and waiting to merge, in this order, one merge at a time: the core loop
(A and B), then check-in with the demo page (D3, I, J), then clinic with the patient
page and rewards (C, D1, F). See the packages below before starting anything near them.

## Open trails

| Trail | What | State |
| --- | --- | --- |
| 58 | Patient state over time: a four-state trajectory, suggestions and clinic alarms across the forms, the bedside unit and the health data | Reviewed, to be reworked (findings on the trail): keep the formula as a read-only view computed from what the use cases stored, on top of package A |
| 66 | Work plan: patient UX packages N and O | Its content is carried into this file (rows N and O below); the trail conflicts with later edits here and can be closed |

## Who knows which area

Most conflicts on 14 and 15 Nov came from two people changing the same area at the
same time without knowing of each other. The work is done by agents and anyone may
change anything, so this table is not about permission: it says who knows each area
best, named by the trails they wrote (no names in files). Before changing an area,
check their open trails and build on them; after changing it, tell them with a
request in `docs/requests.md` or a finding on their trail.

Merging: `main` takes one merge at a time. Branches that are waiting may be combined
with each other first, whoever wrote them, so conflicts are solved once; say on each
trail what was combined.

| Area | Paths | Knows it best |
| --- | --- | --- |
| Devices and home monitoring | `hardware/uno-q/`, `src/app/api/arduino/`, `src/app/api/fitbit/`, `src/app/api/webhooks/`, `src/app/api/monitoring/`, `src/server/monitoring/`, `src/server/fitbit/`, `src/domain/health-connect/`, `src/app/monitoring/`, `src/components/monitoring/` | Author of trails 55, 56 and 60 |
| Sign-in, session and the page shell | `src/server/auth/`, `src/app/api/auth/`, `src/app/sign-in/`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/site-nav.tsx`, `src/components/header-auth-control.tsx`, `src/components/auth-*.tsx` | Author of trail 57 |
| Storage and schema | `prisma/schema.prisma`, `src/server/db/` | Author of trail 47 |
| Check-in, the clinic loop and the rules | `src/domain/` (except `health-connect`), `src/usecases/`, `src/server/api/`, `src/app/api/check-in/`, `src/app/api/clinic/`, `src/app/check-in/`, `src/app/clinic/`, `src/app/patient/`, `src/app/camera/`, and this file | Author of trail 61 |
| Enclosure | `hardware/enclosure/` | Author of trail 45 |

Files that every feature tends to touch, and how to keep out of each other's way:

- **Pages** (`src/app/**/page.tsx`): a feature adds its own component under
  `src/components/` and the page only places it. Do not rewrite a page to add a
  feature.
- **The schema**: additive changes only, one trail at a time, agreed with the owner
  of storage first.
- **The database**: only `src/server/db/` talks to it. A feature reads and writes
  through the use cases and ports in `src/usecases/`. A test in the gate
  (`src/__tests__/storage-boundary.test.ts`) fails when a new file outside
  `src/server/db/` imports the database client; the few existing exceptions are
  listed in the test and may only shrink.
- **Browser-test helpers** (`e2e/helpers.ts`): extend it; do not add a second helper
  file.

## Work packages

Order matters where "needs" says so. Everything marked taken is built on local
branches and goes up as trails as each passes the full gate and a cold review.

| # | Package | Covers | Needs | State |
| --- | --- | --- | --- | --- |
| A | **Core loop, one combined trail**: check-in and clinic API routes on the use cases; the seed with a clinic, a nurse and three simulated patients; `/check-in` and `/clinic` on the API; clinic routes for crisis alerts and nurse calls; the bedside unit's route on the shared use cases (D43) | P1.1 (check-in), P1.2 (storage and routes), P1.3 | main | Taken: `feat/core-loop`, combined with B and rebased onto main. Check, build and database tests pass; 3 of 29 browser tests fail (the clinic screen is empty for a freshly seeded nurse, the empty state for another clinic, the simulated bedside voice check-in without an open round) and are being fixed. Merges first |
| H | **Sign-in follow-up**: staff code as a setting (default 123456, real time-based codes when a secret is set), input length limits, generic errors, one-click simulated sign-in, landing on the right page after sign-in, a test that fails when a route is added without a guard, 44 px touch targets, and the Fitbit link tied to the signed-in patient (trail 60 touches the same Fitbit routes: when it merges, keep this handling) | Review findings on trail 57 | main | **Done, on main** |
| B | **Rounds close and the warning rule runs without an answer**: when staff read their flags, the server first closes elapsed rounds and runs the rule for that clinic's patients. Today the rule runs only when a patient answers, so a silent patient never raises a warning | Not in the earlier list | A (routes) | Taken: on `feat/core-loop` with A |
| C | **Clinic screen wiring**: the card's buttons record a nurse call through the API; unacknowledged crisis alerts are shown and can be acknowledged; the nurse brief panel gets the flag's real numbers and accepts every warning kind (it accepts two of six today) | Rest of P1.2 | A | Taken: `feat/pk-clinic`, built and reviewed; being combined with D1 on `feat/clinic-patient`. The flag card shows why a flag was raised (kind, a questionnaire's total and its change, missed rounds) and, as supporting lines only, home-monitoring facts |
| D1 | **Patient page on storage**: the suggestion comes from storage, the card's two buttons save the choice, the consent switches write consent events | Rest of P1.1 | A | Taken: `feat/pk-patient`, built and reviewed; being combined with C on `feat/clinic-patient`. A small dip now stores a suggestion |
| D2 | **Camera check saves its derived numbers**: a route that accepts only the derived numbers, with the camera consent checked | Not in the earlier list | A (routes) | Free: the branch `feat/camera-reading-route` holds only the routes base, the camera route itself was never written |
| D3 | **GAD-7 on the check-in screen** for patients it is assigned to; check both sample patients | P2.1 | A | Taken: `feat/pk-checkin`, built and reviewed; combined with J on `feat/checkin-demo` |
| E | **Consistency**: one item id for crisis events (three are in use: "9", "item9SelfHarm", "crisis_button"); the sign-in unit test must not need a running database | Not in the earlier list | A for the id; sign-in test part done in H | Sign-in unit test verified DB-free (`auth.test.ts` + `route-guards.test.ts`); crisis `itemId` still waits on A |
| F | **Rewards and small tasks** (D48): tables and storage, routes, the patient's page with the balance and the tasks they choose | P2.2 | D1 for the page | Taken: `feat/pk-rewards`, built and reviewed: storage, earning from answered rounds (web and bedside), a simulated payout at 10 euros, routes, a `/rewards` page with the counters. Joins `feat/clinic-patient` last |
| G | **Hardening**: security headers and a content security policy, stored values parsed on the way out, a test that logs carry no answers or codes; Fitbit calls get time limits and bounded retries | P2.3 | main | **Done, on main** (trail 67) |
| I | **Text and spoken answers on `/check-in`**, speech recognised in the browser on the device only | Owner's request | D3 (same screen) | **UI on this branch** (`feat/check-in-voice-text`, trail 73: modular `CheckInVoiceInput`); clinic crisis alert & GAD-7 stay on `feat/pk-checkin` (`feat/checkin-demo`) |
| J | **Demo page**: move forward in time (never back), reset, switches for rewards and for counters; moving time forward closes rounds and runs the rule | Owner's request | A, B | Taken: `feat/pk-demo`, built and reviewed; combined with D3 and I on `feat/checkin-demo` |
| K | **Clean the generated data out of the screens** once every screen reads storage | Owner's request | C, D1, D3, F | Last |
| M | **Passive consent defaults and device status** (P1.4): default `ring_rhythm`, `camera_expressivity` and `home_routine` in `ensureHomeDemoParticipant` (`src/server/monitoring/store.ts`) and `ensureParticipantConsents` (`src/server/db/monitoring/session-scope.ts`) to `enabled: false` (paused) until the patient opts in, matching D13 and `INITIAL_CONSENT_STATE`; show device connection status (connected or not) apart from the consent permission on `/monitoring` (`src/components/monitoring/consent-section.tsx`); update `monitoring.dbtest.ts` and `e2e/monitoring.spec.ts` to match | P1.4 | Trail 60 (on main) | **Done, on main** (trails 65 and 68) |
| N | **Calm unified patient "Today" UX & copy trim**: combine the signed-in patient's daily flow into one calm view (open check-in -> auto-advance or "Not today" -> instant confirmation or gentle suggestion), tuck `/camera` and `/monitoring` under a quieter "Sensors & Setup" menu rather than 5 daily tabs, cut ~70% of clinical/demo header copy on `/check-in` and `/patient`, and keep `Simulated data` as a quiet badge instead of static preview banners (already supported by A, D1, and F for live flow + gentle milestones) | Patient UX review | A, D1 | Free; proposed |
| O | **Word-labelled tap pills & interactive guided suggestion tools**: replace cold `0..4` numeric tap boxes in `src/components/check-in-interactive.tsx` with tactile word labels (`Very low`, `Low`, `Okay`, `Good`, `Very good` mapped to `0..4` underneath, auto-advancing between taps), and add an interactive 3-minute paced breathing circle (`breathing_space`) and 10-minute gentle walk timer (`short_walk`) inside `src/components/patient-suggestion-card.tsx` when `"I'll try this today"` is tapped | Patient UX review | main (coordinate with I, F) | **Done, on main** (trail 70) |
| P | **Data protection page and documents**: a data inventory from the schema and the code, a checklist of how the build meets the requirements (designed in, required of a deployment, not done), mock policies for the patient and the clinic, why the rewards stay simulated (tax reporting in Finland), what a real deployment requires (certified EU hosting, no transfers), and a public `/privacy` page | Owner's request | main | Taken: `feat/privacy-page` |
| Q | **Phone demo**: one laptop on the clinic and demo view, one phone using the patient pages as the app: the patient pages checked at phone width, the server reachable from a phone on the same network (session cookie, same-origin checks, the security policy), a QR code on the demo page | Owner's request | D3, D1, F, J | Free |
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

- Data from the bedside unit's ingest, and from a phone that uses the static secret
  without a pairing token, is still stored to one fixed demo participant. The
  pairing table (on main since trail 60) is the intended way to tie a device to a
  patient; the bedside unit's lookup should move to it.
- Home-monitoring values reach no rule and no clinic screen yet. Decided on 15 Nov:
  they go on the nurse's flag card as supporting facts only (package C).
- `POST /api/monitoring/summary` returns a generated payload, not stored data.

## Running several gates on one machine

- The database port comes from each worktree's `.env` (`DATABASE_URL`), so database
  tests can run side by side on different ports. Export it before running:
  `set -a; . ./.env; set +a`. Worktrees that share one `node_modules` folder may
  otherwise read another worktree's address.
- `npm run test:db` starts its own temporary database on a free port, so several
  worktrees can run it at the same time. It needs no `db:start`.
- The browser tests use the fixed port 3100: one worktree at a time. On a loaded
  machine start the server first (`npx next dev --port 3100`) and then run
  `npx playwright test`, which reuses it; otherwise the 120 s start limit can fail
  the run before a test has started.
- An agent must not start a database or a server from its own shell: with some
  agent tools the command never returns and the run hangs without a message.
- `npx prisma generate` writes into the shared `node_modules`: a branch that changes
  `prisma/schema.prisma` gates alone.
