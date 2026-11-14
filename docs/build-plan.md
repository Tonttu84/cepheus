# Build plan (proposal, open for comments)

Status 14 Nov 2026. How the software in `plan.md` is built: the modules, the order, the
tests, how the collected data is stored, and how it is protected. It covers the question
flow first (ask, warn, call); the ring and the camera keep the tables they already have.
The question set and the warning rule are in `questions.md`, which is on another open
trail. The owner's words, 14 Nov 2026: "Our main loop is quite simple so we need to have
good quality in the details, take care of compliance, medical data protections etc".

## What already exists

The foundation (workstream 1 of `plan.md`) is merged: a Next.js app with strict
TypeScript and Tailwind, a Prisma schema of 15 tables on SQLite, Zod schemas, the
generator for one simulated person's eight weeks with its seed, the crisis bar, shell
pages for the check-in, the camera, the patient and the clinic, and Vitest and
Playwright tests. `AGENTS.md` has its commands.

It was built before the decisions below and before the question set, so this plan
starts by bringing it onto them. Its review left one open finding, which step 2 closes:
the check-in expects four items scored 1 to 5, and the PHQ-9 has no unfinished state.

Checked on a second machine on 14 Nov: the install, the database setup with its seed,
the type-check, the lint, the 20 unit tests and the production build all pass. The
end-to-end tests were not run. The package audit reports five high-severity findings
and one moderate, in three places:

| Package | Finding | Fixed in | Where it matters |
|---|---|---|---|
| Zod 3 | Can run out of memory on oversized input | Zod 4, a breaking upgrade | On the path of every incoming request, since Zod validates the input |
| Next.js 15 | Four findings in a stylesheet tool it carries | Next.js 16, a breaking upgrade | At build time, on our own stylesheets only |
| Prisma 6 | One finding in its configuration tooling | A non-breaking update | On developers' machines |

## Decisions behind this plan

`decisions.md` is being changed on another open trail, so these rows are not added
there yet. They go in once that trail is merged. B1 to B6 are the owner's decisions of
14 Nov 2026, open to the team like D7 to D15. B7 to B11 are choices made while
planning, and are open in the same way.

