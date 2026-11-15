# Cepheus

A Junction 2026 hackathon project (13-15 Nov 2026) for the Aalto University challenge
"Beyond the Clinic": a home product that helps people stay well after depression
treatment with TMS. The product core (the question flow with nurse calls; D7) and
stack (D15, D19) are chosen. `docs/plan.md` and `docs/build-plan.md` hold the
current plan; start there.

This file is for coding agents and for people. It holds the rules of this repository.

## How we work

- Nobody pushes to `main`. Every change goes on a branch, is published as an Entire
  trail, gets a review from someone (a person or a fresh agent) who did not write it,
  and is merged after that review passes. See D5 and D6 in `docs/decisions.md`.
- Publishing a change, from a branch with its commits made:
  1. `entire trail create --title "<what and why>" --body "<what to look at>"` publishes
     the branch and opens the trail; it prints the trail's web address.
  2. `entire trail ready` marks it ready for review.
  3. A teammate reviews and approves it; agents report review points with
     `entire trail finding`, since trail comments are for people.
  4. `entire trail merge` merges it into `main`.
  `entire agent-help trail` prints the exact flags of the installed version.
- At the start of a session, tell your user what the team has open, so that nobody has
  to pass links around by hand:
  1. `entire trail list --project et/crunchproject --status open` lists the open trails.
     Leave out any whose phase is `complete`: those are merged.
  2. `entire trail list --mine --status open` lists the ones your user wrote or is
     assigned to. Every other open trail is a teammate's, and your user may want to
     comment on it or review it.
  3. Report one line per trail: its title, whether it is your user's or a teammate's,
     and the web address that `entire trail show <number>` prints. If nothing is open,
     say nothing.
  4. Run `npm run requests` (or `node scripts/check-requests.mjs`). It fetches, reads
     `docs/requests.md` on `main` and every published branch, so a request on a
     branch that was never published is not seen, and prints each open request that
     this machine has not shown before. Pass on whatever it prints at once.
  Only read: do not comment, approve, add findings or merge unless your user asks. If
  `entire` is missing or not signed in, say so in one line and carry on (see Quirks).
- Before starting a piece of work, read `docs/tasks.md` on `main`: it lists what is
  done, what is taken (with the branch) and what is free. Do not start work that is
  marked taken; take free work by publishing a branch early and changing its line in
  the same trail.
- Requests pop up without being asked for. Repeat steps 1 and 4 every time you fetch
  from the remote during a session: before starting a new piece of work and after
  finishing one. Tell your user at once, in a line each and before carrying on with
  your own work, about every request addressed to them or to the team that you have
  not told them about in this session. A request is urgent by default: do not hold it
  back until the end of a task. When your user answers one, mark it in
  `docs/requests.md` through a trail, or do what it asks and say so; some things, such
  as approving a trail in the web client, only a person can do.
- To ask something of a teammate, add a row to `docs/requests.md` through a trail and
  put the request in the trail's title, so that other agents pass it on.
- The author fixes what the review finds. A fix that goes beyond a finding is reviewed
  again.
