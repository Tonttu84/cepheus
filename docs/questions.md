# The question set

Status 14 Nov 2026. The owner's proposal, open to the team. It fills in step 1 ("ask")
and the warning rule of the team plan (`plan.md`). The thresholds in this file are
starting values that nobody has tested; `plan.md` principle 6 applies, so every answer is
stored next to what happened afterwards and the thresholds are checked against that.
When the team accepts this file, the choice of instruments becomes a row in
`decisions.md`; that file is being changed on another open trail, so the row is not
added here.

## Why existing questions, and which

We do not write our own questionnaire. Questions are the best-validated measurement we
have, and that holds only for instruments used as they were validated
(`research/2-mental-measures.md`, section A).

| Part | Instrument | Why |
|---|---|---|
| Every two weeks | The PHQ-9, unchanged | Nine questions about the last two weeks, so it fits a two-week rhythm exactly. At its usual cut-off it catches about 88 of 100 people with major depression and clears about 85 of 100 without it; a change of about 6 points is real for one person |
| Twice a week | Two single taps: mood and interest | The same two things the PHQ-2 asks about, which carry most of the screening information. The PHQ-2's own wording asks about two weeks, so it cannot be used twice a week as it stands. Single ratings of how one feels now have good validity when asked repeatedly |

The two taps are our adaptation of validated ideas, not a validated instrument. Their
check is built in: every two weeks they can be compared with the PHQ-9.

No question outside this set is asked. The owner, 14 Nov 2026: "Lets not ask an extra
question if we have a curated set that can be proven". So there is no extra tap for
energy or sleep, for which no validated single question was found, and no follow-up
question after a suggestion.

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
- A third button, "Not today", lets a person skip on purpose. It is stored separately
  from a round that was simply missed, because the difference is worth knowing, but for
  the warning rule both count as a round with no answer.
- The wording is ours and should be checked against the published item collections for
  diary studies before it is fixed (`research/2-mental-measures.md` names the item
  repository).

## Rounds

- A round is one scheduled question day. It ends when the next one begins.
- If a round gets no answer, one reminder is sent the next morning, and no more. An
  answer given before the next round begins counts for the missed round.
- Every second week one round is a PHQ-9 round. The two taps come first, so the series
  has no gaps, then the PHQ-9. An unfinished PHQ-9 keeps its answers and is offered again
  at the next round; it is not scored until it is complete, with one exception under
  "Crisis".
- "Not today" on a PHQ-9 round skips both, and the PHQ-9 is offered at the next round.

## Baseline

- The clinic enrols a patient after the treatment course, when it judges that the
  person has responded. That judgment is the clinic's and is what "well" means here.
- The PHQ-9 baseline is the first complete PHQ-9 after enrolment. If it is 10 or more,
  the usual cut-off, it immediately raises a warning: a flag to the clinic and a nurse
  calls. The system tells the clinic that the person is not at a well baseline and does
  not store it as a personal baseline.
- The baseline for each tap is the median of the person's first eight answered rounds,
  which takes at least four weeks. Rounds with no answer do not count toward the eight.

## Each round is one of three kinds

| Kind | When |
|---|---|
| Normal | Answered, and not low |
| Low | Either tap at its bottom option; or, once a baseline exists, mood or interest at least 2 points under the person's baseline, or both at least 1 point under |
| No answer | Missed, or "Not today" |

The bottom-option rule works from the first day, before a baseline exists, and for a
person whose baseline is already near the bottom of the scale.

## The warning rule

The rule is fixed and simple on purpose. It is a rule, not a model, and no AI takes
part in it.

| Situation | What it means | What happens |
|---|---|---|
| A low round after a normal one | A small dip | The patient's screen shows one suggestion with one button |
| A round with no answer after a normal one | Nothing yet | The reminder, as above |
| Two rounds in a row of which neither is normal: low and low, low and no answer, no answer and low, or no answer twice | A change that stays, or silence | A warning: a flag to the clinic, and a nurse calls |
| A complete PHQ-9 with a total of 10 or more, or at least 6 points above the person's baseline | A change that stays | The same warning |

- This follows the plan and decision D7: two rounds unanswered raise a warning, and
  "Not today" does not delay it. A low round and a skipped round next to each other also
  raise it, so a person cannot slide down unnoticed by answering every other time.
- The silence rule applies from the first round, also before a baseline exists.
- A first complete PHQ-9 with a total of 10 or more also raises a warning at once,
  so a patient whose very first score is high receives a nurse call without waiting.
- The flag names the area "the check-in" and since when. It never contains the answers
  themselves (`plan.md`, "Who gets the response").
- A normal round ends a run. After a warning, the rule starts again once the nurse has
  recorded the call.
- These numbers are the proposal to argue about. Workstream 3 in `plan.md` owns the rule.

## Crisis

- The crisis path, a route to a person and to emergency help that is available at any
  hour, is on the patient's screen at all times, not only on question days.
- The PHQ-9's ninth question is acted on the moment it is answered, whether or not the
  rest of the questionnaire is finished. Any answer other than "not at all" shows the
  crisis path at once.
- At the same moment the clinic is notified, as a separate message and not as part of a
  flag or a daily summary. A person at the clinic responds; nothing automated stands in
  between, and the software makes no judgment about risk.
- This is not a warning in the sense above. It does not wait for a second round, for a
  score, or for a baseline.
- Who receives that message at night and at weekends is the clinic's to decide and is an
  open point below. Until it is settled, the patient's screen must say plainly that the
  clinic may not see the message until it opens, and point to the help that is available
  at any hour.

## What is stored

For every round: the date, each answer, whether it was answered, skipped on purpose or
missed, whether a reminder was sent, and later what the nurse found if a call followed.
No free text in the must-have build.

## Open points for the team

1. Should the twice-weekly questions be the two taps in our own wording, as written
   here, or the PHQ-2 exactly as published? The PHQ-2 is the proven set, and its two
   questions are the first two of the PHQ-9, so on PHQ-9 days nothing would be asked
   twice. Its wording asks about the last two weeks, which reacts more slowly to change.
2. Are the thresholds a sensible start: the bottom option, two points under baseline,
   two rounds in a row, and 10 or a rise of 6 on the PHQ-9?
3. Should "Not today" count as no answer, as written here, or should a deliberate skip
   be given more room?
4. Who at the clinic receives a crisis message at night and at weekends, and how fast
   can they respond?
5. Which Finnish version of the PHQ-9 do clinics use, and under what terms may an app
   show it?