| ID | Decision | Reason | Chosen against |
|---|---|---|---|
| B1 | The collected data is kept in one central database in the EU. The phone is only a screen: it sends each answer as it is tapped and keeps nothing but a sign-in cookie | The owner: "either safely on the phone or then it needs to be stored in EU, I imagine we would benefit from collecting the data so store it" | Keeping the data on the phone, which would leave nothing to check the rule against (`plan.md`, principle 6) |
| B2 | PostgreSQL. Replaces the SQLite part of D15; the rest of D15 stays. The merged foundation is moved over in step 1 | A hosted store with several users needs access rules in the database, encryption at rest and backups from the service. No supported way was found to encrypt SQLite through Prisma. The owner: "PostgreSQL is fine" | SQLite as a file beside the app |
| B3 | Patients are pseudonymous. Our database holds a random code for each patient and no name, phone number, email, date of birth or identity number. The clinic keeps the link between the code and the person in its own patient record. Clinic staff are named accounts | A leak then exposes answers attached to codes. The purpose, telling the clinic that one of its patients needs a call, needs no more than a code. The owner: "Pseudonymous" | An ordinary account system with names and contact details next to the answers |
| B4 | The patient agrees in three separate layers: taking part; each extra measuring method (D13); and the use of pseudonymous answers and outcomes to check the rule. The third is off until switched on, and care is the same without it | An unwell person should be able to take part in their care without agreeing to their data being studied. The owner: "Yes, separate" | One agreement that covers everything |
| B5 | The product's target is a managed PostgreSQL in Helsinki from a Finnish-owned provider (UpCloud). Until an account or credits exist, the hosting is simulated: the app runs in production mode against a real PostgreSQL, configured as it would be when hosted | Company and data centre are both in Finland, so the contested question of US-owned providers in EU regions does not arise. The owner: "Or we at least simulate the hosting" and "We can aim to host properly if we get credits" | A US-owned provider's EU region; paying for hosting before there is anything to host |
| B6 | pnpm as the package manager, switched on through Node's corepack. Replaces npm in the merged foundation, keeping its locked versions | It keeps one package store per machine, so each new worktree links its packages in seconds. The owner asked to "keep the big packages installed instead of removing installing and deploying all the time" | npm, which downloads into every worktree again |
| B7 | Sign-in uses Better Auth, pinned to an exact patched version, with only what we need switched on: password and a second factor for staff. No sign-in through other services and no emailed sign-in links | It is the maintained library; the older Auth.js gets security fixes only. Its two critical advisories of 2026 were in the parts we leave off | Writing our own sign-in; Auth.js; a hosted sign-in service, which would add another party holding data |
| B8 | Answers are not encrypted field by field. They are protected by pseudonymity, the service's encryption of disks and backups, and the access rules | Encrypted fields cannot be queried or counted, the one add-on for it is unmaintained, and an answer is a small number with no identity next to it | Field encryption of every answer |
| B9 | A stored fact is never changed afterwards: answers, missed rounds, agreements, warnings, calls. What can be worked out (round kinds, baselines) is computed by the tested functions. A warning is stored when raised, with the version of the rule that raised it. Deleting is a different thing and is allowed: when a patient asks, their rows are removed | Principle 6 needs every answer next to what happened afterwards, and a changed threshold must not rewrite history. The right to have one's data deleted comes first | Storing only current state; a store from which nothing can be removed |
| B10 | Developers and tests use a real PostgreSQL that arrives with the package install (`embedded-postgres`, which ships Windows, macOS and Linux builds). Nobody installs a database by hand | A machine checked for this plan had neither Docker nor PostgreSQL. Tests against the real engine check the same access rules that run when hosted | A different database for tests; asking each teammate to install one |
| B11 | Of the foundation's library versions, Prisma 6 and Vitest 3 stay for the weekend, with Prisma's non-breaking fix applied. Zod moves to version 4 in step 1. Whether Next.js moves to 16 is open point 6 | The foundation works and others are building on it, so nothing is upgraded without a reason. The audit is the reason for Zod, which sits on the path of incoming requests. Prisma 6 talks to PostgreSQL without the extra adapter and configuration file that version 7 requires | Upgrading everything during the weekend; leaving a high-severity finding in the input validator |
| B12 | Wearable and phone health data from Android Health Connect (and Apple Health on iOS) arrives through an existing open-source webhook companion app (`Life Dashboard Companion` or `Health Connect to Webhook`) posting to `POST /api/webhooks/health-connect`, authenticated by a per-patient HMAC-SHA256 secret paired by QR code (`research/9-health-connect-companion.md`) | The Oura app, Fitbit, Garmin and Samsung Health write sleep stages, steps, heart rate and HRV into Health Connect; receiving their webhook takes one route in our TypeScript repo (D15), keeps the patient pseudonymous (B3), and avoids building and getting Play Store approval for a custom Android APK | Building a custom Android companion app from scratch; requiring a per-vendor OAuth app for every wearable |

## Shape

The foundation keeps its shared code in `src/lib/`. New code goes into three layers
beside it. A layer may use the ones above it in this table and never the ones below;
a linter rule, added in step 1, enforces it.

| Layer | Folder | What it holds | Rule |
|---|---|---|---|
| Domain | `src/domain/` | The question sets, scoring, rounds, baselines, the warning rule, the crisis rule, what a flag may contain, the layers of agreement | Pure functions. No database, no network, no reading of the clock: the time is passed in |
| Use cases | `src/usecases/` | One function per thing a person does: submit a round, enrol a patient, record a call, switch a method off, delete my data | Calls the domain and the storage; checks access first |
| Server | `src/server/` | Storage, sign-in, access rules, the access log, messages to the clinic | The only code that touches the database or the network. The Prisma client in `src/lib/db.ts` may be imported only from here and from the seed |
| Screens | `src/app/` | The patient's screens and the clinic's screens | Validates input, calls a use case, shows the result |

The simulator in `src/lib/simulation/` stays where it is.

## Modules

