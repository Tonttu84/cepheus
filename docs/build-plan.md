# Build plan (proposal, open for comments)

Status 14 Nov 2026. How the software in `plan.md` is built: the modules, the order, the
tests, how the collected data is stored, and how it is protected. It covers the question
flow first (ask, warn, call); the ring and the camera join later through the same
storage. The question set and the warning rule are in `questions.md`, which is on
another open trail. The owner's words, 14 Nov 2026: "Our main loop is quite simple so we
need to have good quality in the details, take care of compliance, medical data
protections etc".

## Decisions behind this plan

`decisions.md` is being changed on another open trail, so these rows are not added
there yet. They go in once that trail is merged. B1 to B6 are the owner's decisions of
14 Nov 2026, open to the team like D7 to D15. B7 to B10 are choices made while
planning, and are open in the same way.

| ID | Decision | Reason | Chosen against |
|---|---|---|---|
| B1 | The collected data is kept in one central database in the EU. The phone is only a screen: it sends each answer as it is tapped and keeps nothing but a sign-in cookie | The owner: "either safely on the phone or then it needs to be stored in EU, I imagine we would benefit from collecting the data so store it" | Keeping the data on the phone, which would leave nothing to check the rule against (`plan.md`, principle 6) |
| B2 | PostgreSQL. Replaces the SQLite part of D15; the rest of D15 stays | A hosted store with several users needs access rules in the database, encryption at rest and backups from the service. No supported way was found to encrypt SQLite through Prisma. The owner: "PostgreSQL is fine" | SQLite as a file beside the app |
| B3 | Patients are pseudonymous. Our database holds a random code for each patient and no name, phone number, email, date of birth or identity number. The clinic keeps the link between the code and the person in its own patient record. Clinic staff are named accounts | A leak then exposes answers attached to codes. The purpose, telling the clinic that one of its patients needs a call, needs no more than a code. The owner: "Pseudonymous" | An ordinary account system with names and contact details next to the answers |
| B4 | The patient agrees in three separate layers: taking part; each extra measuring method (D13); and the use of pseudonymous answers and outcomes to check the rule. The third is off until switched on, and care is the same without it | An unwell person should be able to take part in their care without agreeing to their data being studied. The owner: "Yes, separate" | One agreement that covers everything |
| B5 | The product's target is a managed PostgreSQL in Helsinki from a Finnish-owned provider (UpCloud). Until an account or credits exist, the hosting is simulated: the app runs in production mode against a real PostgreSQL, configured as it would be when hosted | Company and data centre are both in Finland, so the contested question of US-owned providers in EU regions does not arise. The owner: "Or we at least simulate the hosting" and "We can aim to host properly if we get credits" | A US-owned provider's EU region; paying for hosting before there is anything to host |
| B6 | pnpm as the package manager, switched on through Node's corepack | It keeps one package store per machine, so each new worktree links its packages in seconds. The owner asked to "keep the big packages installed instead of removing installing and deploying all the time" | npm, which downloads into every worktree again |
| B7 | Sign-in uses Better Auth, pinned to an exact patched version, with only what we need switched on: password and a second factor for staff. No sign-in through other services and no emailed sign-in links | It is the maintained library; the older Auth.js gets security fixes only. Its two critical advisories of 2026 were in the parts we leave off | Writing our own sign-in; Auth.js; a hosted sign-in service, which would add another party holding data |
| B8 | Answers are not encrypted field by field. They are protected by pseudonymity, the service's encryption of disks and backups, and the access rules | Encrypted fields cannot be queried or counted, the one add-on for it is unmaintained, and an answer is a number from 0 to 4 with no identity next to it | Field encryption of every answer |
| B9 | Facts are stored as they happen and never overwritten: answers, missed rounds, agreements, warnings, calls. What can be worked out (round kinds, baselines) is computed by the tested functions. A warning is stored when raised, with the version of the rule that raised it | Principle 6 needs every answer next to what happened afterwards, and a changed threshold must not rewrite history | Storing only current state |
| B10 | Developers and tests use a real PostgreSQL that arrives with the package install (`embedded-postgres`, which ships Windows, macOS and Linux builds). Nobody installs a database by hand | The team's machines have no Docker or PostgreSQL. Tests against the real engine check the same access rules that run when hosted | A different database for tests; asking each teammate to install one |

