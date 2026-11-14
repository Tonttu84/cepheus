# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
- **Post-TMS patients at home:** People who have completed a Transcranial Magnetic Stimulation (TMS) course for major depression. When unwell or fatigued, they need a near-zero-effort check-in (~20 seconds twice a week) that never punishes missed rounds, never shows anxiety-inducing scores or streaks, and offers at most one gentle, concrete self-care step on a mild dip.
- **TMS clinic nurses and clinicians:** Healthcare professionals managing post-TMS follow-up who need a clear outer-loop signal on *when* to reach out by phone or offer a 5-session TMS booster cluster, without drowning in raw sensor traces or false alarms.

## Product Purpose
Cepheus ("Beyond the Clinic") is a home wellbeing check-in and clinic follow-up companion for post-TMS depression care. Its core loop is **Ask → Warn → Call**:
1. **Ask:** Twice-weekly short check-in prompts (1–5 scale taps or a single overall tap, plus a penalty-free "Not today" skip) and a fortnightly 9-item PHQ-9 questionnaire.
2. **Warn:** Compare responses against the person's own post-TMS baseline. Raise a clinic warning when check-in answers stay below personal baseline for two consecutive rounds, or when two rounds go unanswered while passive wearable contact shows the ring is still worn.
3. **Call:** Route sustained drift or silence to a human clinic nurse phone call — the conversation, not software, determines whether the patient is relapsing and whether to schedule a booster session.

## Positioning
While clinical brain-stimulation research optimizes *how* to stimulate, Cepheus supports the outer loop of *when* to check in after the patient goes home. Unlike daily mood trackers that cause 1–2%/week adherence decay and burden patients with graphs and streaks, Cepheus splits the response by recipient: a single low-effort action button for the patient on a mild one-round dip, and a broad-area flag (`check_in`, `sleep`, `daily_routine`, `social`, `financial_routine`) with its start date for the clinic on sustained drift or silence — never raw sensor traces.

## Operating Context
- Used at home on the patient's phone or laptop twice a week (plus optional on-device camera check-in and passive smart-ring sleep/rhythm background data) and reviewed by TMS clinic nursing staff in an outpatient psychiatric follow-up workflow.
- Demonstrated across an 8-week post-TMS synthetic trajectory stopping at three moments: Day 18 (Well / quiet baseline), Day 29 (Week 5 small dip → patient one-button suggestion), and Day 56 (Week 8 sustained drift & check-in silence while ring remains worn → clinic broad-area flag and nurse call / booster action).

## Capabilities and Constraints
- **No medical device or diagnostic claims:** Never claim to diagnose, treat, detect, or predict relapse, and never claim home brain measurement or brain stimulation. Sensing is framed strictly as a wellbeing check-in that supports the clinic's judgment.
- **Persistent human crisis path:** Every screen that asks about mood or self-harm (and the global top bar across the entire app) displays direct, one-tap links to Emergency `112`, MIELI Crisis Helpline (`09 2525 0111`, 24/7 person), and the TMS Clinic Nurse line — with nothing automated in between. PHQ-9 Item 9 (self-harm thoughts) triggers the immediate crisis path on the same day regardless of schedule.
- **Zero punitive mechanics:** No streaks, no scores, no graphs on the patient view, and no personality labels. A skipped ("Not today") or missed check-in is recorded as missed, never scored as zero and never punished.
- **Per-method granular consent:** Patients switch each measurement channel (`check_in`, `ring`, `camera`, `home_routine`, `finance`) on or off separately and see in plain language what it records. Home or financial routine signals never raise a flag alone; they must corroborate the patient's check-in and persist for a week or more.
- **On-device media privacy:** Camera (MediaPipe Face Landmarker in-browser WebAssembly) and microphone inputs are processed 100% on the device. Only derived summary numbers (expressivity index and head angular path in deg/min) are stored; 0 bytes of video, image frames, or audio ever leave the browser.
- **AI boundaries:** A general AI model may only turn numbers into a plain summary; it must never read mood from a face or voice and must never decide when to alert a clinician.
- **Simulated data labeling:** No real patient data is used. All synthetic records and demo views carry a visible `Simulated data` badge.
- **Tech stack:** Next.js (App Router) with strict TypeScript, Tailwind CSS v4, PostgreSQL/SQLite via Prisma, Zod schemas (`toSafeClinicFlagView` enforcing privacy boundaries), MediaPipe Tasks Vision, Vitest, and Playwright.

## Brand Commitments
- Name: **Cepheus** (subtitle: *Beyond the Clinic · Post-TMS Follow-Up*).
- Mark: Minimal 5-star Cepheus constellation house-pentagon emblem.
- Voice: Calm, plainspoken, non-judgmental, clinically honest, and reassuring without false cheerfulness.

## Evidence on Hand
- Deterministic 8-week post-TMS synthetic person generator (`src/lib/simulation/person-generator.ts`) and shared constants (`src/lib/constants.ts`).
- Tested domain modules for rhythm/sleep regularity (`src/domain/signals/`), baseline comparison (`src/domain/baseline/`), warning rules (`src/domain/warning/`), crisis triggers (`src/domain/crisis/`), rounds scheduling (`src/domain/rounds/`), and on-device camera geometry (`src/domain/camera/`).
- Literature and clinical rationale in `docs/plan.md`, `docs/general-plan.md`, `docs/decisions.md`, and `docs/research/`.
- No real patient data, clinical trial outcomes for Cepheus itself, or live hospital EHR integrations exist; future work must never fabricate clinical efficacy claims or testimonials.

## Product Principles
1. **The recipient sets the complexity:** A patient who is unwell gets one calm, low-effort option; the healthcare team gets structured context and actions.
2. **Human conversation resolves ambiguity:** Questionnaires and passive signals decide *when* a nurse should call; the nurse's conversation decides what is happening.
3. **Silence is data, never a failure:** Stopping check-ins while passive wearable contact continues is treated as an outreach signal for the care team, never a compliance penalty for the patient.
4. **Privacy by architecture, not policy:** Raw camera/audio frames stay in browser memory and raw sensor traces stay behind schema boundaries (`toSafeClinicFlagView`).
5. **Safety precedes schedule:** Crisis support (`112`, MIELI, clinic nurse) is always visible and immediate, with no AI or queue in between.

## Accessibility & Inclusion
- Designed for people experiencing depressive fatigue, psychomotor slowing, and reduced concentration: short sentences, generous tap targets (`40px` minimum on 1–5 scale buttons), explicit "Not today" escape hatch, high-contrast warm ink on birch paper (`#1a2421` on `#f7f4ef` / `#ffffff`), keyboard focus rings (`focus-visible:ring-2 focus-visible:ring-[#255748]`), semantic landmarks (`role="region"`, `role="tablist"`, `role="status"`), and `tabular-nums` for clinical dates and metrics.