| # | Module | What it does | Tests, written first |
|---|---|---|---|
| 1 | `domain/instruments` | The PHQ-9 and the two taps as data: items, answer options, scoring. The wording is data, so the PHQ-2 can replace the taps without new code | Totals; an incomplete PHQ-9 is not scored; answers outside the scale are rejected |
| 2 | `domain/rounds` | Which round is due for a patient's two chosen days and time; which rounds are PHQ-9 rounds; the one reminder; an answer that arrives late; "Not today"; an unfinished PHQ-9 offered again | Helsinki time across both clock changes; one reminder the next morning and never a second; a late answer counts for the missed round; "Not today" is stored apart from a missed round; "Not today" on a PHQ-9 round skips both; an unfinished PHQ-9 keeps its answers and comes back at the next round; two submissions of the same round store one answer |
| 3 | `domain/baseline` | The PHQ-9 baseline (first complete one; 10 or more tells the clinic); each tap's median over the first eight answered rounds | Fewer than eight rounds gives no baseline; unanswered rounds do not count |
| 4 | `domain/classify` | Each round is normal, low or no answer | Every row of the table in `questions.md`, before and after a baseline exists |
| 5 | `domain/warning` | The warning rule as a small state machine, with its version number | Every row of the rule table; all four two-round mixes; a normal round ends a run; the rule restarts after a recorded call |
| 6 | `domain/crisis` | The ninth PHQ-9 question is acted on the moment it is answered | Any answer other than "not at all" raises it, also in an unfinished questionnaire; it never waits for a score |
| 7 | `domain/flags` | A flag holds an area and a date, nothing else | The type has no field for an answer; the clinic's data is checked against it |
| 8 | `domain/consent` | The three layers, and which purpose each one allows | Each purpose against each combination of switches |
| 9 | `server/db` | One small storage interface per group of tables, over the schema in `prisma/` | Run against the real PostgreSQL: a stored fact cannot be changed; a deleted patient leaves no answers |
| 10 | `server/access` | The one place that decides who may read what and for which purpose, and writes the access log | A table of every actor against every kind of data, see "Protection" |
| 11 | `server/auth` | Staff sign-in; the one-time enrolment code that signs a phone in | Wrong, used and expired codes are refused; attempts are limited |
| 12 | `server/messages` | The crisis message and warnings as rows that the clinic's screen reads. Each is written in the same database step as the answer that caused it, and stays on the screen until a person acknowledges it. Nothing is sent outside the app in this build | An answer and its message are stored together or not at all; an unacknowledged message stays listed |
| 13 | `usecases` | The functions the screens call, each checking access, calling the domain and storing the result in one database step | Submitting a round stores the answer, the round kind, and any warning or crisis message together; each use case is refused for the wrong actor |
| 14 | Patient screens | Check-in (two taps, "Not today"), the PHQ-9, the crisis path on every screen, one suggestion, and a page showing what is recorded with its switches | End to end: a check-in in a few taps; the crisis path is present on every patient page; the ninth question shows it at once |
| 15 | Clinic screens | The list of flags, crisis messages, recording a call and its outcome, enrolling a patient | End to end: a flag shows area and date only; a call recorded by a nurse restarts the rule |
| 16 | The simulator (exists) | One simulated person's eight weeks, labelled as simulated wherever shown. To change: its answers follow the question set, and its warnings come from the real rule instead of being written in | The same seed gives the same weeks; the three demo moments appear when the rule runs over them |
| 17 | `app/api/webhooks/health-connect` | Webhook receiver (`POST /api/webhooks/health-connect`) for Health Connect companion apps (`Life Dashboard Companion` and `HC Webhook`): verifies the per-patient HMAC-SHA256 signature (`X-Signature`) or bearer token over the raw body, checks that the patient's wearable measurement switch is on, validates the payload with Zod, maps sleep stages, steps, calories, HR and HRV into `RingDay` (`source: "health_connect"`), and updates `RhythmWindow`; patient settings screen renders the 1-scan QR pairing link | Refuses bad or missing HMAC signature with 401; answers `"test": true` ping with 204 without storing data; refuses with 403 when the wearable consent switch is off; maps sleep stages into `sleepWakeGrid` and hourly steps into `hourlyActivityJson`; idempotent on repeated delivery |

When a message to the clinic is later sent outside the app, for example to whoever is on
call at night, that delivery gets a time limit, bounded retries and tests with a faked
failure, a faked slow answer and a faked refusal.