## Shape

One Next.js app in four layers. A layer may use the ones above it in this table and
never the ones below; the linter enforces it.

| Layer | Folder | What it holds | Rule |
|---|---|---|---|
| Domain | `src/domain/` | The question sets, scoring, rounds, baselines, the warning rule, the crisis rule, what a flag may contain, the layers of agreement | Pure functions. No database, no network, no reading of the clock: the time is passed in |
| Use cases | `src/usecases/` | One function per thing a person does: submit a round, enrol a patient, record a call, switch a method off | Calls the domain and the storage; checks access first |
| Server | `src/server/` | Storage, sign-in, access rules, the access log, message delivery | The only code that touches the database or the network |
| Screens | `src/app/` | The patient's screens and the clinic's screens | Validates input, calls a use case, shows the result |

A separate folder, `src/sim/`, holds the generator for a simulated person's weeks. It
writes through the same use cases as a real person would.

## Modules

| # | Module | What it does | Tests, written first |
|---|---|---|---|
| 1 | `domain/instruments` | The PHQ-9 and the two taps as data: items, answer options, scoring. The wording is data, so the PHQ-2 can replace the taps without new code | Totals; an incomplete PHQ-9 is not scored; answers outside the scale are rejected |
| 2 | `domain/rounds` | Which round is due for a patient's two chosen days and time; which rounds are PHQ-9 rounds; the one reminder; an answer that arrives late; "Not today"; an unfinished PHQ-9 offered again | Helsinki time across both clock changes; a late answer counts for the missed round; two submissions of the same round store one answer |
| 3 | `domain/baseline` | The PHQ-9 baseline (first complete one; 10 or more tells the clinic); each tap's median over the first eight answered rounds | Fewer than eight rounds gives no baseline; unanswered rounds do not count |
| 4 | `domain/classify` | Each round is normal, low or no answer | Every row of the table in `questions.md`, before and after a baseline exists |
| 5 | `domain/warning` | The warning rule as a small state machine, with its version number | Every row of the rule table; all four two-round mixes; a normal round ends a run; the rule restarts after a recorded call |
| 6 | `domain/crisis` | The ninth PHQ-9 question is acted on the moment it is answered | Any answer other than "not at all" raises it, also in an unfinished questionnaire; it never waits for a score |
| 7 | `domain/flags` | A flag holds an area and a date, nothing else | The type has no field for an answer; the clinic's data is checked against it |
| 8 | `domain/consent` | The three layers, and which purpose each one allows | Each purpose against each combination of switches |
| 9 | `server/db` | The schema, migrations, and one small storage interface per table group | Run against the real PostgreSQL: stored facts cannot be changed; a deleted patient leaves no answers |
| 10 | `server/access` | The one place that decides who may read what and for which purpose, and writes the access log | A table of every actor against every kind of data, see "Protection" |
| 11 | `server/auth` | Staff sign-in; the one-time enrolment code that signs a phone in | Wrong, used and expired codes are refused; attempts are limited |
| 12 | `server/notify` | Delivery of the crisis message and of warnings through a queue table, with a time limit and bounded retries | A faked failure, a faked slow answer and a faked refusal each leave the message queued and visible, never lost |
| 13 | Patient screens | Check-in (two taps, "Not today"), the PHQ-9, the crisis path on every screen, one suggestion, and a page showing what is recorded with its switches | End to end: a check-in in a few taps; the crisis path is present on every patient page; the ninth question shows it at once |
| 14 | Clinic screens | The list of flags, crisis messages, recording a call and its outcome, enrolling a patient | End to end: a flag shows area and date only; a call recorded by a nurse restarts the rule |
| 15 | `sim` | One simulated person's eight weeks, labelled as simulated wherever shown | The same seed gives the same weeks; the three demo moments appear |

The ring and the camera come after these, as modules that write derived numbers into the
`reading` table below. No table has to change for them.

## What is stored

All times are stored in UTC with the patient's time zone beside them. Every table that
holds patient data carries the clinic it belongs to.

