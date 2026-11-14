# General plan: Beyond the Clinic

**Background document.** It records the research summary and the options as they stood
on the evening of 13 Nov, before the planning sessions. For what the team proposes to
build, read `plan.md`: where the two differ, `plan.md` is newer. Sections 4 and 8 below
(candidate cores and open decisions) are superseded by it; they are kept as they were,
apart from the rows on the stack and the repository flow.

Status 13 Nov 2026, late evening. Planning notes: the challenge is likely but not locked,
and no product core is chosen.
Sources: `doctor-notes.md` (the doctor's words), the reports in `research/` (sources read
mostly at abstract level; each report lists what it could not check), and the challenge
brief on the Junction platform.

## 1. The problem

As a TMS researcher would put it (`research/4-relapse-after-tms.md`):

- About half of the people who respond to a TMS course lose the response within a year:
  46.3% still respond at 12 months (Senova 2019, read in full).
- Booster sessions seem to work in uncontrolled data, but nobody knows when a given
  patient needs them. Today the trigger is the patient getting worse, being referred
  again and waiting.
- No reliable predictor of relapse after TMS exists, and no published results were found
  from wearables after TMS (one registered protocol pairs a ring with TMS).

In the doctor's model (`doctor-notes.md`):

- The feeling drives thinking and action. Reasoning with the thoughts does little, and
  the feeling cannot be commanded directly, only shifted indirectly.
- Change takes conscious effort, which is exactly what is impaired. Bad routines are
  strong, not just good ones weak.
- Perception turns negative, life narrows through avoidance, and negative experiences
  pile up. Thinking, feeling and action end up stuck; that state can lead to suicide.
- Maintenance is about balance: what happens after a trigger, before it is too deep.

## 2. What the brief rewards