- Commit messages follow Conventional Commits: `type(scope): imperative summary`, at
  most 72 characters, no trailing period; a body, wrapped at 72 columns, that says why.
  Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`,
  `revert`. One logical change per commit.
- A decision between real alternatives gets one row in `docs/decisions.md`. Old rows are
  never rewritten; a reversal is a new row that names the one it replaces.
- Say what was not done or not checked. "Should work" means run it.

## Stack

Next.js (App Router) with strict TypeScript and Tailwind CSS, PostgreSQL through Prisma
(with embedded PostgreSQL for local development and tests; see D15 and D19 in
`docs/decisions.md`), Zod, MediaPipe in the browser, plain tested TypeScript functions
for domain logic and signal maths, Vitest, and Playwright. Python for the Arduino UNO Q
edge monitor (`hardware/uno-q/`).

## Commands

| Task | Command |
| --- | --- |
| Set up a fresh clone | `npm install && npm run db:setup` |
| Run the dev server (starts the local database) | `npm run dev` |
| Start the local database | `npm run db:start` |
| Stop the local database | `npm run db:stop` |
| Check local database status | `npm run db:status` |
| Push Prisma schema to the database | `npm run db:push` |
| Re-generate Prisma client | `npm run db:generate` |
| Seed the database | `npm run db:seed` |
| Run unit tests | `npm test` |
| Run unit tests in watch mode | `npm run test:watch` |
| Run database integration tests | `npm run test:db` |
| Run browser / end-to-end tests | `npm run test:e2e` |
| Type-check TypeScript | `npm run typecheck` |
| Run the linter | `npm run lint` |
| Audit dependencies for vulnerabilities | `npm run audit` |
| Check open team requests | `npm run requests` |
| Fast check gate (typecheck, lint, audit, test) | `npm run check` |
| Build for production | `npm run build` |
| Start production server | `npm run start` |
| Full gate (before a branch is published) | `npm run check && npm run test:db && npm run build && npm run test:e2e` |

- `npm run test:db` starts its own temporary PostgreSQL database on a free port, so several worktrees can run it at the same time without needing `npm run db:start`.
- Agents must never start a database or a server (`npm run dev`, `npm run start`, `npm run db:start`, `npm run db:setup`) from their own shell: with some agent harnesses the command never returns and the run hangs without a message.

## Code

Guidance, not hard limits. The linter reports the numbers below as warnings, so the gate
stays green. A reviewer asks for a reason when one is exceeded.

- A function does one thing, at one level of detail. Aim for under about 60 lines; a
  screen component may run to about 150.
- Return early. Deal with the error, the empty case and the refusal first, then write
  the main path at the top level of the function.
- Keep nesting to three levels. Deeper than that, move the inner part into a function
  with a name.
- At most five parameters. Beyond that, pass one object.
- Keep the number of branches in one function to about 15.
- Split where a piece earns a name that hides real detail. Do not split into helpers
  that are used once and only pass their arguments on.
- A function that is mostly control flow, one branch for each case with each branch
  calling something, may be longer. Say so in a comment above it.
- Tests are exempt from the length limit, not from the others.
- Only `src/server/db/` talks to the database; other code goes through the use
  cases and ports; the test `src/__tests__/storage-boundary.test.ts` enforces it
  and its exception list may only shrink.

## Rules of the problem

These hold whatever is built.

- The product raises a flag for possible relapse risk and passes it to a nurse
  or doctor, who makes the judgement. It makes no diagnosis and no treatment
  claim, and it never tells the patient that it has detected or predicted a
  relapse. Sensing is described as a wellbeing check-in. Never claim brain
  measurement or brain stimulation at home.
- A general AI model may turn numbers into a plain summary. It must not read mood from
  a face or a voice, and it must not decide when to alert a clinician.
- Anything that asks about mood or self-harm shows a crisis path: a route to a person
  and to emergency help, with nothing automated in between.
- Anything asked of a person who is unwell costs almost no effort. No streaks, no
  scores, and a missed answer is recorded as missed, never punished. The counts in
  D38 (walks) and D42 (answered rounds), which can each be switched off, are the
  only exceptions.
- Personality is never shown to the user as a label.
- No real patient data. Use open datasets or simulated data, and label simulated data
  as simulated wherever it is shown.
- Camera and microphone input is processed on the device. Only derived numbers are
  stored, never video or audio.
- `docs/doctor-notes.md` is one clinician's working model. Remarks marked "Idea" are
  brainstorming, not findings. Its "Checked" lines rest on abstracts, not full papers.
  A claim goes into the product or the pitch only as far as `docs/research/` supports
  it.

## Private data

- No names of the doctor, patients or teammates in files or commit messages, and no
  message times from private chats.
- No secrets in the repository: event credit codes, API keys, passwords, tokens. Keys
  live in environment variables; commit the variable names with empty values.
- Entire's session tracking shares agent conversations with everyone who can read the
  repository. Enable it knowingly, and do not import earlier session history.

## Layout

| Path | What it holds |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | These rules; `CLAUDE.md` points Claude Code at `AGENTS.md`. `.entire/agent-guide.md` is a guide generated by Entire Brain, see "Entire Brain" below |
| `docs/general-plan.md` | The problem, what the research says, candidate cores, build order, open decisions |
| `docs/plan.md` | The team plan: what we build, how often we ask, scope, workstreams and the open questions |
| `docs/build-plan.md` | The build plan: modules, schema changes, protection, test strategy |
| `docs/tasks.md` | The work plan: what is on `main`, the open trails, and the work packages with what is taken and what is free. Read it before starting work |
| `docs/doctor-notes.md` | A doctor's remarks, anonymous, with what a literature check found |
| `docs/research/` | The evidence check and the numbered research reports, with sources |
| `docs/questions.md` | The question set: which questionnaires, the two taps, the baseline, the warning rule and the crisis rule |
| `docs/requests.md` | Requests between team members passed on by agents |
| `docs/side-challenges.md` | The side challenge we entered (Entire), what it still needs from us, and a map of the others |
| `docs/decisions.md` | Decisions, one row each |
| `src/domain/` | Pure domain logic: instruments, rounds, baselines, classify, warning rule, crisis, flags, consent, camera metrics, wearables |
| `src/usecases/` | Application use cases enforcing access rules and storage ports for patient and clinic actions |
| `src/server/` | Server storage, security (cookies, rate limits, HMAC), Fitbit sync, and monitoring endpoints. `src/server/db/` is the PostgreSQL implementation of the storage ports in `src/usecases/ports.ts`; `createPrismaPorts()` builds it |
| `src/server/db/monitoring/` | Session-scoped participant consent defaults and Health Connect pairing store (`session-scope.ts`, `health-connect-pairing.ts`) |
| `src/app/` | Next.js App Router pages (check-in, camera, patient, clinic, monitoring, sign-in) and API routes |
| `src/components/` | Reusable React UI components (camera session, crisis bar, monitoring dashboard, site nav) |
| `src/lib/` | Database client (`db.ts`), Zod schemas, constants, i18n translation dictionary, simulation |
| `prisma/` | Prisma schema (`schema.prisma`, PostgreSQL) and seed script (`seed.ts`) |
| `scripts/` | Tooling scripts: dev database (`dev-db.mjs`), package audit (`audit.mjs`), requests checker, face model setup |
| `hardware/` | Arduino UNO Q edge monitor (`hardware/uno-q/`) and 3D-printable Desk Buddy enclosure (`hardware/enclosure/`) |
| `promotional-video/` | Promotional video plan, character footage, and generated clips for the submission |
| `e2e/` | Playwright browser end-to-end tests (foundation, camera, monitoring, auth, core flow) |

## Quirks

- The remote is hosted on Entire (`entire://...`). Git needs the Entire CLI, which
  provides the `git-remote-entire` helper, on the PATH, and a completed `entire login`.
