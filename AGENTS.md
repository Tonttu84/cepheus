# Cepheus

A Junction 2026 hackathon project (13-15 Nov 2026) for the Aalto University challenge
"Beyond the Clinic": a home product that helps people stay well after depression
treatment with TMS. The challenge is likely but not locked, and no product core or stack
is chosen yet. `docs/general-plan.md` holds the current state; start there.

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
  4. Read `docs/requests.md` and tell your user every open request addressed to them or
     to the team, in a line each.
  Only read: do not comment, approve, add findings or merge unless your user asks. If
  `entire` is missing or not signed in, say so in one line and carry on (see Quirks).
  To ask something of a teammate, add a row to `docs/requests.md` through a trail and
  put the request in the trail's title, so that other agents report it at their next
  session start.
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
(see decision B2 in `docs/build-plan.md`, which is on an open trail),
Zod, MediaPipe in the browser, plain tested TypeScript functions for signal maths,
Vitest, and Playwright. See D15 in `docs/decisions.md`.

## Commands

| Task | Command |
| --- | --- |
| Set up a fresh clone | `npm install && npm run db:setup` |
| Run the app (starts the local database) | `npm run dev` |
| Stop the local database | `npm run db:stop` |
| Before a branch is published | `npm run check && npm run test:db && npm run build && npm run test:e2e` |

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

## Rules of the problem

These hold whatever is built.

- The product makes no treatment or diagnostic claims, and never says it detects or
  predicts relapse. Sensing is described as a wellbeing check-in. Never claim brain
  measurement or brain stimulation at home.
- A general AI model may turn numbers into a plain summary. It must not read mood from
  a face or a voice, and it must not decide when to alert a clinician.
- Anything that asks about mood or self-harm shows a crisis path: a route to a person
  and to emergency help, with nothing automated in between.
- Anything asked of a person who is unwell costs almost no effort. No streaks, no
  scores, and a missed answer is recorded as missed, never punished.
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
| `docs/doctor-notes.md` | A doctor's remarks, anonymous, with what a literature check found |
| `docs/research/` | The evidence check and the numbered research reports, with sources |
| `docs/side-challenges.md` | The side challenge we entered (Entire), what it still needs from us, and a map of the others |
| `docs/decisions.md` | Decisions, one row each |

## Quirks

- The remote is hosted on Entire (`entire://...`). Git needs the Entire CLI, which
  provides the `git-remote-entire` helper, on the PATH, and a completed `entire login`.
- Most figures in `docs/research/` come from abstracts. Each report lists what it could
  not check; read that list before relying on a number.
- The local database in `npm run db:setup` uses PostgreSQL binaries from the
  embedded-postgres package; on Linux they need the PostgreSQL client library
  (libpq.so.5) installed on the system first, for example the `libpq5` package on
  Debian or Ubuntu (not checked on every distribution); without it,
  `npm run db:setup`, `npm run test:db` and the browser tests fail, while
  `npm run check` and the build still run. It was seen on a teammate's Linux
  machine on 14 Nov 2026.

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
