# Cepheus — Submission Draft

## 1. One line

A home check-in companion supporting recovery after depression treatment with TMS, raising early relapse risk flags for clinic review.

## 2. Short description

Cepheus is a home wellbeing companion for people who have completed hospital depression treatment with Transcranial Magnetic Stimulation (TMS). Built around a twice-weekly check-in that takes twenty seconds, it gathers two mood taps, periodic questionnaires, and optional on-device sensor signals without scores or streaks. It operates on the principle of Ask, Warn, Call: software notices routine drift or silence, never diagnoses or predicts, and raises a structured flag for a clinic nurse. A clinician reviews the flag and reaches out person-to-person to offer support or schedule a five-session maintenance booster before full relapse occurs.

## 3. The problem

After acute depression treatment with TMS, sustained response is only 46.3% at 12 months (Senova et al. 2019, `docs/research/4-relapse-after-tms.md`). In follow-up trials, 38% of patients showed symptom worsening, yet 84.2% of them regained benefit when TMS was reintroduced (Janicak et al. 2010, `docs/research/4-relapse-after-tms.md`). In routine healthcare, aftercare is often limited to one telephone call after seven days, leaving monitoring passive and patient-initiated (Mallon et al. 2022, `docs/research/4-relapse-after-tms.md`). In Finland, fewer than 800 people received TMS in 2022 despite 10,000 to 20,000 treatment-resistant depression cases, and repeat courses require a new referral (reported in `docs/research/4-relapse-after-tms.md`). Between clinic visits, patients are left unmonitored until full relapse occurs.

## 4. What it does

