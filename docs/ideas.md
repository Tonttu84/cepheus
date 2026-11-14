# Two ideas for the team: approve, disapprove or comment

Status 14 Nov 2026. Two ideas from the project owner, written up for the team and for
the Aalto mentors. Neither is built.

## What we ask of you

For each idea, reply on this trail in Entire's web client with one of: **Approved**,
**Disapproved**, or a **comment**. A reason in one line is enough.

| Idea | Your answer |
|---|---|
| 1. A small reward for answering, and perhaps for one small activity | Approved / Disapproved / comment |
| 2. Adjusting for other conditions | Approved / Disapproved / comment |

What happens with your answers:

- Nothing is built and `plan.md` does not change until the team has answered.
- An idea the team approves is put to the Aalto mentors with the questions below, and
  is then written into `plan.md` as a proposal with a row in `decisions.md`.
- An idea that anyone disapproves of stays out of the plan until the objection has been
  talked through. The objection is recorded in this file.
- The owner decides after reading the answers.

Each idea below is in two parts, kept apart on purpose: what the owner proposed, and
how it could be done. The second part was worked out while writing this up and is not
the owner's decision. Disagree with either part separately if you wish.

A third idea, asking for something effortful and reading the effort as a signal, was
considered and dropped by the owner. Anything asked of an unwell person should cost
almost no effort (`AGENTS.md`), and our research found the effort deficit in depression
to be small (`research/2-mental-measures.md`).

## 1. A small reward for answering

### The owner's idea

- Each answered round earns a small amount, for example 1 euro of gift-card value. When
  10 are collected the person gets a gift card of a kind they chose, such as food
  delivery or a sports membership.
- The reason: people get bored and stop answering, also when they are well. A reward
  should keep them answering and so strengthen the signal. Two euros a week is little
  against the cost of health care. The owner notes that paying patients is likely to be
  frowned upon.
- A hypothesis: being active in any small way may itself help a person who has become
  passive, and a small reward might train a useful habit. The owner expects the benefit
  to be marginal.
- A second small reward for doing one suggested activity, such as a short walk, is
  worth considering.
- One condition: a person who has no energy for both must not end up skipping both.
- The product makes no treatment claim. A hypothesis may be stated together with the
  way to test it.

### How it could be done (proposed in this write-up)

Why it should help the signal:

- The plan treats silence as a warning, so every well person who stops out of boredom
  costs a nurse's call. Fewer of those make silence easier to read.
- The answering rate our plan leans on already comes from paid study participants:
  `research/5-products-and-gap.md` calls about 80% "the paid-study ceiling, not
  real-world use".

Where it meets our own rules. `AGENTS.md` says no streaks, no scores, and that a missed
answer is never punished. "Collect until you have 10" is a counter, and a missed round
loses a euro. A form that keeps to the rules:

- The reward is for responding at all, including "Not today". Nobody is paid to report
  a particular mood, the honest way out stays free, and only true silence goes unpaid.
- The count never resets and is never shown as a run of days or as progress to defend.
- The clinic hands out the card. The app holds no payment details.
- The reward never depends on what the answers say.

The activity, kept apart from answering, to meet the owner's condition:

- Answering always comes first, stands alone, and earns its reward the moment the
  person responds.
- The activity is offered afterwards as a separate step with its own reward. Leaving it
  costs nothing, is not counted against the person, and takes nothing away from the
  reward for answering.
- The check-in is never shown as unfinished because the activity was left.
- We cannot see whether someone walked. The reward would follow from the person's own
  tap that they did it, so it is taken on trust.

Which activity, from `research/3-state-shifters.md`:

| Activity | What that report found | Effort |
|---|---|---|
| A single bout of exercise or a walk | Affect improves after one bout, SMD 0.585 (18 studies), in depressed people (Bourke 2022) | Medium: it means leaving the house |
| Brief mindful self-focus, or distraction | Reduced induced negative mood, that is, a low mood brought on in a laboratory, in depressed patients (n=76, Huffziger & Kühner). Not shown for a dip that arises by itself | Low |
| Slow breathing | Improved positive affect over a month of daily practice; healthy volunteers only | Low |
| Bright light, single session | Mood improved after a first session; depressed people, mostly with seasonal depression | None |

The hypothesis and how to test it. The system stores every answer next to what happened
afterwards (plan principle 6 and D11), so patients who were offered a reward can later
be compared with those who were not. That is a research path, not a claim.