## What is stored

All times are stored in UTC with the patient's time zone beside them. Every table that
holds patient data carries the clinic it belongs to. The first group exists in the
foundation's schema; the last column says what step 2 changes.

| Table | Holds | What changes |
|---|---|---|
| `Participant` | One person: simulated, from an open dataset, or live | Becomes the pseudonymous patient (B3): a random code, the clinic, the enrolment date, the chosen days and time, the time zone. Age, gender and study scores stay only on rows from an open dataset or the simulator; a live patient never has them |
| `MeasurementConsent` | Which method is switched on | Keeps the current state. A new `ConsentEvent` holds each switch turned on or off, with the date and the version of the text shown, and covers all three layers (B4) |
| `CheckInRound` | Each scheduled round: answered, "Not today" or missed | Two taps scored 0 to 4, as in `questions.md`. Energy, rumination, the combined score, the single-item score and the free-text note go. So do the two self-harm fields: the two taps ask nothing about self-harm, which belongs to the PHQ-9 alone. Added: whether the reminder went out |
| `Phq9Assessment` | The nine answers and the total | Added: an unfinished state that keeps its answers, and the round it belongs to, so a late answer lands on the right round. Its "crisis path shown" field goes, since `CrisisEvent` records that |
| `PersonalBaseline` | A person's own usual values | Fits as it is |
| `PatientSuggestion` | That the one suggestion was shown and whether its button was pressed | The mood-before and mood-after fields go: no question is asked after a suggestion |
| `ClinicFlag` | A warning as the clinic sees it: the area and since when | Added: which kind raised it and the rule's version. A self-harm answer is no longer a kind of flag; it gets its own table. The two fields for a patient sharing details with the clinic stay but are not used: no screen in this build offers it, and access refuses it. D8 gives the clinic the area only; what the patient adds, they add in the call |
| `NurseCallRecord` | What the nurse found and which step followed, linked to its flag | Already matches the steps after a warning. The free-text note goes. Added: which staff member recorded it |
| Ring, activity, rhythm, camera, speech, game and routine tables | Derived numbers per day or per session | Unchanged. Never video or audio |

New tables:

| Table | Holds | Notes |
|---|---|---|
| `Clinic`, `StaffUser` | The clinic; named staff accounts with a role | The only names in the database |
| Sign-in tables | Sessions and what Better Auth needs | Generated by the library |
| `EnrolmentCode` | A one-time code, stored as a hash, with its expiry and when it was used | Issued by the clinic |
| `ConsentEvent` | See above | Never changed after it is stored |
| `CrisisEvent` | That the ninth question was answered with anything but "not at all", when, and when a person at the clinic acknowledged it | Separate from flags |
| `AccessLog` | Who read or changed which patient's data, for which purpose, and when | Holds no answers |
| `WebhookCredential` | A per-patient HMAC secret (or token hash) and last-seen sequence number for the Health Connect webhook route | Created when the patient switches wearable collection on; deleted if the patient switches it off or deletes their data |

No free text is stored anywhere in this build.

## Protection

Each measure uses something that exists and is maintained, and each has a test.