- Most figures in `docs/research/` come from abstracts. Each report lists what it could
  not check; read that list before relying on a number.
- The local database in `npm run db:setup` and `npm run dev` uses PostgreSQL binaries
  from the embedded-postgres package (managed by `scripts/dev-db.mjs` on port 5433).
  `prisma/schema.prisma` configures the PostgreSQL provider. On Linux, embedded-postgres
  requires the system PostgreSQL client library (`libpq.so.5`, e.g. the `libpq5` package
  on Debian or Ubuntu); without it, `npm run db:setup`, `npm run test:db` and the browser
  tests fail, while `npm run check` and the build still run. It was seen on a teammate's
  Linux machine on 14 Nov 2026.
- `audit-exceptions.json` lists knowingly accepted package vulnerabilities checked by
  `npm run audit` (`scripts/audit.mjs`); unexpected high-severity findings fail
  `npm run check`.
- Browser camera checks require the MediaPipe face landmarker model in
  `public/mediapipe/`, fetched during `npm run db:setup` via `scripts/prepare-face-model.mjs`.

## Entire Brain

The block below was written by Entire Brain's setup and points at a generated guide,
`.entire/agent-guide.md`. These rules are ours and come first:

- Where the guide and this file disagree, this file wins.
- Brain exists only on machines where its plugins are installed and set up. If
  `entire brain status` fails once, Brain is not set up here: ignore the guide for the
  rest of the session and do not retry.
- Only read from Brain. Do not run `entire brain remember`, `distill`, `connect` or any
  other command that writes, records or uploads unless your user asks.
- Never put names, private notes or secrets into a Brain memory, and do not distill or
  import session history from before the repository was shared.

<!-- entire-agent:begin -->
Read .entire/agent-guide.md for this repository's workflow, source inspection, and verification guidance.
@.entire/agent-guide.md
<!-- entire-agent:end -->
