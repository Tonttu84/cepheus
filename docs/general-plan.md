# General plan: Beyond the Clinic

Status 13 Nov 2026, evening. Planning notes: the challenge is likely but not locked, and no
product core is chosen.
Sources: `doctor-notes.md` (the doctor's words), `research/evidence-check.md` (claims
checked at abstract level), and the challenge brief on the Junction platform.

## 1. The problem, in the doctor's model

- TMS treats severe depression in daily clinic visits. Even when it works, depression often
  returns: roughly half of responders still respond at 12 months. Nothing good exists for
  maintenance at home.
- The feeling drives thinking and action, not the other way round. Reasoning with the
  thoughts does little, and the feeling cannot be commanded directly.
- The mood sets the mind to "solving" things that need no solving or cannot be solved
  (old events). That is rumination, and it deepens the state.
- Change takes conscious effort, and that effort is exactly what is impaired when unwell.
- The person has strong bad routines (self-blame, denying themselves anything pleasant),
  not just weak good ones. Negative experiences pile up into a list that is easy to grab.
- Thinking, feeling and action end up all stuck. That state is intolerable and can lead to
  suicide.
- Maintenance is about balance: either the person holds it, or a trigger arrives and the
  question is how they handle it before they are in too deep. Personality shapes which
  triggers hit (threat-sensitive, self-demanding).
- Named therapies: MBCT (built to prevent recurrence, fits the brief), CBASP (chronic
  depression, where the person could improve their situation but does not believe it).

## 2. What the brief rewards

- Judging, 25% each: usefulness, ease of use, smart sensing, creativity.
- Wanted: a loop that senses how someone is doing, responds with something that helps, and
  learns what works for that person. A phone and a laptop are enough.
- Possible users: people after TMS, anyone at risk of depression, clinicians following
  patients between visits.
- Judges and mentors are brain-stimulation researchers (Ilmoniemi and Lioumis group).
- Prize (Aalto in Discord `#aalto`, 13 Nov; the platform page still says "to be announced"):
  2000 EUR for the best team, a visit to the brain stimulation lab, and for the most
  promising idea a chance to keep developing it with the researchers.
- Mentors: Aalto University booth, 5th floor, booth 11 (venue map in the participant
  guide): the short column of booths 10-13 in the middle of the hacking area, below the
  Arduino Hardware Lab.

## 3. The option space

Build cost is my estimate for a weekend, not a measurement.

| Direction | What the doctor's model says | Evidence | Build cost |
|---|---|---|---|
| Daily check-in companion | Fits only if it costs almost no effort and does not argue with thoughts | Daily check-ins are tolerated (about 79% compliance) | Low |
| Sensing against a personal baseline | This is the "balance" idea: notice before it is too deep | Wearable accuracy 0.70-0.89, "not ready for clinical use"; warning signals preceded about a third of recurrences | Medium; demo on open data |
| Sensory state-shifters (music, light, rhythm) | Strong fit: an indirect way to shift a feeling that cannot be commanded | Weak at group level, short-term lab studies; honest only as a per-person measurement | Low to medium |
| Small acts and routines | Partial: actions follow the feeling too, so only as cue-based routines trained while well | Strongest family (behavioural activation, exercise); tiny acts thinly studied | Low |
| Mindfulness practice (MBCT style) | Named by the doctor for recurrence prevention | Strongest for relapse (risk cut by about 30%) | Low, but not novel and hard to demo |
| Game | Nothing said | Weak; Soihtu has no published trial | High |
| Smart home light and sound | Fits rhythm and zero effort | Light helps as an add-on | High without hardware |
| Social (peers reach out) | Mixed: for some people contact is itself the trigger | Soft | Medium, heavy on privacy |
| Clinician view | Follow-up is the "more trivial" part, but it makes escalation real | Workflow, not a treatment claim | Low on synthetic data |

Two cores discussed so far, both parked:
- **A, the stuck moment:** notice a dip, sort the thought (can I act on this today?), then
  one small act or an attention shift. Weakness: it asks a stuck person to reason.
- **B, train while well, one tap when unwell:** learn each person's own state-shifters by
  short experiments while well, rehearse them into routines, deliver the proven one with
  one tap in a dip. Weakness: the learning needs weeks, so the demo must simulate time.

Holds whichever direction is chosen:
- A crisis path: a clear route to a person and to emergency help.
- Near-zero effort for anything asked of a person who is unwell.
- No treatment claims; open or synthetic data only, no real patient data.
- No streaks or scores; personality is never shown to the user as a label. These are
  design judgement, with weak evidence behind them.

Do not say in a pitch:
- "Depressive thinking is logical reasoning on biased premises" (the evidence says the
  opposite).
- That slowing recovery predicts relapse (it preceded about a third of recurrences).
- That time from waking to first movement, or unanswered messages, are known markers
  (no source found; lower mobility and a flatter day-night rhythm are supported).

## 4. The weekend

| When | What |
|---|---|
| Fri 13 Nov 23:55 | Preliminary submission: which challenge (can be changed later) |
| Fri evening | "Build with Google DeepMind" workshop (time not stated on the page) |
| Sat 14 Nov 12:00 | Submissions open |
| Sun 15 Nov 10:00 | Final submission |
| Sun 15 Nov 10:30-13:00 | Peer review at the venue; skipping it forfeits the main prize |

Suggested checkpoints (mine, not the organisers'):
- Fri night: talk to the Aalto mentors; settle the challenge and the core.
- Sat midday: one loop working end to end on fake data.
- Sat evening: demo path frozen; only polish after this.
- Sun morning: pitch rehearsed and submitted well before 10:00.

At the Aalto booth, ask: what counts as "smart sensing" for them; which open datasets
they point to; whether TMS-specific maintenance matters more than relapse prevention in
general; the prize. They may also run a TMS demo and a portable EEG demo.

## 5. Open decisions

| Decision | Whose | By when |
|---|---|---|
| Is this the challenge, and does it go to the team | Owner, then team | Before Fri 23:55 (changeable) |
| Product core (A, B, or another) | Owner or team | After talking to the mentors |
| Primary user: post-TMS patient, at-risk person, clinician | Owner or team | With the core |
| Sensing source: self-report only, phone, wearable | Team; depends on hardware at hand | With the core |
| Tech challenges to stack (Gemini API pays 4000 EUR for first; Gemma; Modal; Verda) | Team | Sat morning |
| Who builds what, and the doctor's role (advice, pitch) | Owner | Fri night |
| Stack and repo flow | Team | At kickoff |

Not yet checked: CBASP, cue-based routines in depression, mood-driven memory bias, lower
HRV as a marker, ACT versus CBT for depression. No full texts were read for any claim.

Open datasets for a demo: Kossakowski 2017 (one patient, 239 days of diary reports through
a depressive transition, CC BY 4.0); Depresjon (activity data, 23 patients and 32
controls); StudentLife (phone sensing, 48 students, PHQ-9).