| Risk | Measure | Test |
|---|---|---|
| Someone signs in as someone else | Better Auth with a small surface (B7); a second factor for staff; cookies that scripts cannot read and that are sent only over an encrypted connection; sign-in attempts limited | Sign-in tests for wrong passwords, a missing second factor and too many attempts |
| A page or route is open to anyone | Every route needs a session, except the sign-in pages, a health check that returns no data, and `POST /api/webhooks/health-connect`, which requires a valid per-patient HMAC-SHA256 signature (`X-Signature`) or webhook token. The foundation's demo route returns simulated data only and is removed or closed when the screens read from the database | A list of every route, each asserted to refuse a request without a session or valid webhook signature |
| A patient reads another patient's data | Every read goes through `server/access` with the signed-in actor | Patient A asking for patient B's data is refused |
| Staff of one clinic read another clinic's patients | Every table carries its clinic, and access checks it | A nurse of clinic X is refused clinic Y |
| The clinic sees more than a flag | A nurse may read flags, crisis messages and call outcomes, and never the answers (D8). The flag type has no place for an answer | The clinic's screens and responses are checked to contain no answer |
| Data is used for a purpose the patient did not agree to | Every read states its purpose; access refuses a purpose whose switch is off (B4) | A read for checking the rule is refused until the third layer is on |
| A mistake in the app's checks | Proposed second barrier: row-level rules in the database that repeat the clinic and patient checks. How to do this through Prisma is to be confirmed in step 5 | The same refusals, tested with the app's checks bypassed |
| Nobody can tell who looked | The access log, written by the same code path as the read | Every read of patient data by staff leaves a row |
| Bad input | Zod at every boundary: forms, server actions, environment variables | Missing, null, duplicate and out-of-range values |
| Requests forged from another site | Next.js checks the origin of server actions; cookies are limited to our own site | A request from another origin is refused |
| Injected scripts | A content security policy with a fresh value per request, as the Next.js documentation describes; no outside scripts | The headers are asserted on each main page |
| The crisis message is lost | It is stored in the same database step as the answer and stays on the clinic's screen until a person acknowledges it. The patient's screen shows the crisis path whether or not the clinic has seen the message | Module 12's tests |
| Health data in logs | Logs carry event ids, never answers or codes | A test reads the log output of a full round |
| Data sent to an outside AI | The app has no AI library and calls no AI service. No AI takes part in the rule | The gate fails if such a dependency appears |
| Secrets in the repository | Environment variables only, listed with empty values in `.env.example` and checked at start | The app refuses to start with one missing |
| A vulnerable package | Exact versions, a lockfile, and an audit of known vulnerabilities in the gate. A finding that is knowingly left open is listed in the repository with its reason | The gate fails on a high-severity finding that is not on that list |
| A lost or stolen database copy | The service encrypts disks and backups (B5); the rows are pseudonymous (B3) | Not testable here; checked when hosting is set up |
| Withdrawal is not honoured | Switching a layer off stops collection at once. When a patient asks for deletion, their rows are removed; what stays is the access log, which holds no answers | After deletion, no answer of that patient can be read by any path |

Named but not built this weekend, and said so in the pitch: a data protection impact
assessment, the processing agreement with the host, retention periods, a breach
procedure, and how the clinic keeps the link between code and person.

## Tests and the gate

- The domain is written test first. Each row of the tables in `questions.md` becomes a
  test with that row's words as its name, so the document and the tests can be compared
  line by line.
- Storage and access are tested against the real PostgreSQL (B10), not a stand-in.
- The two main paths are tested end to end with Playwright, with an accessibility check
  on each screen: anything asked of an unwell person must be easy to read and to tap.
- After each module lands, a different agent hardens its tests: time zones, and missing,
  null, duplicate and out-of-range values.
- No test is weakened or skipped to pass. A wrong test is reported and fixed as its own
  change.

The foundation's commands stay: `check` (type-check, lint, unit tests), `build` and
`test:e2e`. Step 1 adds the layer rule and a package audit to `check`, and a `test:db`
command for the storage and access tests. `AGENTS.md` is updated in the same trail.

## Order

Each step is its own trail with its own review. Steps named in "Can run beside" touch
different folders and can be built at the same time.

| Step | What | Delivers | Needs | Can run beside |
|---|---|---|---|---|
| 1 | PostgreSQL and tooling | The schema on PostgreSQL with the local database from the package install (B2, B10); pnpm (B6); Zod 4 and Prisma's fix (B11); the audit in the gate; the layer rule; the environment check; `test:db` | | 3, 4 |
| 2 | The schema onto the decisions | The changes under "What is stored" and the new tables, with everything that reads the changed fields adjusted in the same step so the gate stays green: the Zod schemas, the simulator and seed, the shell pages, the demo route and their tests. Closes the open finding on the foundation's review | 1 | 3, 4 |
| 3 | The rule | Modules 1 and 3 to 8 | | 1, 2, 4 |
| 4 | Rounds | Module 2 | | 1, 2, 3 |
| 5 | Storage, access, use cases and messages | Modules 9, 10, 12 and 13. They go together because a use case stores an answer and its message to the clinic in one database step | 2, 3, 4 | |
| 6 | Sign-in | Module 11 | 5 | 7, 8 |
| 7 | Patient screens | Module 14 | 5 | 6, 8 |
| 8 | Clinic screens | Module 15 | 5 | 6, 7 |
| 9 | The demo path | Module 16: the three demo moments, produced by the real rule, with the live camera reading if the camera page is ready | 7, 8 | 11 |
| 10 | A security review of the whole | Findings, fixed as their own changes | | |
| 11 | Health Connect webhook | Module 17: `POST /api/webhooks/health-connect`, QR pairing link on the patient settings page, and mapping into `RingDay` and `RhythmWindow` | 5, workstream 3 | 6, 7, 8, 9 |

