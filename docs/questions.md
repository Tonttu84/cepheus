# The question set

Status 14 Nov 2026. The owner's proposal, open to the team. It fills in step 1 ("ask")
and the warning rule of the team plan (`plan.md`). The thresholds in this file are
starting values that nobody has tested; `plan.md` principle 6 applies, so every answer is
stored next to what happened afterwards and the thresholds are checked against that.

## Why existing questions, and which

We do not write our own questionnaire. Questions are the best-validated measurement we
have, and that holds only for instruments used as they were validated
(`research/2-mental-measures.md`, section A).

| Part | Instrument | Why |
|---|---|---|
| Every two weeks | The PHQ-9, unchanged | Nine questions about the last two weeks, so it fits a two-week rhythm exactly. At its usual cut-off it catches about 88 of 100 people with major depression and clears about 85 of 100 without it; a change of about 6 points is real for one person |
| Twice a week | Two single taps: mood and interest | The same two things the PHQ-2 asks about, which carry most of the screening information. The PHQ-2's own wording asks about two weeks, so it cannot be used twice a week as it stands. Single ratings of how one feels now have good validity when asked repeatedly |
| Optional | One tap for energy | No validated single question was found; an untested extra |

The two taps are our adaptation of validated ideas, not a validated instrument. Their
check is built in: every two weeks they can be compared with the PHQ-9.

## The PHQ-9

- Use the official wording, order, answer options and scoring, in Finnish and in English,
  from the instrument's official source. Do not rephrase, shorten, reorder or translate
  it ourselves.
- Topics of the nine questions, for orientation only: interest, mood, sleep, energy,
  appetite, self-worth, concentration, moving or speaking slowly or restlessly, and
  thoughts of self-harm. Each is answered on four options from "not at all" to "nearly
  every day", scored 0 to 3, total 0 to 27.
- Before the wording is put into the repository or the app: confirm the terms of use and
  which Finnish version clinics use. Our search did not confirm either.
- The ninth question, on thoughts of self-harm, is handled as described under "Crisis".

## The two taps

Asked twice a week, on two fixed days the patient chooses, at a time the patient chooses.

| Tap | Question | Answer |
|---|---|---|
| Mood | "How is your mood right now?" | Five options from "very low" to "very good", scored 0 to 4 |
| Interest | "How much do you feel like doing things right now?" | Five options from "not at all" to "very much", scored 0 to 4 |

- One screen, two taps, no typing, about ten seconds.
- A third button, "Not today", records a skipped round. It counts as an answer for the
  silence rule below.
- The wording is ours and should be checked against the published item collections for
  diary studies before it is fixed (`research/2-mental-measures.md` names the item
  repository).
- On PHQ-9 days the two taps are asked as well, first, so the series has no gaps.

## Baseline

A person's baseline for each tap is the median of their first eight rounds (four weeks)
after the treatment course, while they are well. Until then no warning is raised from
the taps. The PHQ-9 baseline is the first score after the course.

## The warning rule

The rule is fixed and simple on purpose. It is a rule, not a model, and no AI takes
part in it.

| Situation | What it means | What happens |
|---|---|---|
| One low round: mood or interest at least 2 points under the person's baseline, or both at least 1 point under | A small dip | The patient's screen shows one suggestion with one button |
| Two low rounds in a row | A change that stays | A warning: a flag to the clinic naming the area "the check-in", and a nurse calls |
| Two rounds in a row with no answer and no "Not today" | Silence | The same warning. One reminder is sent the morning after a missed round, and no more |
| The PHQ-9 total is at least 6 points above the person's baseline | A change that stays | The same warning |

- A flag never contains the answers themselves (`plan.md`, "Who gets the response").
- "Not today" twice in a row raises no warning by itself; three times in a row does.
- These numbers are the proposal to argue about. Workstream 3 in `plan.md` owns the rule.

## Crisis

- The crisis path, a route to a person and to emergency help, is on the patient's screen
  at all times, not only on question days.
- Any answer other than "not at all" to the PHQ-9's ninth question shows the crisis path
  at once, and the clinic is told the same day. A person at the clinic responds; nothing
  automated stands in between.
- This is not a warning in the sense above and does not wait for a second round.

## What is stored

For every round: the date, each answer, whether it was answered, skipped or missed, and
later what the nurse found if a call followed. No free text in the must-have build.

## Open points for the team

1. Are two taps enough, or should energy be a third?
2. Are the thresholds a sensible start: two points under baseline, two rounds in a row,
   6 points on the PHQ-9?
3. Should "Not today" be allowed to hide a decline for as long as three rounds?
4. Which Finnish version of the PHQ-9 do clinics use, and under what terms may an app
   show it?