- Check-in flow (`src/app/check-in/page.tsx`, `src/components/check-in-interactive.tsx`): twice-weekly check-in with tactile word-labelled pills ('Very low' to 'Very good', 'Not at all' to 'Very much'), optional fortnightly PHQ-9 (`src/domain/instruments/index.ts`), and a guilt-free skip option ("Not today").
- On-device speech and typed input (`src/components/check-in-voice-input.tsx`, `src/domain/arduino/voice.ts`): typed and spoken answers, mapped deterministically to choices (the check that speech is recognised on the device is listed under "Merging on 15 Nov"; until it is merged the browser's own speech service is used); crisis words immediately trigger emergency guidance; audio and transcripts are dropped from memory without storage.
- Bedside voice kiosk (`hardware/uno-q/voice_kiosk.py`, `src/app/api/arduino/check-in/route.ts`): dedicated Arduino UNO Q device with Bluetooth audio answering check-in rounds through shared transactional use cases.
- Transactional persistence and data minimisation (`src/usecases/submit-taps.ts`, `src/server/db/rounds.ts`, `prisma/schema.prisma`): questionnaire answers are validated and processed in memory; only aggregate status, scores, and derived states are stored in PostgreSQL.
- Immediate crisis escalation (`src/components/crisis-help-bar.tsx`, `src/domain/crisis/index.ts`): any non-zero response to PHQ-9 item 9 or bedside crisis button immediately displays direct human emergency help and alerts the clinic.
- Patient suggestions and guided tools (`src/app/patient/page.tsx`, `src/components/patient-suggestion-card.tsx`, `src/components/guided-activity-widget.tsx`): gentle single-action suggestion card offering an interactive 10-minute walk timer and an animated 3-minute paced breathing circle, without streaks or scores.
- Clinic follow-up dashboard (`src/app/clinic/page.tsx`, `src/components/clinic-flags-view.tsx`, `src/components/clinic-flag-card.tsx`, `src/domain/flags/index.ts`): displays open follow-up flags showing broad life areas (`check_in`, `sleep`, `daily_routine`), never raw patient answers.
- Automated round closing and warning rule evaluation (`src/app/api/clinic/flags/route.ts`, `src/usecases/close-elapsed-rounds.ts`, `src/domain/warning/index.ts`): server closes elapsed rounds and evaluates the multi-round warning rule when staff inspect flags, identifying sustained silence as an outreach signal.
- Verified nurse pre-call brief (`src/components/clinic-nurse-brief-panel.tsx`, `src/server/verda/client.ts`): optional Verda Gemma integration (off by default) that formats verified derived numbers into concise pre-call summary sentences for clinicians.
- Circadian rhythm analytics and baselines (`src/domain/signals/interdaily-stability.ts`, `src/domain/signals/sleep-regularity.ts`, `src/domain/baseline/index.ts`): calculates interdaily stability, intradaily variability, relative amplitude, sleep regularity index, and rolling personal baselines.
- On-device camera kinematics (`src/app/camera/page.tsx`, `src/components/camera-check-session.tsx`, `src/domain/camera/metrics.ts`): browser-based MediaPipe Face Landmarker running in WebAssembly to track head pose and expressivity blendshapes, with zero video frames leaving the browser.
- Wearable and phone sync (`src/app/monitoring/page.tsx`, `src/app/api/fitbit/`, `src/app/api/webhooks/health-connect/route.ts`, `src/domain/health-connect/pairing.ts`): Fitbit OAuth2 PKCE integration and Health Connect / Apple Health webhooks with authenticated QR pairing.
- Granular sensor consent (`src/components/monitoring/consent-section.tsx`, `src/server/monitoring/store.ts`): passive sensors default to paused (`false`) until opted in, and device connection status is shown separately from consent permissions.
- Authentication and security hardening (`src/server/auth/session.ts`, `src/server/auth/guards.ts`, `src/components/auth-forms.tsx`, `src/app/sign-in/page.tsx`, `next.config.ts`, `src/__tests__/no-raw-logging.test.ts`, `src/__tests__/storage-boundary.test.ts`): AES-256-GCM sealed session cookies, role-scoped route guards, one-click simulated authentication for sample profiles, strict CSP headers, and automated tests enforcing zero raw logging and strict storage boundaries.
- 3D-printable hardware enclosure (`hardware/enclosure/build_enclosure.py`, `hardware/enclosure/README.md`): Desk Buddy bedside unit with a physical flip-up privacy visor covering the camera when at rest.

### Merging on 15 Nov

- Rotating GAD-7 anxiety questionnaire on the check-in screen (`src/domain/instruments/gad7.ts`, `src/components/check-in-interactive.tsx`).
- Strict on-device voice gate refusing cloud transcription and verifying local speech recognition support before enabling microphone input (`src/components/check-in/on-device-speech.ts`).
- Direct human crisis help alert sent to the clinic from the check-in screen (`/api/check-in/crisis`).
- Interactive demo page with time progression to advance hours or days, close rounds, trigger warning rules, reset clocks, and switch sample patients (`/demo`).
- Public data protection page and compliance documentation (`/privacy`, `docs/privacy/`).
- Persistent clinic actions recording nurse call outcomes and booster offers directly to PostgreSQL storage from `/clinic` (`/api/clinic/nurse-calls`).
- Patient suggestion card wired to database storage (`/api/patient/suggestion`).
- Rewards page with simulated payouts, ledger balances, and small everyday tasks with "done" and "not today" options (`/rewards`, `src/domain/rewards/`).
- Camera kinematics readings saved to PostgreSQL storage (`/api/camera/readings`).
- Layered consent screen presenting privacy permissions in progressive steps on first sign-in (`/consent`).

## 5. What it deliberately does not do

- No diagnosis or treatment claim: the product does not diagnose, treat, or prevent depression, and makes no claim to predict an individual's relapse.
- No brain measurement or brain stimulation at home: it does not record EEG, measure brain waves, or deliver electric or magnetic stimulation outside a clinic.
- No mood reading from face or voice by an AI model: artificial intelligence models never evaluate emotional affect, mood, or sentiment from facial video or acoustic recordings.
- No automated clinical alerts or triage decisions: software identifies broad pattern shifts and routine drift, but the decision to contact a patient or alter care rests entirely with a qualified clinician.
- No streaks, scores, or gamified pressure: check-ins carry zero scores or streaks; missed rounds are recorded neutrally as missed events, never penalized.
- Zero audio or video frames stored or transmitted: camera kinematics and voice recognition execute entirely on-device; only derived numeric features are stored, with zero bytes of raw audio or video leaving the device.
- Simulated data only: all patient data in the repository and the demo is simulated, and is labelled as simulated where it is shown.
- Direct human crisis path: questions touching mood or self-harm provide direct routes to human emergency services and professional hotlines, with no automated bot conversation in between.

## 6. How it was built

Built with Next.js (App Router, React 19), strict TypeScript, and Tailwind CSS. Data persistence uses PostgreSQL via Prisma, with embedded-postgres providing isolated test databases. Domain rules, signal mathematics, and circadian calculations are implemented as pure, tested TypeScript functions validated with Zod. Face kinematics run client-side using MediaPipe in WebAssembly; edge monitoring scripts use Python on Arduino UNO Q. Development followed a test-first methodology using Vitest and Playwright, including automated scanners enforcing zero raw logging and strict storage boundaries. Every code change was developed as a scoped Entire trail, reviewed cold by a fresh agent with documented findings, and merged only after passing full unit, database, and browser test gates.

## 7. Best Use of Entire

The team hosted the repository on Entire from the beginning, structuring every development change as an Entire trail with clear intent, isolated branch, and recorded findings. To enable safe multi-agent collaboration, agents were instructed at session start to list open trails and consult `docs/tasks.md`, preventing duplicate work. Before any merge into main, a fresh agent conducted a cold review on the trail, producing findings addressed in follow-up commits. On main, `git log --oneline | wc -l` counts 315 commits, while `git log --merges --oneline | wc -l` counts 63 merge commits. Filtering commit subject lines with `git log --grep="[Tt]rail" --oneline | wc -l` identifies 39 commits explicitly referencing trails, and `git log --grep="[Mm]erge" --oneline | wc -l` identifies 81 referencing merges. Trails up to #74 are documented across work packages. Uncompleted items from `docs/side-challenges.md`: TO FILL BY THE TEAM: token figures from `entire session tokens` and `entire tokens profile` demonstrating measurable token efficiency; TO FILL BY THE TEAM: generated summary of agent dispatch via `entire dispatch`; TO FILL BY THE TEAM: documented cross-machine agent handover using `entire trail resume`.

## 8. Demo script

1. Visit `/sign-in` and sign in with one click as a simulated recovering patient (`P-SIM-001`).
2. Review the layered consent screen (`/consent`) and configure granular permissions for passive sensors.
3. Complete the twice-weekly check-in on `/check-in` with two quick taps on tactile mood and interest pills.
4. Answer rotating PHQ-9 and GAD-7 clinical questionnaires on `/check-in` using tap pills and typed input.
5. Speak a check-in answer into the bedside kiosk or browser speech interface with local, on-device recognition.
6. Trigger the crisis path via question 9 or help button, displaying emergency numbers and raising a clinic crisis alert.
7. Open `/patient` to view a gentle suggestion, start the 3-minute breathing circle or 10-minute walk timer, and view simulated rewards on `/rewards`.
8. Sign in as clinic nurse (`nurse@sim-clinic.local`) on `/clinic`, view the flag card explaining routine drift, and record a call outcome.
9. Navigate to `/demo`, advance time to let a round elapse unanswered, observe the newly raised silence flag, and reset the timeline.
10. Open `/privacy` to inspect the complete data inventory, local processing guarantees, and security boundary documentation.

## 9. Links

- Public repository: https://github.com/Tonttu84/cepheus (a copy of `main` with its full
  history; the working repository is hosted on Entire).
- Promotional video:
  https://github.com/Tonttu84/cepheus/blob/main/promotional-video/generated/cepheus_promo_full.mp4
- Entire trails: https://entire.com/et/crunchproject/-/trails (every change, one trail
  each). The combined check-in, demo, clinic and rewards work is trail 82:
  https://entire.com/et/crunchproject/-/trails/82, and the core loop on the database is
  trail 72: https://entire.com/et/crunchproject/-/trails/72.