Steps 3 and 4 are workstream 3's routing rule and the logic of workstream 2 in
`plan.md`; steps 7 and 8 are workstreams 2 and 5.

Two workstreams of `plan.md` run beside this plan and are not broken into modules here:

| Workstream | What | Needs | Meets this plan at |
|---|---|---|---|
| 3, signal maths | Rhythm, sleep regularity and personal-baseline functions for the ring, as pure functions in `src/domain/` | Only the tables that exist | Step 9: the ring's history in the demo |
| 4, camera check | The page measuring facial expressivity and head movement in the browser | Only the tables that exist; its content security policy needs are listed under "Not checked" | Step 9: the live reading in the demo |

The final submission is on Sunday at 10:00. If time runs short, these are cut first, in
this order, and the pitch says so: the second barrier in the database, the second factor
for staff, the content security policy. These are never cut: the crisis path, the access
checks, the label on simulated data, and the tests for the rule.

## Open points for the team

1. Is the live demo measurement stored? Proposal: yes, under a demo patient that is
   labelled as demo data, with a delete button that shows deletion working.
2. Staff sign in with a password and a code from an authenticator app. Is that right for
   a clinic, or does it already have a sign-in we should fit into?
3. The second barrier in the database (row-level rules): part of step 5, or only if time
   allows? Proposal: part of step 5, since it is the kind of detail this plan is for.
4. How does a reminder reach the phone without a phone number? Proposal: a browser
   notification later; in the demo the reminder is shown as a state on the screen.
5. The two taps or the PHQ-2 (`questions.md`, open point 1). Either fits, since the
   wording is data.
6. Should Next.js move from 15 to 16 now, while the app is small? The audit's four
   findings there are in a build tool that handles only our own stylesheets. Proposal:
   try the upgrade in step 1 with Next.js's own migration tool; if it is not clean
   within that step, stay on 15 and list the findings as knowingly left open.
7. Moving from npm to pnpm changes the commands everyone types (B6). Does the teammate
   who built the foundation agree?
8. Who builds which step?

## For someone who knows Finnish health law

None of these was confirmed in our searches. The design works under either answer to
the first two.

1. Would a clinic rest "taking part" on consent or on its legal basis for giving care?
2. What do Finland's rules on the secondary use of health data require for the third
   layer, checking the rule?
3. Is an enrolment code from the clinic enough to identify a patient's phone, or is
   strong electronic identification required?
4. Must a product like this be registered as a health-care information system and
   joined to the national patient data services?
5. Is processing inside the EU required by a Finnish rule, beyond what GDPR asks?
6. How long must the answers, the warnings and the access log be kept, and by whom:
   is the clinic the controller and we its processor?

## Not checked

- Whether Better Auth's own parts cover a one-time enrolment code for a pseudonymous
  patient, or whether that needs a small piece of our own on top of its sessions, and
  whether its Prisma adapter works with Prisma 6. Step 6 starts by finding out.
- Whether `embedded-postgres` runs cleanly on every teammate's machine. It was not
  installed for this plan. The fallback is a hosted development database with simulated
  data only.
- Row-level rules through Prisma need a setting per database transaction; the exact way
  is to be confirmed in step 5.
- The content security policy that the camera's in-browser model will need.
- UpCloud's prices and trial terms: its own pages disagree with each other.
- The Finnish wording of the PHQ-9 that clinics use. The official source says of its
  questionnaires that "no permission is required to reproduce, translate, display or
  distribute them" (https://www.phqscreeners.com/select-screener); the app starts with
  the official English text.
