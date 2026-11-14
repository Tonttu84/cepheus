import type { Dictionary } from "./types";

/**
 * English reference dictionary.
 * Contains word-for-word all user-facing texts from pages and components on main.
 */
export const EN_DICTIONARY: Dictionary = {
  // Layout & metadata
  "layout.meta.title": "Cepheus — Beyond the Clinic",
  "layout.meta.description":
    "Post-TMS home wellbeing check-in companion supporting patient self-care and clinic follow-up.",
  "layout.footer.disclaimer":
    "Wellbeing check-in prototype for post-TMS follow-up. Not a diagnostic or medical device; makes no treatment or relapse-prediction claims.",
  "layout.footer.privacy":
    "Camera & microphone inputs stay on-device; only derived numbers are stored.",

  // Primary navigation
  "nav.brand": "Cepheus",
  "nav.tagline": "Beyond the Clinic · Post-TMS Home Follow-Up",
  "nav.ariaLabel": "Primary navigation",
  "nav.overview": "Overview",
  "nav.checkIn": "Check-in",
  "nav.camera": "Camera check",
  "nav.patient": "Patient view",
  "nav.clinic": "Clinic view",

  // Badges
  "badge.simulatedData": "Simulated data",
  "badge.defaultSubtitle": "8-week post-TMS synthetic trajectory",

  // Crisis help bar (Crisis path)
  "crisisBar.ariaLabel": "Immediate support and emergency help",
  "crisisBar.heading": "Need someone right now?",
  "crisisBar.subtitle":
    "Direct connection to a person — nothing automated in between.",
  "crisisBar.emergencyButton": "Emergency 112",
  "crisisBar.mieliButton": "MIELI Crisis Helpline 09 2525 0111 — 24/7 person",
  "crisisBar.clinicButton": "{label}: {phone}",

  // Shared crisis resources (Crisis path)
  "crisis.emergency.label": "Emergency Services (112)",
  "crisis.emergency.phone": "112",
  "crisis.emergency.availability": "24/7 immediate emergency response",
  "crisis.emergency.description":
    "Call 112 immediately if you are in immediate danger or need urgent medical help.",
  "crisis.mieli.label": "MIELI Crisis Helpline",
  "crisis.mieli.phone": "09 2525 0111",
  "crisis.mieli.availability": "24/7 direct conversation with a crisis worker",
  "crisis.mieli.description":
    "Speak directly with a trained person right now. No menus or automated chat.",
  "crisis.tmsClinic.label": "TMS Clinic Nurse Line",
  "crisis.tmsClinic.phone": "09 471 71200",
  "crisis.tmsClinic.availability": "Same-day clinical team contact",
  "crisis.tmsClinic.description":
    "Reach the TMS care team directly to talk with a nurse about how you are doing.",
  "crisis.section.title": "Direct human support is always available right now",
  "crisis.section.subtitle":
    "Whether or not you complete a check-in, you can reach a person directly at any hour:",

  // Home / Overview page
  "home.badge.subtitle": "8-week post-TMS synthetic trajectory (Days 1–56)",
  "home.dataSource.seeded":
    "Data source: PostgreSQL seeded participant (sim-post-tms-01)",
  "home.dataSource.memory": "Data source: In-memory deterministic simulation",
  "home.hero.title": "Cepheus — Staying Well After TMS Treatment",
  "home.hero.description":
    "A calm home wellbeing check-in companion for the months after Transcranial Magnetic Stimulation (TMS). Cepheus pairs a low-effort twice-weekly check-in and passive smart-ring sleep rhythm with two proportionate loops: a single small step for the patient on a mild dip, and a broad-area flag supporting the clinic's judgment on when to check in after sustained drift.",
  "home.hero.participant": "Participant: {label}",
  "home.hero.tmsCompleted": "TMS course completed: {date}",
  "home.hero.consentedChannels": "Active consented channels: {count}",
  "home.workstreams.ariaLabel": "Workstream modules",
  "home.workstreams.title": "Explore Workstreams",
  "home.workstreams.subtitle": "All views use simulated data only",
  "home.card.checkIn.category": "Twice-Weekly Check-In & Fortnightly PHQ-9",
  "home.card.checkIn.title": "Low-effort wellbeing check-in",
  "home.card.checkIn.description":
    'Four 1–5 tap questions twice a week, explicit "Not today" skip, missed answers recorded as missed (never punished), and an immediate human crisis path.',
  "home.card.checkIn.link": "Open check-in flow →",
  "home.card.camera.category": "On-Device Sensing",
  "home.card.camera.title": "On-device camera wellbeing check",
  "home.card.camera.measures.description":
    "MediaPipe Face Landmarker runs locally in your browser to compute derived facial expressivity and head movement numbers only — never storing video or images.",
  "home.card.camera.link": "Open camera check →",
  "home.card.patient.category": "Inner Loop · Day 29 Small Dip",
  "home.card.patient.title": "Patient view: One small step for today",
  "home.card.patient.description":
    'Surfaces one low-effort suggestion ("Take a 10-minute walk outside") during a mild dip, with zero scores, zero graphs, and zero risk labels.',
  "home.card.patient.link": "Open patient view →",
  "home.card.clinic.category": "Outer Loop · Day 56 Sustained Drift",
  "home.card.clinic.title": "Clinic view: Broad-area flag & nurse outreach",
  "home.card.clinic.description":
    "Supports the clinic's judgment on when to check in by showing broad life areas and since when, plus actions to request a nurse call or offer a 5-session booster cluster.",
  "home.card.clinic.link": "Open clinic overview →",

  // Demo timeline preview
  "demo.timeline.ariaLabel": "Interactive post-TMS demo timeline",
  "demo.timeline.title": "8-Week Post-TMS Demo Trajectory",
  "demo.timeline.description":
    "Switch between three moments to see how the same dataset supports low-effort patient steps and broad-area clinic follow-up.",
  "demo.timeline.tablistAriaLabel": "Select demo moment",
  "demo.badge.dayWeek": "Day {dayIndex} · Week {weekNumber}",
  "demo.button.well": "Day 18 · Well",
  "demo.button.small_dip": "Day 29 · Small dip",
  "demo.button.sustained_drift": "Day 56 · Sustained drift & silence",
  "demo.moment.well.title": "Week 3: Steady Baseline",
  "demo.moment.well.subtitle":
    "Twice-weekly wellbeing check-in takes ~20 seconds while sleep and daytime rhythm stay close to personal baseline.",
  "demo.moment.small_dip.title": "Week 5: Small Dip",
  "demo.moment.small_dip.subtitle":
    "A mild one-round dip below personal baseline surfaces one low-effort suggestion on the patient phone — no graphs or risk scores.",
  "demo.moment.sustained_drift.title": "Week 8: Sustained Drift & Silence",
  "demo.moment.sustained_drift.subtitle":
    "Two consecutive lowered check-ins followed by unanswered rounds while the ring remains worn raise a broad-area flag for a nurse call.",
  "demo.loop.none": "Active loop: Quiet baseline (no alert)",
  "demo.loop.patient": "Active loop: Patient one-button step",
  "demo.loop.clinic": "Active loop: Clinic nurse outreach",
  "demo.col1.title": "1 · Check-In & Rhythm",
  "demo.col1.link": "Open check-in",
  "demo.col2.title": "2 · Patient View",
  "demo.col2.link": "Open patient view",
  "demo.col3.title": "3 · Clinic View",
  "demo.col3.link": "Open clinic view",
  "demo.latestRound.completed": "Completed on {date} (Week {weekNumber})",
  "demo.latestRound.notToday": 'Skipped ("Not today") on {date}',
  "demo.latestRound.missed":
    "Unanswered round on {date} (recorded as missed, never scored as zero)",
  "demo.latestRound.none": "No rounds scheduled yet",
  "demo.ring.worn": "Smart ring worn ({wearMinutes} min/day on {date})",
  "demo.ring.notActive": "Smart ring not active",
  "demo.checkInNote.well":
    "Twice-weekly check-in and sleep regularity stay steady within personal post-TMS baseline.",
  "demo.checkInNote.small_dip":
    "A mild one-round dip appears in Week 5 while check-ins remain answered.",
  "demo.checkInNote.sustained_drift":
    "{count} unanswered rounds in Week 8 while the smart ring remains actively worn.",
  "demo.patientSummary.small_dip.headline": "One small step for today",
  "demo.patientSummary.small_dip.note":
    "Shown on a mild dip — one low-effort action button, with zero graphs, scores, or streaks.",
  "demo.patientSummary.well.headline":
    "Everything steady — nothing asked of you today",
  "demo.patientSummary.well.note":
    "When check-ins are steady, the app stays quiet and asks nothing extra.",
  "demo.patientSummary.sustained_drift.headline":
    "Gentle check-in & human outreach",
  "demo.patientSummary.sustained_drift.actionTitle":
    "Your care team nurse can check in with you by phone",
  "demo.patientSummary.sustained_drift.crisis.actionDetail":
    "Missed rounds are never punished; direct crisis & clinic nurse lines stay one tap away.",
  "demo.patientSummary.sustained_drift.note":
    "After sustained drift and unanswered rounds, outreach shifts to a human nurse call.",
  "demo.clinicSummary.openFlag": "Broad-area check-in flag since {sinceDate}",
  "demo.clinicSummary.noFlag": "No clinic outreach needed",
  "demo.clinicSummary.silenceRingActive":
    "Smart ring remains worn during missed check-in rounds.",
  "demo.clinicSummary.flagNote":
    "Supporting the clinic's judgment on when to check in — naming broad life areas and since when, never raw sensor traces.",
  "demo.clinicSummary.wellNote":
    "Baseline weeks establish personal reference ranges; no clinic flag is raised.",
  "demo.clinicSummary.smallDipNote":
    "A single mild dip is handled gently on the patient side without raising a clinic alert.",

  // Check-in page
  "checkIn.badge.subtitle": "Twice-weekly check-in & fortnightly PHQ-9",
  "checkIn.badge.timeTag": "Takes ~20 seconds · Zero effort when unwell",
  "checkIn.header.title":
    "Twice-weekly wellbeing check-in & fortnightly PHQ-9",
  "checkIn.header.description":
    'Designed for low effort after TMS treatment. You can answer four brief 1–5 tap questions twice a week, or tap "Not today" at any time. A skipped or missed check-in is recorded simply as a missed round — never scored as zero and never punished.',
  "checkIn.consent.ariaLabel": "Active consent transparency",
  "checkIn.consent.title": "What is recorded & your consent controls",
  "checkIn.consent.description":
    "Every wellbeing check-in channel states in plain language what is recorded and which broad life area it belongs to.",
  "checkIn.consent.badge": "Consented",
  "checkIn.prompts.ariaLabel": "Twice-weekly check-in prompts",
  "checkIn.prompts.title": "Twice-weekly check-in prompts (4 quick taps)",
  "checkIn.prompts.subtitle":
    'If 4 taps feel like too much today, you can answer a single overall check-in question or choose "Not today".',
  "checkIn.button.notToday": "Not today (skip without penalty)",
  "checkIn.prompts.itemHeader": "Prompt {number} · {label}",
  "checkIn.prompts.anchorArrow": "{lowAnchor} → {highAnchor}",
  "checkIn.items.mood.label": "Overall mood",
  "checkIn.items.mood.prompt":
    "How has your mood felt over the last couple of days?",
  "checkIn.items.mood.lowAnchor": "Very low",
  "checkIn.items.mood.highAnchor": "Steady and well",
  "checkIn.items.interest.label": "Interest in everyday things",
  "checkIn.items.interest.prompt":
    "How much have you been able to enjoy or take interest in small things?",
  "checkIn.items.interest.lowAnchor": "Not at all",
  "checkIn.items.interest.highAnchor": "As usual for me",
  "checkIn.items.energy.label": "Daytime energy",
  "checkIn.items.energy.prompt":
    "How has your energy felt for ordinary daily tasks?",
  "checkIn.items.energy.lowAnchor": "Exhausted",
  "checkIn.items.energy.highAnchor": "Rested enough",
  "checkIn.items.rumination.label": "Ease of letting worries go",
  "checkIn.items.rumination.prompt":
    "How easy has it been to step back from repetitive heavy thoughts?",
  "checkIn.items.rumination.lowAnchor": "Stuck in loops",
  "checkIn.items.rumination.highAnchor": "Clear and settled",
  "checkIn.crisis.fortnightlyAriaLabel":
    "Fortnightly PHQ-9 and immediate human support",
  "checkIn.crisis.fortnightlyTitle":
    "Fortnightly PHQ-9 & Immediate Human Crisis Path",
  "checkIn.crisis.fortnightlyDescription":
    "Every two weeks, the standard 9-item PHQ-9 questionnaire checks in on sleep, energy, appetite, concentration, and safety. Any response indicating thoughts of self-harm (Item 9) brings up direct connection to a human and emergency services immediately — with nothing automated in between.",

  // Patient view page
  "patient.badge.subtitle": "Day 29 · Week 5 gentle check-in view",
  "patient.header.tag": "Patient View",
  "patient.header.title": "One small step for today",
  "patient.header.description":
    "When a recent check-in feels a little heavier than usual, Cepheus offers one simple, low-effort option for today. You can try it now or leave it for later — whatever feels manageable.",
  "patient.card.ariaLabel": "Today's low-effort step",
  "patient.card.gentleOptionTag": "Gentle option · ~10 minutes",
  "patient.button.accept": "I'll try this today",
  "patient.button.skip": "Not today",
  "patient.crisis.reassuranceNote":
    "You can always skip a suggestion or a check-in without penalty. If you ever want to talk with someone directly, the TMS clinic nurse line and 24/7 crisis support are at the top of this screen.",
  "patient.suggestions.shortWalk.title": "Take a 10-minute walk outside",
  "patient.suggestions.shortWalk.detail":
    "Step outside for ten minutes at an easy pace. No targets, no tracking.",
  "patient.suggestions.breathingSpace.title":
    "Take a 3-minute slow breathing pause",
  "patient.suggestions.breathingSpace.detail":
    "Sit comfortably and let your breath slow down for three minutes.",
  "patient.suggestions.brightLight.title":
    "Sit by daylight or a bright window for 10 minutes",
  "patient.suggestions.brightLight.detail":
    "Spend ten quiet minutes near natural daylight or a bright lamp.",
  "patient.suggestions.socialContact.title":
    "Send one short message to someone you trust",
  "patient.suggestions.socialContact.detail":
    "A simple hello or one-line check-in with a friend or family member.",

  // Clinic view page
  "clinic.badge.subtitle": "Day 56 · Week 8 clinic outer-loop view",
  "clinic.header.tag": "TMS Care Team Overview",
  "clinic.header.title": "TMS outer-loop clinic overview",
  "clinic.header.description":
    "Supporting the clinic's judgment on when to check in with a post-TMS participant. Flags name only the broad life area(s) and since when — never raw sensor traces, transactions, or automated diagnostic claims.",
  "clinic.card.ariaLabel": "Broad-area clinic flag",
  "clinic.card.openFlagBadge": "Open follow-up flag · Since {sinceDate}",
  "clinic.card.participantSubtitle":
    "TMS course completed: {tmsCompletedDate} · Current follow-up point: Day 56 (Week 8)",
  "clinic.card.broadAreaBadge": "Broad-area summary only",
  "clinic.card.broadAreasHeading": "Broad areas shifted since {sinceDate}",
  "clinic.card.silenceBoxTitle":
    "Check-in silence with active wearable contact",
  "clinic.card.silenceBoxDescriptionActive":
    "Two consecutive lowered twice-weekly check-ins were followed by unanswered rounds in Week 8 while the smart ring remained actively worn (ring active during missed rounds). Missed check-ins are treated as an outreach signal, never scored as zero.",
  "clinic.card.silenceBoxDescriptionInactive":
    "Two consecutive lowered twice-weekly check-ins were followed by unanswered rounds in Week 8 while the smart ring remained actively worn (ring inactive). Missed check-ins are treated as an outreach signal, never scored as zero.",
  "clinic.button.nurseCall": "Request nurse call",
  "clinic.button.booster": "Offer 5-session booster cluster",
  "clinic.footer.privacyNote":
    "Privacy & clinical boundary: This view exposes only broad life areas (check_in, sleep, daily_routine) and the date since shift began. Detailed check-in notes or individual measurements are shown only if the participant explicitly chooses to share them with the clinic.",

  // Broad areas
  "broadArea.check_in": "Twice-weekly check-in",
  "broadArea.sleep": "Sleep regularity",
  "broadArea.daily_routine": "Daily routine",
  "broadArea.activity_outside_home": "Activity outside the home",
  "broadArea.financial_routine": "Financial routine",

  // Measurement method descriptions
  "measurementMethod.check_in.label": "Twice-weekly wellbeing check-in",
  "measurementMethod.check_in.description":
    "Records your 1–5 tap answers twice a week and whether a scheduled check-in was skipped or missed. Missed rounds are never scored as zero.",
  "measurementMethod.phq9.label": "Fortnightly PHQ-9 questionnaire",
  "measurementMethod.crisis.phq9.description":
    "Records your 9 standard fortnightly wellbeing answers (0–3 each). Any answer on item 9 shows direct human and emergency support immediately.",
  "measurementMethod.ring_rhythm.label": "Smart ring sleep & daytime rhythm",
  "measurementMethod.ring_rhythm.description":
    "Records daily sleep timing, sleep regularity, and 24-hour activity rhythm summaries compared against your own initial weeks.",
  "measurementMethod.camera_expressivity.label": "On-device camera check-in",
  "measurementMethod.camera.measures.description":
    "Processes a short clip inside your browser to store only derived movement and expression summary numbers. Video frames never leave your device.",
  "measurementMethod.speech_rate.label": "Read-aloud speech timing",
  "measurementMethod.speech_rate.description":
    "Measures speaking rate and pause lengths on your device during a short passage reading. No audio or words are stored.",
  "measurementMethod.ambiguous_faces.label": "Brief interpretation game",
  "measurementMethod.ambiguous_faces.description":
    "Stores only summary counts and reaction times from a quick weekly scenario game.",
  "measurementMethod.home_routine.label": "Home daily routine summary",
  "measurementMethod.home_routine.description":
    "Stores coarse weekly routine counts only. Never raises a clinic flag on its own unless your check-in also shifts for at least a week.",
  "measurementMethod.financial_routine.label":
    "Financial routine summary (optional)",
  "measurementMethod.financial_routine.description":
    "Stores only coarse period counts, never merchants or transactions. Even if shared, the clinic only ever sees the words 'financial routine'.",

  // Camera page & components
  "camera.badge.subtitle": "On-device MediaPipe summary numbers only",
  "camera.header.tag": "100% In-Browser Processing · Zero Video Stored",
  "camera.header.title": "On-device camera wellbeing check",
  "camera.header.measures.description":
    "During an optional brief check-in, MediaPipe Face Landmarker runs locally inside your browser on your device. Only two summary numbers measuring movement of the face and head are saved — never video recordings, never image frames, and never audio.",
  "camera.privacy.ariaLabel": "On-device privacy guarantee",
  "camera.privacy.step1Tag": "Step 1 · Local WebAssembly",
  "camera.privacy.step1Title": "Processed on your device",
  "camera.privacy.measures.step1Description":
    "Camera frames are analysed frame-by-frame in browser memory using MediaPipe Face Landmarker and discarded immediately after each frame.",
  "camera.privacy.step2Tag": "Step 2 · Derived Numbers Only",
  "camera.privacy.step2Title": "Movement of the face and head",
  "camera.privacy.measures.step2Description":
    "Only summary numbers measuring movement of the face and head are kept.",
  "camera.privacy.step3Tag": "Step 3 · No Model Judges Mood or Health",
  "camera.privacy.step3Title": "Supporting context only",
  "camera.privacy.measures.step3Description":
    "No model judges mood or health. The camera measures movement of the face and head only.",
  "camera.preview.ariaLabel": "Derived numerical summary preview",
  "camera.preview.title": "Example stored payload (derived numbers only)",
  "camera.preview.measures.description":
    "Simulated reading from {date} (Day {dayIndex}) — no image or video bytes exist in the database.",
  "camera.preview.badge": "Day {dayIndex} derived record",
  "camera.metrics.clipDuration": "Clip duration",
  "camera.metrics.expressivityIndex": "Expressivity index",
  "camera.metrics.headAngularPath": "Head angular path",
  "camera.metrics.videoAudioStored": "Video / audio stored",
  "camera.metrics.noneZeroBytes": "None (0 bytes)",
  "camera.idle.title": "Start camera check-in",
  "camera.idle.measures.p1":
    "The camera looks at movement of the face and head for about 20 seconds.",
  "camera.idle.measures.p2":
    "The video stays on this device, is analysed entirely in memory, and is never recorded or saved.",
  "camera.idle.measures.p3":
    "Only two summary numbers measuring movement are kept. No model judges mood or health.",
  "camera.idle.button.start": "Start camera check",
  "camera.idle.accessNote": "Camera is accessed only after clicking Start",
  "camera.preparing.ariaLabel": "Preparing camera check",
  "camera.preparing.loadingModel": "Preparing on-device analysis tools...",
  "camera.preparing.requestingCamera": "Opening camera on this device...",
  "camera.preparing.note":
    "Everything runs in your browser without transmitting video bytes.",
  "camera.preparing.button.cancel": "Cancel",
  "camera.recording.ariaLabel": "Active camera check-in",
  "camera.recording.title": "Check-in in progress",
  "camera.recording.measures.description":
    "Please look towards your screen naturally. No video is recorded.",
  "camera.recording.button.stop": "Stop check",
  "camera.recording.measures.analysingMovement": "Analysing movement",
  "camera.recording.remainingSec": "{remainingSec}s remaining",
  "camera.completed.ariaLabel": "Camera check-in complete",
  "camera.completed.badge": "Check-in finished",
  "camera.completed.title": "Your camera check-in is complete",
  "camera.completed.measures.description":
    "Camera access has been closed and all tracks were stopped. The video frames were analysed in memory and discarded.",
  "camera.completed.measures.summaryTitle":
    "View movement measurements (2 numbers)",
  "camera.completed.summaryHint": "Click to expand / collapse",
  "camera.completed.measures.disclaimer":
    "These numbers measure movement of the face and head. No model judges mood or health.",
  "camera.completed.measures.facialDispersion": "Facial movement dispersion",
  "camera.completed.measures.facialDispersionNote":
    "Mean variation in facial movement across frames",
  "camera.completed.measures.headSpeed": "Head movement speed",
  "camera.completed.measures.headSpeedNote":
    "Average frame-to-frame change of head rotation angles",
  "camera.completed.measures.quality":
    "Quality: {analysedFrames} frames evaluated ({faceShare}% face presence) over {duration}s.",
  "camera.completed.button.startAnother": "Start another check-in",
  "camera.stopped.ariaLabel": "Check-in stopped",
  "camera.stopped.title": "Check-in stopped",
  "camera.stopped.measures.description":
    "The camera check was stopped before completion. The camera was released immediately and no measurements were kept.",
  "camera.stopped.button.startOver": "Start over",
  "camera.problem.permissionDenied.ariaLabel": "Camera permission refused",
  "camera.problem.permissionDenied.title":
    "Camera access permission was not granted",
  "camera.problem.permissionDenied.measures.description":
    "To measure movement on this device, your browser needs camera permission. You can enable camera access in your browser site settings or address bar.",
  "camera.problem.permissionDenied.button.tryAgain": "Try again",
  "camera.problem.noCamera.ariaLabel": "No camera detected",
  "camera.problem.noCamera.title": "No camera was found on this device",
  "camera.problem.noCamera.description":
    "Please plug in or connect a standard webcam, or open this check-in on a mobile phone or laptop with a built-in camera.",
  "camera.problem.noCamera.button.tryAgain": "Try again",
  "camera.problem.modelError.ariaLabel": "Model loading failure",
  "camera.problem.modelError.title": "Analysis tools could not be loaded",
  "camera.problem.modelError.description":
    "The on-device face analysis files could not be initialized. Please refresh the page or check that the local files are served correctly.",
  "camera.problem.modelError.button.tryAgain": "Try again",
  "camera.problem.noFaceFound.ariaLabel": "No face detected",
  "camera.problem.noFaceFound.title":
    "No face detected for most of the check-in",
  "camera.problem.noFaceFound.measures.description":
    "A face was not visible for enough of the 20-second session to produce reliable movement measurements. Please make sure your camera is pointed at your face with frontal lighting and try again.",
  "camera.problem.noFaceFound.button.tryAgain": "Try again",
  "camera.problem.genericError.ariaLabel": "Error state",
  "camera.problem.genericError.title": "Check-in could not finish",
  "camera.problem.genericError.defaultMessage":
    "An unexpected issue occurred during the check-in session.",
  "camera.problem.genericError.button.tryAgain": "Try again",
  "camera.announcement.ready": "Camera check is ready to start.",
  "camera.announcement.loadingModel": "Loading local face landmarker model...",
  "camera.announcement.modelError":
    "Could not load on-device model. Please try again.",
  "camera.announcement.openingCamera": "Opening camera...",
  "camera.announcement.permissionDenied":
    "Camera access permission was denied. Please allow camera access.",
  "camera.announcement.noCamera": "No camera was found on this device.",
  "camera.announcement.cameraError":
    "Failed to start camera. Please try again.",
  "camera.announcement.recordingStarted":
    "Camera check-in has started. Keep your face in view.",
  "camera.announcement.checkInError":
    "Check-in encountered an error: {error}",
  "camera.announcement.noFaceDetected":
    "No face was detected for enough of the check-in. Please try again.",
  "camera.announcement.completed.measures":
    "Camera check-in complete. Movement measurements are ready.",
  "camera.announcement.stopped":
    "Camera check-in was stopped. Hardware has been released.",
  "camera.announcement.readyReset": "Ready to start check-in.",

  // PHQ-9 questionnaire items & options (Questionnaire wording)
  "instruments.phq9.openingQuestion":
    "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  "instruments.phq9.item1": "Little interest or pleasure in doing things",
  "instruments.phq9.item2": "Feeling down, depressed, or hopeless",
  "instruments.phq9.item3":
    "Trouble falling or staying asleep, or sleeping too much",
  "instruments.phq9.item4": "Feeling tired or having little energy",
  "instruments.phq9.item5": "Poor appetite or overeating",
  "instruments.phq9.item6":
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "instruments.phq9.item7":
    "Trouble concentrating on things, such as reading the newspaper or watching television",
  "instruments.phq9.item8":
    "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "instruments.phq9.item9":
    "Thoughts that you would be better off dead or of hurting yourself in some way",
  "instruments.phq9.option0": "Not at all",
  "instruments.phq9.option1": "Several days",
  "instruments.phq9.option2": "More than half the days",
  "instruments.phq9.option3": "Nearly every day",
  "instruments.phq9.closingQuestion":
    "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?",
  "instruments.phq9.closingOption0": "Not difficult at all",
  "instruments.phq9.closingOption1": "Somewhat difficult",
  "instruments.phq9.closingOption2": "Very difficult",
  "instruments.phq9.closingOption3": "Extremely difficult",

  // Tap questionnaire wording & options (Questionnaire wording)
  "instruments.tap.mood.question": "How is your mood right now?",
  "instruments.tap.mood.minLabel": "very low",
  "instruments.tap.mood.maxLabel": "very good",
  "instruments.tap.interest.question":
    "How much do you feel like doing things right now?",
  "instruments.tap.interest.minLabel": "not at all",
  "instruments.tap.interest.maxLabel": "very much",
};
