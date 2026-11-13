# Team plan (proposal, open for comments)

Status 13 Nov 2026, late evening. This is a proposal from one planning session, not yet
agreed by the team. Comment on its trail in Entire's web client: object, ask, or claim a
workstream. `docs/general-plan.md` and `docs/research/` hold the background and sources;
where they differ from this file, this file is the newer proposal.

## What we build

A home monitoring system for people who have finished a TMS course for depression. Its
core is a simple, cheap flow:

1. **Ask.** A short morning routine of questions each day, and the standard nine-question
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

## Principles

1. The goal is a system that works: notice a relapse coming and help someone act on it.
   Nothing is added for a side challenge. An AI model goes in only where it clearly
   improves the system.
2. The recipient sets the complexity. A patient who is unwell gets one simple thing. The
   healthcare system can take detail.
3. Measure cheaply first, and spend more effort only when the cheap signals are unclear.
4. Aim and claim differ. We build for real detection. We say only that the system
   supports the clinic's judgment about when to act, since a claim to detect or predict
   relapse makes software a medical device and the evidence for any one signal is early.
5. Safety: a crisis path to a person and to emergency help, with nothing automated in
   between, wherever mood or self-harm is asked about; the patient knows and agrees to what the clinic sees; no real patient
   data; simulated data is labelled as simulated.
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
(`research/7-behaviour-flags.md`).

## Measurement ladder

| Step | What | Cost to the patient | In the demo |
|---|---|---|---|
| 1 | The ring in the background (phone signals later) | None | Built, on simulated history |
| 2 | Daily check-in and a camera check; a short game and a voice check if time | Seconds to minutes | Check-in and camera built |
| 3 | A nurse calls, when signals are unclear or the patient goes quiet | A conversation | A button on the clinic's screen |
| 4 | A visit, a clinician's assessment, tests the clinic chooses | A trip | Named only |

## Scope

| Tier | What |
|---|---|
| Must have | The flow: the morning routine and PHQ-9, the warning rule (including silence), and the clinic's screen with the nurse-call action. Then the supporting signals, each against a personal baseline: the ring's rhythm and sleep regularity, and the camera's expressivity reading |
| Thin extra | One patient screen: a single suggestion with one button, using a fixed response |
| Only if time | Learning which response helps each person, shown on simulated weeks |

## Signals

| Tier | Signal | Source |
|---|---|---|
| Core | A morning routine: a check-in of 3-4 items or a short game, every day, plus a fortnightly PHQ-9. The answers are data; stopping the routine is a signal in itself, possibly the most important one | The patient's phone |
| Core | Day-night activity rhythm and sleep regularity | The ring; simulated and open data for the history |
| Core | Facial expressivity and head movement | The Arduino USB camera, live, processed in the browser |
| If time | A game rating ambiguous faces; speech rate from a read-aloud | Phone or laptop; the camera's microphone |
| Skipped | Gaze, pupil, phone mobility, HRV on its own | |

The camera reading is one number among others, shown as a trend, never a mood verdict.

## Assumptions

Each is a guess we build on for now. None is verified.

| # | Assumption | Risk | How we would find out |
|---|---|---|---|
| A1 | People will do a short morning routine most days while they are well | Answering fades for everyone over weeks, and most missed answers have technical causes, so a stop is hard to read (`research/2-mental-measures.md`, section D) | Record every missed day with what the passive signals did; compare with how the person was doing |
| A2 | When the routine stops abruptly after worsening answers, while the ring still sends data, the person is more likely unwell than bored | Not validated as a relapse signal in any study we found | The same records, plus what the nurse learns when calling |
| A3 | Some patients will agree to share bank data if it is optional, last in line, and shown only as "financial routine" | No acceptance data for money was found; people accept sharing sleep far more readily than location (`research/7-behaviour-flags.md`) | Ask patients; count who switches the method on |
| A4 | Home-routine signals such as laundry or showering carry information | No depression study has tested them | Collect them next to the check-in and see whether they move together |

## The demo

One person's eight weeks after TMS, compressed in time, stopping at three moments: well
(the check-in takes 20 seconds), a small dip (the patient's one-button screen), and a
drift that does not recover (the clinic's screen). The history is simulated and labelled
so. Today's data point is measured live: a real check-in and a real camera reading. The
same code computes the numbers in both cases.

## Stack

One TypeScript web app: Next.js with strict TypeScript and Tailwind; SQLite through
Prisma; Zod for input; MediaPipe in the browser for the camera, so video never leaves
the device; the rhythm, regularity and baseline calculations as plain tested functions;
Vitest for the calculations and Playwright for the two main screens.

## Workstreams

Each is its own trail. Nobody is assigned yet: claim one in a comment.

| # | Workstream | Delivers | Needs |
|---|---|---|---|
| 1 | Foundation | App skeleton, the whole data model (check-in answers, ring days, camera readings) so later streams do not edit it at once, a generator for one simulated person's weeks | Nothing; goes first |
| 2 | Check-in | Daily check-in and fortnightly PHQ-9 on the phone, with the crisis path | 1 |
| 3 | Signal maths | Rhythm, sleep regularity and personal-baseline functions, with tests; the routing rule (what counts as a small dip, a dip that does not recover, and silence); loading the open activity data | 1 |
| 4 | Camera check | A page measuring facial expressivity and head movement | 1 |
| 5 | The two screens | The clinic's screen and the patient's one-suggestion screen | 2-4 for real numbers; can start on simulated ones |
| 6 | Pitch and demo | Demo script, the talk with the Aalto mentors, the submission text | The doctor's input |

## Checkpoints

| When | What |
|---|---|
| Fri 13 Nov 23:55 | Preliminary submission: which challenge (can be changed later) |
| Sat 12:00 | Submissions open. By then: foundation merged, one signal working end to end on simulated data |
| Sat evening | Demo path frozen: three moments run without help |
| Sun 10:00 | Final submission |
| Sun 10:30-13:00 | Peer review at the venue; skipping it forfeits the main prize |

## Open questions for the team

1. Who takes which workstream?
2. Is "Beyond the Clinic" locked as our challenge before 23:55 tonight?
3. Which single response does the patient's screen offer? Proposal: a short walk, a
   well-supported low-effort response.
4. Does anyone have a week or more of their own ring data? An Oura export can take
   days, so it would have to be requested now.
5. Does anything here not fit what the Aalto mentors (5th floor, booth 11) say they
   want? Questions for them are in `docs/general-plan.md`, section 7.
6. May we publish a public copy of this repository on GitHub for the final submission?
   Judges and peer reviewers need a source link they can open, and this repository is
   private. A public copy shows everything in it, including the anonymous doctor's
   notes. Proposal: yes, pushed once the demo path is frozen on Saturday evening and
   again just before submitting. Whose GitHub account hosts it?

Decisions in this plan become rows in `docs/decisions.md` when the team accepts it.
