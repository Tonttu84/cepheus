# Team plan (proposal, open for comments)

Status 13 Nov 2026, close to midnight. A first version of this plan was merged into
`main` by the project owner on 13 Nov. This version adds the twice-weekly schedule and
one list of open questions, and it remains a proposal: the points in that list are not
settled until teammates have answered. Comment on its trail in Entire's web client:
object, ask, or claim a workstream. `docs/general-plan.md` and
`docs/research/` hold the background and sources; where they differ from this file, this
file is the newer proposal.

Related: the Entire side challenge and a map of the others (`docs/side-challenges.md`).
A proposal on an open trail has its own question for the team: an agent guide from
Entire Brain (`.entire/agent-guide.md`). Research on everyday behaviour as flags
(`docs/research/7-behaviour-flags.md`) is merged.

## What we build

A home monitoring system for people who have finished a TMS course for depression. Its
core is a simple, cheap flow:

1. **Ask.** One or two short questions twice a week, and the standard nine-question
   depression questionnaire (PHQ-9) every two weeks.
2. **Warn.** A warning is raised when the answers move away from the person's own
   baseline and stay there, or when the person stops answering.
3. **Call.** A nurse calls. The conversation, not the software, finds out whether the
   patient is getting depressed again and what to offer, such as a booster session.

Everything else supports that flow. The ring and the camera are weak at telling whether
someone is depressed, but they show whether a person who went quiet is still up and
about. A small dip that does not warrant a call produces one simple suggestion on the
patient's phone.

Why questions are the core:

- Asking is the best-validated measurement there is. At its usual cut-off the PHQ-9
  catches about 88 of 100 people with major depression and clears about 85 of 100
  without it (Levis 2019, BMJ, 29 studies, 6,725 people:
  https://eprints.whiterose.ac.uk/id/eprint/181475/). It works over the telephone too
  (Pinto-Meza 2005: https://pmc.ncbi.nlm.nih.gov/articles/PMC1490180).
- With those figures, and 20 of 100 patients relapsing in a period, about 30 warnings
  are raised, of which about 18 are real and 12 are false alarms, and about 2 relapses
  are missed. Sorting the false alarms is the job of the nurse's call. This is our own
  arithmetic, not a study result.
- Its weak point is that the people getting worse are the ones who stop answering. So
  silence raises a warning too, and the passive signals help to read it.
- A registered trial already tests the same idea: a weekly PHQ-9 by phone that triggers
  booster TMS sessions (NCT06145594, no results yet).

For the judges, who are brain-stimulation researchers: their loop decides how to
stimulate; ours decides when.

## How often we ask, and how fast we act

Asking every morning wears people out. In studies, answering fades by 1 to 2% a week
even among the willing, and in real-world use mental-health apps keep few users after a
month (`research/2-mental-measures.md`, section D; `research/5-products-and-gap.md`,
section B). So the questions come twice a week, always:

| State | What happens | Why |
|---|---|---|
| Routine | One or two taps, twice a week, and the PHQ-9 every two weeks | Keeps a baseline without wearing people out |
| Warning: the answers stay below the person's baseline for two rounds, or two rounds go unanswered | A nurse calls | About a week of delay; the call, not more questions, finds out what is going on |
| Any answer about self-harm, at any time | The crisis path at once, and the clinic is told the same day | This cannot wait for a schedule |

There is no daily tier. A delay of about a week is acceptable for a relapse, so asking
more often would add fatigue without adding safety. The crisis path does not depend on
being asked: it is on the patient's screen all the time.

Why a week of delay is acceptable in the first rows and not in the last:

- A relapse usually builds over weeks. Reviews of the early signs before depressive
  episodes report lead times from under a month to much longer; one study found a mean
  of about 115 days, and for depressive episodes in bipolar disorder the average was 11
  to 19 days. By the standard definition an episode means at least two weeks of
  symptoms.
- Treating sooner helps, on a scale of weeks to months: a shorter time untreated goes
  with better response and remission (risk ratios of about 1.7, from three studies,
  strongest for first episodes). Nothing we found shows a benefit from acting days
  sooner.
- A crisis is different. Warning signs for suicide act within minutes, hours or days,
  not weeks. So an answer that signals risk is never queued behind a schedule.

These figures come from search summaries of reviews, not from the papers themselves:
https://www.ovid.com/journals/pspsbf/pdf/10.1159/000517953~prodromal-symptoms-in-depression-a-systematic-review ,
https://pmc.ncbi.nlm.nih.gov/articles/PMC2916193 , https://www.pubmed.gov/24183486/ ,
https://pmc.ncbi.nlm.nih.gov/articles/PMC9729416 .

## After a warning

The nurse's call decides what happens next. The system never recommends a treatment; it
brings the right person to the phone.

| What the nurse finds | Response |
|---|---|
| A rough patch, mood only slightly down | Simple things (activity, a sleep routine), a check that medication is still being taken, and a closer look at the next two rounds of answers |
| A decline that has held for a couple of weeks | A booster: a cluster of about 5 TMS sessions over two or three days |
| A full relapse | A new course, through a referral |
| Any sign of crisis during the call | Urgent care, at once. This is in addition to the crisis path on the patient's own screen, which is always there and does not wait for a warning or a call |

Why both simple things and re-treatment, in steps:

- TMS is safe. Common side effects are mild, such as headache or discomfort at the
  scalp (https://pubmed.ncbi.nlm.nih.gov/29338288/ ; search summary). The serious risk
  is a seizure, which an older guideline put at about one per 30,000 sessions
  (https://pmc.ncbi.nlm.nih.gov/articles/PMC7732158 ; search summary).
- Its real cost is clinic capacity and the patient's time: 20 to 30 sessions for a
  course, about 5 for a booster. Fewer than 800 people received TMS in Finland in 2022,
  and a repeat course needs a new referral (`research/4-relapse-after-tms.md`).
- Re-treatment works for people who responded before. In one open study, 38 of 99
  patients worsened and 84% of those regained the benefit when TMS was restarted.
  Monthly booster clusters cut relapse in the one sizeable trial: 16% with boosters and
  medication, 44% with medication alone. Re-treating when symptoms return did about as
  well as a fixed schedule, in an observational comparison (same report).
- The simple things have modest evidence (`research/evidence-check.md`, section 7;
  `research/3-state-shifters.md`), and we found none of it in people who needed TMS
  because medication had failed. So they are a first step for a small dip, not a
  substitute for a booster when the decline holds.
- The point of catching a decline early is the second row: a booster is a few days of
  sessions, a full relapse means a new course and weeks of illness.

## Principles

1. The goal is a system that works: notice a relapse coming and help someone act on it.
   Nothing is added for a side challenge. An AI model goes in only where it clearly
   improves the system.
2. The recipient sets the complexity. A patient who is unwell gets one simple thing. The
   healthcare system can take detail.
3. Measure cheaply first, and spend more effort only when the cheap signals are unclear.
4. Aim and claim differ. The product raises a flag for possible relapse risk and
   passes it to a nurse or doctor, who makes the judgement. It makes no diagnosis
   and no treatment claim, and it never tells the patient that it has detected or
   predicted a relapse.
5. Safety: a crisis path to a person and to emergency help, with nothing automated in
   between, wherever mood or self-harm is asked about; the patient knows and agrees to
   what the clinic sees; no real patient data; simulated data is labelled as simulated.
6. An untested signal is allowed if the system can verify it. Every signal is kept next
   to what happened afterwards (the check-in scores, the PHQ-9, what the clinic found
   when it called), so the collected data can show later whether the signal was worth
   having. The Aalto mentors' view, 13 Nov: something not yet studied is fine, as long
   as there is a way to verify it, by funding a study or simply by collecting data.
7. Intrusive methods are acceptable when the patient agrees to them. Whether enough
   patients will agree is a separate question. We make slightly positive assumptions
   and write each one down with its risk (see "Assumptions").

## Who gets the response

| Signal | Goes to | What they get |
|---|---|---|
| A small dip from the person's own baseline | The patient | One suggestion and one button: a fixed response in the demo, later the one that has helped that person before. No scores, graphs or risk levels |
| A dip that does not recover, or silence | The healthcare system | A flag that names the broad area that changed (for example sleep, daily routine, the check-in) and since when, never the raw data, and actions: request a nurse call, offer a booster. The patient can share more in that conversation |

A flag describes a change for this person, never an illness. The patient switches each
method of measuring on separately, sees what it records, and can switch it off again.
Home and money signals, if any are added, never raise a flag alone: they must agree
with the patient's own check-in and last a week or more
(`research/7-behaviour-flags.md`, merged).

## Measurement ladder

| Step | What | Cost to the patient | In the demo |
|---|---|---|---|
| 1 | The ring in the background (phone signals later) | None | Built, on simulated history |
| 2 | Short questions twice a week, and a camera check; a short game and a voice check if time | Seconds to minutes | Questions and camera built; check-in screen saves answers to database via API and use cases, with word-labelled pills and typed/spoken answers (15 Nov) |
| 3 | A nurse calls, when signals are unclear or the patient goes quiet | A conversation | A button on the clinic's screen; clinic screen reads live flags from the database and runs the warning rule (15 Nov) |
| 4 | A visit, a clinician's assessment, tests the clinic chooses | A trip | Named only |

## Scope

| Tier | What |
|---|---|
| Must have | The flow: the twice-weekly questions and PHQ-9, the warning rule (including silence), and the clinic's screen with the nurse-call action. Then the supporting signals, each against a personal baseline: the ring's rhythm and sleep regularity, and the camera's expressivity reading |
| Thin extra | One patient screen: a single suggestion with one button, using a fixed response |
| Only if time | Learning which response helps each person, shown on simulated weeks |

## Signals

| Tier | Signal | Source |
|---|---|---|
| Core | Short questions twice a week (one or two taps, or a short game), plus a fortnightly PHQ-9. The answers are data; stopping is a signal in itself, possibly the most important one | The patient's phone |
| Core | Day-night activity rhythm and sleep regularity | The ring; simulated and open data for the history |
| Core | Facial expressivity and head movement | The Arduino USB camera, live, processed in the browser |
| If time | A game rating ambiguous faces; speech rate from a read-aloud | Phone or laptop; the camera's microphone |
| Skipped | Gaze, pupil, phone mobility, HRV on its own | |

The camera reading is one number among others, shown as a trend, never a mood verdict.

## Assumptions

Each is a guess we build on for now. None is verified.

| # | Assumption | Risk | How we would find out |
|---|---|---|---|
| A1 | People will answer one or two questions twice a week for as long as they are followed | Answering fades for everyone over weeks, and most missed answers have technical causes, so a stop is hard to read (`research/2-mental-measures.md`, section D) | Record every missed answer with what the passive signals did; compare with how the person was doing |
| A2 | When the answers stop abruptly after getting worse, while the ring still sends data, the person is more likely unwell than bored | Not validated as a relapse signal in any study we found | The same records, plus what the nurse learns when calling |
| A3 | Some patients will agree to share bank data if it is optional, last in line, and shown only as "financial routine" | No acceptance data for money was found; people accept sharing sleep far more readily than location (`research/7-behaviour-flags.md`, on another open trail) | Ask patients; count who switches the method on |
| A4 | Home-routine signals such as laundry or showering carry information | No depression study has tested them | Collect them next to the check-in and see whether they move together |

## The demo

One person's eight weeks after TMS, compressed in time, stopping at three moments: well
(the check-in takes 20 seconds), a small dip (the patient's one-button screen), and a
drift that does not recover (the clinic's screen). The history is simulated and labelled
so. Today's data point is measured live: a real check-in and a real camera reading. The
same code computes the numbers in both cases.

## Stack

One TypeScript web app: Next.js with strict TypeScript and Tailwind; PostgreSQL through
Prisma (with embedded PostgreSQL for local dev and tests; D19); Zod for input; MediaPipe
in the browser for the camera, so video never leaves the device; the rhythm, regularity
and baseline calculations as plain tested functions; Vitest for the calculations and
Playwright for the two main screens.

## Workstreams

Each is its own trail. (Updated 15 Nov: workstreams are assigned and merged on main).

| # | Workstream | Delivers | Needs |
|---|---|---|---|
| 1 | Foundation (done) | App skeleton, the whole data model (check-in answers, ring days, camera readings) so later streams do not edit it at once, a generator for one simulated person's weeks | Nothing; goes first |
| 2 | Questions (done, 15 Nov) | The twice-weekly questions and the fortnightly PHQ-9 on `/check-in` wired through API routes to database storage via use cases, with word-labelled tactile pills, typed/spoken answers, and the crisis path always in view | 1 |
| 3 | Signal maths (done) | Rhythm, sleep regularity and personal-baseline functions, with tests; the routing rule (what counts as a small dip, a dip that does not recover, and silence); loading the open activity data | 1 |
| 4 | Camera check (done) | A page measuring facial expressivity and head movement | 1 |
| 5 | The two screens (updated 15 Nov) | The check-in screen (`/check-in`) saves answers to PostgreSQL via use cases, and the clinic's screen (`/clinic`) reads live flags and runs the warning rule from storage via `/api/clinic/flags`. Patient suggestion card includes guided breathing and walk tools on simulated data (storage wiring in progress) | 2-4 for real numbers; can start on simulated ones |
| 6 | Pitch and demo (updated 15 Nov) | Demo script, promotional video plan and clips in `promotional-video/`, demo timeline preview built and interactive demo page coming | The doctor's input |

## Checkpoints

| When | What |
|---|---|
| Fri 13 Nov 23:55 | Preliminary submission: which challenge (can be changed later) |
| Sat 12:00 | Submissions open. By then: foundation merged, one signal working end to end on simulated data |
| Sat evening | Demo path frozen: three moments run without help |
| Sun 10:00 | Final submission |
| Sun 10:30-13:00 | Peer review at the venue; skipping it forfeits the main prize |

## Open questions for the team

Everything above is a proposal. These are the points where an answer is needed most.

1. Who takes which workstream?
2. A draft naming "Beyond the Clinic" as our challenge, with "Best Use of Entire" as a
   side challenge, was saved on the Junction platform on 13 Nov. It can still be
   changed. Does anyone disagree?
3. Is the core flow right: ask, warn, a nurse calls, with the ring and the camera only
   as support?
4. Is twice a week right for the questions, with no daily tier? The reasoning: a
   relapse builds over weeks, so about a week of delay is acceptable, and anything
   about self-harm goes to the crisis path at once.
5. How much should a flag tell the clinic? Proposal: the broad area that changed, never
   the raw data.
6. May a patient hold back a single flag, or only switch whole methods off? A person
   who is getting worse may hide it.
7. Which single response does the patient's screen offer? Proposal: a short walk, a
   well-supported low-effort response.
8. To do, open for discussion: how are the questions asked? Written and tapped, or
   spoken; plain fixed questions, or an AI in the loop. One view: an AI could reduce
   misuse of the questionnaire, such as careless or random answers. Points on the other
   side: the standard questionnaires are validated with fixed wording; careless
   answering can also be caught by simple rules (answers given too fast, the same
   answer to everything); and an AI must never stand between a person in crisis and a
   human. Two further points were written here as fact before they were checked. That
   people answer a machine more honestly is only partly supported: people are sometimes
   more willing to report sensitive things to a computer than to an interviewer, mainly
   when they are alone, and meta-analyses differ on whether the effect is more than
   small (Gnambs and Kaspar 2015, abstract read; Richman and others 1999, Dodou and de
   Winter 2014, search summaries only). That people stick with a programme better when
   a person is involved is not checked. Two limits hold whatever is chosen: an AI neither triggers nor
   holds back a warning, and a spoken answer is never used to read mood from the
   voice. Starting point: fixed questions answered by tapping, with reading aloud as an
   option, and an AI only where it is shown to help.
9. Does anyone have a week or more of their own ring data? An Oura export can take
   days, so it would have to be requested now.
10. May we publish a public copy of this repository on GitHub for the final submission?
    Judges and peer reviewers need a source link they can open, and this repository is
    private. A public copy shows everything in it, including the anonymous doctor's
    notes. One view so far: not yet. Proposal: decide by Saturday evening, and if yes,
    push once the demo path is frozen and again just before submitting. Whose GitHub
    account hosts it?
11. Can a clinic give a five-session booster at short notice, and who decides that a
    patient gets one? The steps after a warning depend on it.
12. Does anything here not fit what the Aalto mentors (5th floor, booth 11) say they
    want? Questions for them are in `docs/general-plan.md`, section 7, and at the end of
    `docs/research/7-behaviour-flags.md` (on another open trail).

The owner's decisions behind this plan are rows D7 to D16 in `docs/decisions.md`. Each
is marked there as open to the team, with the question above that covers it. When the
team answers, a row is added that confirms the decision or names the one it replaces.