| Table | Holds | Notes |
|---|---|---|
| `clinic`, `staff_user` | The clinic; named staff accounts with a role | The only names in the database |
| `patient` | A random code, the clinic, the enrolment date, the chosen days and time, the time zone, whether the data is simulated | No name or contact detail (B3) |
| `enrolment_code` | A one-time code, stored as a hash, with its expiry and when it was used | Issued by the clinic |
| `consent_event` | Each switch turned on or off, with the date and the version of the text shown | Never overwritten; the current state is the latest event |
| `round` | Each scheduled round: answered, skipped on purpose or missed; whether the reminder went out | A missed round is a stored fact, not a gap |
| `tap_answer`, `phq9_response` | The answers. An unfinished PHQ-9 keeps its answers | Numbers only; no free text in this build |
| `crisis_event` | That the ninth question was answered with anything but "not at all", and when the clinic saw it | Separate from warnings |
| `warning` | When it was raised, which kind (low answers, silence, PHQ-9), the area, since when, the rule's version | The clinic's flag is read from this |
| `call_outcome` | What the nurse found and which step followed, as fixed choices | The "what happened afterwards" of principle 6 |
| `suggestion_shown` | That the one suggestion was shown and whether its button was pressed | |
| `reading` | Later: one derived number per day or per session from the ring or the camera, with its method | Never video or audio |
| `outbox` | Messages to the clinic waiting to be delivered and acknowledged | So that a failed delivery is visible |
| `access_log` | Who read or changed which patient's data, for which purpose, and when | Holds no answers; never overwritten |

## Protection

Each measure uses something that exists and is maintained, and each has a test.

| Risk | Measure | Test |
|---|---|---|
| Someone signs in as someone else | Better Auth with a small surface (B7); a second factor for staff; cookies that scripts cannot read and that are sent only over an encrypted connection; sign-in attempts limited | Sign-in tests for wrong passwords, a missing second factor and too many attempts |
| A patient reads another patient's data | Every read goes through `server/access` with the signed-in actor | Patient A asking for patient B's data is refused |
| Staff of one clinic read another clinic's patients | Every table carries its clinic, and access checks it | A nurse of clinic X is refused clinic Y |
| The clinic sees more than a flag | A nurse may read flags, crisis messages and call outcomes, and never the answers (D8). The flag type has no place for an answer | The clinic's screens and responses are checked to contain no answer |
| Data is used for a purpose the patient did not agree to | Every read states its purpose; access refuses a purpose whose switch is off (B4) | A read for checking the rule is refused until the third layer is on |
| A mistake in the app's checks | A second barrier in the database itself: row-level rules that repeat the clinic and patient checks | The same refusals, tested with the app's checks bypassed |
| Nobody can tell who looked | The access log, written by the same code path as the read | Every read of patient data by staff leaves a row |
| Bad input | Zod at every boundary: forms, server actions, environment variables | Missing, null, duplicate and out-of-range values |
| Requests forged from another site | Next.js checks the origin of server actions; cookies are limited to our own site | A request from another origin is refused |
| Injected scripts | A content security policy with a fresh value per request, as the Next.js documentation describes; no outside scripts | The headers are asserted on each main page |
| The crisis message is lost | It goes into the queue table in the same step that stores the answer, and stays visible until a person at the clinic acknowledges it. The patient's screen never depends on its delivery | The three faked failures in module 12 |
| Health data in logs or notifications | Logs carry event ids, never answers or codes. A reminder says only that a check-in is due | A test reads the log output of a full round |
| Data sent to an outside AI | The app has no AI library and calls no AI service. No AI takes part in the rule | The gate fails if such a dependency appears |
| Secrets in the repository | Environment variables only, listed with empty values in `.env.example` and checked at start | The app refuses to start with one missing |
| A vulnerable package | Exact versions, a lockfile, and an audit of known vulnerabilities in the gate | The gate fails on a high-severity finding |
| A lost or stolen database copy | The service encrypts disks and backups (B5); the rows are pseudonymous (B3) | Not testable here; checked when hosting is set up |
| Withdrawal is not honoured | Switching a layer off stops collection at once; deleting removes the answers and leaves only log rows without health content | After deletion, no answer of that patient can be read by any path |

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