Cost. About 100 euros a year for each patient for the answering reward alone. This is
our own arithmetic, not a study.

### Risks

- Answers given carelessly, just to collect.
- Paying patients in ordinary care may be unacceptable, culturally or by the rules of
  the health service. Not checked for Finland.
- A reward could change what silence means in ways we have not foreseen. The rule's
  thresholds would need checking again once it is in use.
- Rewarding an activity is closer to treatment than rewarding an answer.

### Questions for the mentors

1. Would a clinic be allowed, and willing, to give patients a small reward for
   answering?
2. Is a second small reward for one activity worth testing, and which activity would
   you choose for people after TMS: a short walk, or something that costs less effort?
3. How would you test the hypothesis that a small reward for being active helps, and
   what would count as a result?

## 2. Adjusting for other conditions

### The owner's idea

- Many people with serious mental conditions have other mental or physical conditions
  as well, and these may get in the way of detecting depression.
- For patients with several conditions it may make sense to expand the questions.
- A pilot could cover a single other condition.

### How it could be done (proposed in this write-up)

A weakness in the rule as it stands. The warning rule (`questions.md`, on another open
trail) warns when a complete PHQ-9 totals 10 or more. Three of its nine questions are
about sleep, energy and appetite. Our reasoning, not checked against a source: long-term
pain, poor sleep or a physical illness can raise those answers too, so a person with
such a condition may score above 10 all the time while their depression is unchanged.
That person would raise a warning every two weeks, and the nurse would learn to ignore
it.

Two steps, the first one small:

1. **A personal threshold, set by the clinic.** For a patient whose usual PHQ-9 is high
   for a known reason, the clinic marks this at enrolment. For that patient the rule
   warns on a rise from their own baseline, not on the fixed total of 10. This needs no
   new question and a small, tested change to the rule, whose thresholds already sit in
   one versioned configuration.
2. **One further questionnaire, only for patients who have that condition.** The clinic
   switches it on for a patient. Nobody else is asked anything more, so the owner's
   earlier rule of asking no extra question holds for everyone else. The questionnaires
   are already stored as data, so a second one is a data file and a switch for each
   patient.

Which condition to pilot is open. Anxiety is one candidate. Not checked, and to be
confirmed before anything is built: how common it is beside depression in people
treated with TMS; and whether the anxiety questionnaire we have in mind (the GAD-7) is
free to use, comes from the same source as the PHQ-9 and has the same answer options.

### Risks

- More questions for the people who already carry the most.
- A second questionnaire needs its own baseline and its own rule for what counts as a
  change. Those would be untested starting values, like the ones we have.
- More conditions mean more combinations to get wrong. One pilot condition, not several.

### Questions for the mentors

1. Which other conditions are most common in your TMS patients, and which of them most
   often confuse the picture?
2. Does a swing into mania after treatment matter here? Questions about depression
   would miss it, and might even read it as improvement.
3. Would a clinic set a personal threshold for a patient, and who would decide it?

## A first literature check, not verified

An automated search was run on both ideas on 14 Nov 2026. It returned search summaries
only: no paper was read, most study sizes are missing, and an earlier search of the
same kind contained an error. Nothing below may be used in the product or the pitch
until someone has read the sources. It is listed so that the right questions get asked.

- Paid studies of repeated phone questionnaires are reported to reach higher answering
  rates than unpaid ones.
- Rewards are reported to raise careless answering in some studies.
- Small rewards for a target behaviour are reported to work well in addiction care; the
  usual objections are that it looks like bribery and may crowd out a person's own
  motivation.
- European and Finnish ethics guidance is reported to turn on "undue inducement"; a
  token reward is said to fall below it, without a source that settles it for
  ordinary care.
- Fixed small rewards are reported to keep people answering better than a lottery.
- Other conditions are reported to be very common among people treated with TMS for
  depression, anxiety and long-term pain among them.
- Physical illness and pain are reported to raise the PHQ-9's questions on sleep, energy
  and appetite.

## Not checked

- Whether small rewards raise answering among people with depression, and whether they
  change how honestly people answer.
- Whether paying patients for answering is permitted in Finnish health care.
- How common other conditions are among people treated with TMS, and how much they
  raise PHQ-9 totals.
- Which questionnaire is best for a second condition, and its terms of use.