- Judging, 25% each: usefulness, ease of use, smart sensing ("clever use of what can be
  measured at home, and learn what works for each person"), creativity.
- Prize: 2000 EUR for the best team, a visit to the brain stimulation lab, and for the
  most promising idea a chance to keep developing it with the researchers.
- Mentors: Aalto University booth, 5th floor, booth 11.
- "Closed-loop" in the judging group's own work means a loop of milliseconds to minutes
  inside one stimulation session. A home product is the slow outer loop, over days to
  weeks, that decides when to stimulate; theirs decides how. Never claim home TMS-EEG.

## 3. What the research says

**Sensing, ranked** (`research/1-physical-signs.md`, `research/2-mental-measures.md`)

| Measure | Source | Verdict |
|---|---|---|
| Day-night activity rhythm and sleep regularity | Ring or wrist | Best: the strongest relapse evidence in recovered people (93 people, 23 relapses, one study, not replicated) |
| Daily steps; phone mobility and time at home | Phone, ring | Good: move with a person's own symptoms |
| Daily check-in of 3-4 items, under 30 s | Self-report | Good: single mood items are valid; about 79% compliance in studies |
| PHQ-9 every 1-2 weeks | Self-report | The calibration anchor; a change of about 6 points is real |
| Game rating ambiguous faces or scenarios | Phone or laptop | Best-supported task; low reliability, so a weekly trend, never a daily alarm |
| Facial expressivity and head movement | Ordinary camera | The only camera signal that moves with recovery; small studies |
| Gaze toward sad versus happy faces | Camera plus a viewing task | Real, but persists after recovery, so more trait than state |
| Speech rate from a 30-second read-aloud | Phone microphone | Cheap add-on |
| Activity and social range per day | Self-report | Tracks same-day symptoms; not shown to precede relapse |
| HRV alone, pupil, eye movements, skin conductance, attention-probe tasks | Various | Avoid: trait-like, lab-only or unreliable |

A missed answer as a signal is mixed: low mood predicts a missed next prompt, but most
missing answers have technical causes and answering fades for everyone. Log it as an
event; never score it as a zero or punish it.

**Responses** (`research/3-state-shifters.md`)

- Fast and low effort: a short walk, brief mindful attention or distraction (fades the
  same day), slow breathing (healthy samples only), bright light.
- Backfire: recalling happy memories (worsens mood in people who are depressed, no
  change in recovered people), self-chosen sad music. Cold water does nothing.
- People can use a strategy when prompted; starting it is what fails. Remove the
  starting step.
- Learning per person is slow. No published figure exists; the report's own rough
  estimate is 16 to 63 tries of a response plus as many do-nothing comparisons, so about
  30 to 130 occasions, to tell one response from doing nothing. Telling two responses
  apart is unrealistic. Realistic: confirm 2-4 candidates over 4-8 weeks while the person
  is well, starting from group evidence.

**The gap** (`research/5-products-and-gap.md`)

- Sensing-only products failed (a signal with no proven action); treatment-only products
  had no payer. Nothing targets the period after TMS.
- New is the combination: learn while well, one tap at a dip, and a clinic action.
- A clinician view is already done elsewhere; the TMS clinic context is what is left.
- Real-world mental-health apps keep a median 3.3% of users at day 30.
- Flags possible relapse risk for a clinician's review; makes no diagnosis,
  no treatment claim, gives no final judgement, and says nothing about relapse
  to the patient.

## 4. Candidate cores (none chosen)

- **A, the stuck moment:** notice a dip, sort the thought, then one small act or an
  attention shift. Weakness: it asks a stuck person to reason.
- **B, train while well, one tap when unwell:** learn each person's own state-shifters
  while well, rehearse them, deliver the proven one with one tap in a dip. Weakness:
  learning takes weeks, so the demo must simulate time.
- **C, the outer loop for the TMS clinic:** home sensing against a personal baseline
  that tells the clinic when to offer a booster, plus self-management in between.
  Weakness: the response belongs to the clinic, so the home side can look thin.

B and C combine: C gives the signal a clinic action, B gives the person something to do.

Holds whichever is chosen: a crisis path to a person and to emergency help with nothing
automated in between; near-zero effort for anything asked of someone unwell; no
treatment claims; open or synthetic data only; no streaks or scores; personality never
shown as a label.

## 5. Hardware and data at hand

- An Oura ring: gives sleep timing, night waking and per-minute activity, which is the
  best sign. No live stream (data lags until the phone app syncs); access needs an OAuth
  app, and newer rings need a membership. The account data export is the fallback; whether
  it is complete without a membership is not confirmed, and it can take up to 10 days, so
  request it at once. The rhythm measures need 7+ days of data.
- An Arduino USB Camera: a standard driver-free webcam (up to 4K, ring light, built-in
  microphone). Enough for facial expressivity, head movement and the read-aloud. Ask it
  for 720p and switch the ring light on.
- An AI-assisted tracking camera demoed at the venue: make and developer access unknown.

Build order for the sensing (`research/6-sensing-feasibility.md`; hours are estimates):

| Step | Route | Hours |
|---|---|---|
| 1. Daily check-in and fortnightly PHQ-9 (done) | Web form (twice-weekly in plan); the PHQ-9 question on thoughts of self-harm must show the crisis path | 3-4 |
| 2. Rhythm and sleep-regularity numbers (done) | Own formulas, first on a simulated person, then on open activity data | 3-4 |
| 3. Facial expressivity and head movement (done) | MediaPipe Face Landmarker in the browser; frames processed in memory, only numbers stored | 3-5 |
| 4. Speech rate and pauses, if time | Fixed passage with a known syllable count | 3-4 |
| 5. Live Oura data, if time | Browser sign-in, sleep and activity endpoints | 2-4 more |
| Skip | Gaze task (6-8 h, weak accuracy), phone mobility and steps (native app only) | |

Simulated input must be labelled as simulated in the demo; the code that computes the
numbers is real. A general AI model may turn a week of numbers into a plain summary for
a clinician; it must not read mood from a face or voice, or decide when to alert.

Credits (Junction platform, "Developer Tools and Assets"): Claude API 20 USD per
participant, claimed through the link on its page there; Gemini API credits through a
form that one person per team fills in (18 or older); OpenAI Codex 100 USD per
participant (how to claim not checked); Verda 200 EUR; Modal 100 USD per participant.
- Open data for a demo: one patient's 239 days of diary reports through a depressive
  transition (Kossakowski 2017); activity data from 23 patients and 32 controls
  (Depresjon); phone sensing from 48 students (StudentLife).

## 6. The weekend

| When | What |
|---|---|
| Fri 13 Nov 23:55 | Preliminary submission: which challenge (can be changed later) |
| Sat 14 Nov 12:00 | Submissions open |
| Sun 15 Nov 10:00 | Final submission |
| Sun 15 Nov 10:30-13:00 | Peer review at the venue; skipping it forfeits the main prize |

Suggested checkpoints: mentors and core settled on Friday night; one loop working end to
end on fake data by Saturday midday; demo path frozen Saturday evening; pitch rehearsed
and submitted well before Sunday 10:00.

## 7. Questions for the mentors

1. Would a clinic offer planned maintenance or symptom-triggered boosters, and can it
   give a cluster of sessions at short notice?
2. Which measure and threshold would you trust to call a patient back, and who would
   receive the alert?
3. Would daily data during and after a course help your personalisation work?
4. What counts as "smart sensing" for you, and which open datasets do you point to?
5. Which pilot outcome would convince you that it worked?

## 8. Open decisions

| Decision | Whose | By when |
|---|---|---|
| Lock the challenge | Team | Before Fri 23:55 (changeable) |
| Product core (A, B, C or a mix) | Team | After talking to the mentors |
| Primary user: person after TMS, person at risk, clinician | Team | With the core |
| Which sensors go in the demo | Team | With the core |
| Tech challenges to stack (Gemini API, Gemma, Modal, Verda) | Team | Sat morning |
| Who builds what, and the doctor's role | Team | Fri night |
| Stack | Settled | PostgreSQL through Prisma; see D15 and D19 in `decisions.md` |
| Repository flow | Settled | See D5 and D6 in `decisions.md` |

## 9. Not yet checked

- Most figures come from abstracts. Spot-checked against sources: the rhythm study, the
  interpretation-bias meta-analysis, the app retention figure, the sad-music study, the
  open diary dataset, and the registered trial of phone-triggered maintenance TMS.
- Lower HRV as a marker, ACT versus CBT for depression, the two-week lead time in the
  rhythm study, the specifications of the demoed camera, and whether Oura's sign-in
  works for a local app.