| Command | What it runs |
|---|---|
| `pnpm install` | Links the packages and prepares the local PostgreSQL |
| `pnpm dev` | The app against the local database |
| `pnpm check` | Lint (including the layer rule), type-check, the domain tests, the build, the package audit |
| `pnpm test:db` | Storage and access tests against PostgreSQL |
| `pnpm test:e2e` | The Playwright paths |

Before a branch is published, all three checks pass. The foundation trail writes these
into the commands table of `AGENTS.md`.

## Order

Each step is its own trail with its own review. Steps on the same line of "Can run
beside" touch different folders and can be built at once.

| Step | What | Delivers | Can run beside |
|---|---|---|---|
| 1 | Skeleton | The app with its tooling, the gate commands, the layer rule, environment checks, the local PostgreSQL, an empty page of each kind | Nothing; goes first |
| 2 | The rule | Modules 1 and 3 to 8: scoring, baselines, round kinds, the warning rule, the crisis rule, flags, the layers of agreement | 3, 4 |
| 3 | Rounds | Module 2: the schedule and its awkward cases | 2, 4 |
| 4 | Storage | Modules 9 and 10: the whole schema, the storage interfaces, access and its log | 2, 3 |
| 5 | Sign-in | Module 11 | 6 |
| 6 | Messages | Module 12 | 5 |
| 7 | Patient screens | Module 13 | 8 |
| 8 | Clinic screens | Module 14 | 7 |
| 9 | Simulated weeks and the demo path | Module 15 and the three demo moments | |
| 10 | A security review of the whole | Findings, fixed as their own changes | |

Steps 1 to 4 are workstreams 1 to 3 of `plan.md` for the question flow; steps 7 and 8
are workstreams 2 and 5. The ring maths and the camera page (workstreams 3 and 4) start
after step 4, since they need only the `reading` table.

## Versions

Read from the package registry on 14 Nov 2026. Several of these changed their setup
during the last year, so older examples are wrong.

| Package | Version | What to know |
|---|---|---|
| Next.js | 16 | The request filter is `proxy.ts`, no longer middleware |
| Prisma | 7.10, pinned | A plain install now fetches the unfinished version 8. Version 7 needs a database adapter (`@prisma/adapter-pg`), a `prisma.config.ts`, and a stated output folder for the generated client |
| Better Auth | 1.7.23 or newer, exact | Its Prisma adapter works with Prisma 7 |
| Zod | 4 | |
| Vitest | 5 | Needs Node 22.12 or newer |
| Tailwind | 4 | Configured in CSS; no `tailwind.config.js` |
| Playwright | 1.65 | |

## Open points for the team

1. Is the live demo measurement stored? Proposal: yes, under a demo patient that is
   labelled as demo data, with a delete button that shows deletion working.
2. Staff sign in with a password and a code from an authenticator app. Is that right for
   a clinic, or does it already have a sign-in we should fit into?
3. The second barrier in the database (row-level rules): part of step 4, or only if time
   allows? Proposal: part of step 4, since it is the kind of detail this plan is for.
4. How does a reminder reach the phone without a phone number? Proposal: a browser
   notification later; in the demo the reminder is shown as a state on the screen.
5. The two taps or the PHQ-2 (`questions.md`, open point 1). Either fits, since the
   wording is data.
6. Who builds which step?

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
  patient, or whether that needs a small piece of our own on top of its sessions. Step 5
  starts by finding out.
- Whether `embedded-postgres` runs cleanly on every teammate's machine. It was not
  installed for this plan. The fallback is a hosted development database with simulated
  data only.
- Row-level rules through Prisma need a setting per database transaction; the exact way
  is to be confirmed in step 4.
- The content security policy that the camera's in-browser model will need.
- UpCloud's prices and trial terms: its own pages disagree with each other.
- The Finnish wording of the PHQ-9 that clinics use. The official source says of its
  questionnaires that "no permission is required to reproduce, translate, display or
  distribute them" (https://www.phqscreeners.com/select-screener); the app starts with
  the official English text.
