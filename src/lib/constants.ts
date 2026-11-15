/**
 * Cepheus domain constants and shared configuration.
 *
 * Rules enforced here:
 * - Flags possible relapse risk for a clinician's review; makes no diagnosis,
 *   no treatment claim, gives no final judgement, and says nothing about relapse
 *   to the patient. Sensing is described as a wellbeing check-in that supports
 *   the clinic's judgment about when to act.
 * - Crisis path connects directly to emergency help (112) and human support
 *   (MIELI Crisis Helpline & TMS Clinic Nurse Line) with zero automated triage.
 * - Low-effort patient suggestions exclude happy-memory recall, sad music, and
 *   cold water.
 * - Personality is never shown as a label.
 */

export type DemoMomentKey = "well" | "small_dip" | "sustained_drift";

export interface DemoMomentMeta {
  key: DemoMomentKey;
  dayIndex: number;
  weekNumber: number;
  title: string;
  subtitle: string;
  recipient: "none" | "patient" | "clinic";
}

export const DEMO_MOMENTS: Record<DemoMomentKey, DemoMomentMeta> = {
  well: {
    key: "well",
    dayIndex: 18,
    weekNumber: 3,
    title: "Week 3: Steady baseline",
    subtitle:
      "Twice-weekly check-ins take about 20 seconds, and sleep and daytime rhythm stay close to the person's own first weeks.",
    recipient: "none",
  },
  small_dip: {
    key: "small_dip",
    dayIndex: 29,
    weekNumber: 5,
    title: "Week 5: Small dip",
    subtitle:
      "One heavier check-in brings up a single small step on the patient's phone, without graphs or risk scores.",
    recipient: "patient",
  },
  sustained_drift: {
    key: "sustained_drift",
    dayIndex: 56,
    weekNumber: 8,
    title: "Week 8: Sustained drift and silence",
    subtitle:
      "Two lower check-ins followed by unanswered rounds while the ring stays worn raise a flag for a nurse call.",
    recipient: "clinic",
  },
};

export const DEMO_MOMENT_LIST: DemoMomentMeta[] = [
  DEMO_MOMENTS.well,
  DEMO_MOMENTS.small_dip,
  DEMO_MOMENTS.sustained_drift,
];

export const BROAD_AREA_KEYS = [
  "check_in",
  "sleep",
  "daily_routine",
  "activity_outside_home",
  "financial_routine",
] as const;

export type BroadAreaKey = (typeof BROAD_AREA_KEYS)[number];

export const BROAD_AREA_LABELS: Record<BroadAreaKey, string> = {
  check_in: "Twice-weekly check-in",
  sleep: "Sleep regularity",
  daily_routine: "Daily routine",
  activity_outside_home: "Activity outside the home",
  financial_routine: "Financial routine",
};

export type MeasurementMethodKey =
  | "check_in"
  | "phq9"
  | "ring_rhythm"
  | "camera_expressivity"
  | "speech_rate"
  | "ambiguous_faces"
  | "home_routine"
  | "financial_routine"
  | "detailed_answers";

export interface MeasurementMethodDescriptor {
  method: MeasurementMethodKey;
  label: string;
  broadArea: BroadAreaKey;
  core: boolean;
  defaultEnabled: boolean;
  isPersonalSignDefault: boolean;
  recordedDescription: string;
}

export const MEASUREMENT_METHODS: MeasurementMethodDescriptor[] = [
  {
    method: "check_in",
    label: "Twice-weekly wellbeing check-in",
    broadArea: "check_in",
    core: true,
    defaultEnabled: true,
    isPersonalSignDefault: true,
    recordedDescription:
      "Saves your two 0 to 4 tap answers (mood and interest) twice a week, or notes that a round was skipped or missed. Missed rounds are never scored as zero.",
  },
  {
    method: "phq9",
    label: "Fortnightly PHQ-9 questionnaire",
    broadArea: "check_in",
    core: true,
    defaultEnabled: true,
    isPersonalSignDefault: true,
    recordedDescription:
      "Saves your 9 fortnightly PHQ-9 answers (0 to 3 each). Any answer above 0 on question 9 opens direct phone links to a person and emergency help right away.",
  },
  {
    method: "ring_rhythm",
    label: "Smart ring sleep & daytime rhythm",
    broadArea: "sleep",
    core: true,
    defaultEnabled: true,
    isPersonalSignDefault: true,
    recordedDescription:
      "Saves daily sleep timing, sleep regularity, and 24-hour activity summaries, compared against your own first weeks after treatment.",
  },
  {
    method: "camera_expressivity",
    label: "On-device camera check-in",
    broadArea: "check_in",
    core: true,
    defaultEnabled: true,
    isPersonalSignDefault: false,
    recordedDescription:
      "Runs in your browser during a short check-in and saves only two summary numbers for face and head movement. Video frames never leave your device.",
  },
  {
    method: "speech_rate",
    label: "Read-aloud speech timing",
    broadArea: "check_in",
    core: false,
    defaultEnabled: false,
    isPersonalSignDefault: false,
    recordedDescription:
      "Measures speaking rate and pause lengths on your device during a short passage reading. No audio or words are stored.",
  },
  {
    method: "ambiguous_faces",
    label: "Brief interpretation game",
    broadArea: "check_in",
    core: false,
    defaultEnabled: false,
    isPersonalSignDefault: false,
    recordedDescription:
      "Stores only summary counts and reaction times from a quick weekly scenario game.",
  },
  {
    method: "home_routine",
    label: "Home daily routine summary",
    broadArea: "daily_routine",
    core: false,
    defaultEnabled: false,
    isPersonalSignDefault: false,
    recordedDescription:
      "Stores coarse weekly routine counts only. Never raises a clinic flag on its own unless your check-in also shifts for at least a week.",
  },
  {
    method: "financial_routine",
    label: "Financial routine summary (optional)",
    broadArea: "financial_routine",
    core: false,
    defaultEnabled: false,
    isPersonalSignDefault: false,
    recordedDescription:
      "Stores only coarse period counts, never merchants or transactions. Even if shared, the clinic only ever sees the words 'financial routine'.",
  },
  {
    method: "detailed_answers",
    label: "Keep individual answers",
    broadArea: "check_in",
    core: false,
    defaultEnabled: false,
    isPersonalSignDefault: false,
    recordedDescription:
      "Keep my individual answers so the service can learn what helps me. Kept on the service's server in the EU, never on this phone; only your own answers from now on. Kept so it can be used for personalisation later. Can be withdrawn at any time, and withdrawing deletes what was kept.",
  },
];

export type PatientSuggestionActionKey =
  | "short_walk"
  | "breathing_space"
  | "bright_light"
  | "social_contact";

export interface PatientSuggestionTemplate {
  actionKey: PatientSuggestionActionKey;
  actionTitle: string;
  actionDetail: string;
  effortTier: "low";
}

/**
 * Evidence-backed low-effort actions only.
 * Explicitly excludes happy-memory recall, sad music, and cold water per research findings.
 */
export const PATIENT_SUGGESTIONS: PatientSuggestionTemplate[] = [
  {
    actionKey: "short_walk",
    actionTitle: "Take a 10-minute walk outside",
    actionDetail:
      "Step outside for ten minutes at an easy pace. No targets, no tracking.",
    effortTier: "low",
  },
  {
    actionKey: "breathing_space",
    actionTitle: "Take a 3-minute slow breathing pause",
    actionDetail:
      "Sit comfortably and let your breath slow down for three minutes.",
    effortTier: "low",
  },
  {
    actionKey: "bright_light",
    actionTitle: "Sit by daylight or a bright window for 10 minutes",
    actionDetail:
      "Spend ten quiet minutes near natural daylight or a bright lamp.",
    effortTier: "low",
  },
  {
    actionKey: "social_contact",
    actionTitle: "Send one short message to someone you trust",
    actionDetail:
      "A simple hello or one-line check-in with a friend or family member.",
    effortTier: "low",
  },
];

export interface CrisisResource {
  id: string;
  label: string;
  phone: string;
  href: string;
  availability: string;
  description: string;
  kind: "emergency" | "helpline" | "clinic";
}

/**
 * Direct routes to a human and to emergency services — nothing automated in between.
 */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: "emergency_112",
    label: "Emergency Services (112)",
    phone: "112",
    href: "tel:112",
    availability: "24/7 immediate emergency response",
    description:
      "Call 112 immediately if you are in immediate danger or need urgent medical help.",
    kind: "emergency",
  },
  {
    id: "mieli_crisis_helpline",
    label: "MIELI Crisis Helpline",
    phone: "09 2525 0111",
    href: "tel:0925250111",
    availability: "24/7 direct conversation with a crisis worker",
    description:
      "Speak directly with a trained person right now. No menus or automated chat.",
    kind: "helpline",
  },
  {
    id: "tms_clinic_nurse",
    label: "TMS Clinic Nurse Line",
    phone: "09 471 71200",
    href: "tel:0947171200",
    availability: "Same-day clinical team contact",
    description:
      "Reach the TMS care team directly to talk with a nurse about how you are doing.",
    kind: "clinic",
  },
];

export interface CheckInItemDescriptor {
  key: "moodScore" | "interestScore";
  label: string;
  prompt: string;
  lowAnchor: string;
  highAnchor: string;
}

export const CHECK_IN_ITEMS: CheckInItemDescriptor[] = [
  {
    key: "moodScore",
    label: "Mood",
    prompt: "How is your mood right now?",
    lowAnchor: "Very low",
    highAnchor: "Very good",
  },
  {
    key: "interestScore",
    label: "Interest",
    prompt: "How much do you feel like doing things right now?",
    lowAnchor: "Not at all",
    highAnchor: "Very much",
  },
];

export interface Phq9ItemDescriptor {
  key:
    | "item1Interest"
    | "item2Mood"
    | "item3Sleep"
    | "item4Energy"
    | "item5Appetite"
    | "item6SelfWorth"
    | "item7Concentration"
    | "item8Psychomotor"
    | "item9SelfHarm";
  number: number;
  prompt: string;
  isSelfHarmItem: boolean;
}

export const PHQ9_ITEMS: Phq9ItemDescriptor[] = [
  {
    key: "item1Interest",
    number: 1,
    prompt: "Little interest or pleasure in doing things",
    isSelfHarmItem: false,
  },
  {
    key: "item2Mood",
    number: 2,
    prompt: "Feeling down, depressed, or hopeless",
    isSelfHarmItem: false,
  },
  {
    key: "item3Sleep",
    number: 3,
    prompt: "Trouble falling or staying asleep, or sleeping too much",
    isSelfHarmItem: false,
  },
  {
    key: "item4Energy",
    number: 4,
    prompt: "Feeling tired or having little energy",
    isSelfHarmItem: false,
  },
  {
    key: "item5Appetite",
    number: 5,
    prompt: "Poor appetite or overeating",
    isSelfHarmItem: false,
  },
  {
    key: "item6SelfWorth",
    number: 6,
    prompt:
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    isSelfHarmItem: false,
  },
  {
    key: "item7Concentration",
    number: 7,
    prompt:
      "Trouble concentrating on things, such as reading the newspaper or watching television",
    isSelfHarmItem: false,
  },
  {
    key: "item8Psychomotor",
    number: 8,
    prompt:
      "Moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
    isSelfHarmItem: false,
  },
  {
    key: "item9SelfHarm",
    number: 9,
    prompt:
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    isSelfHarmItem: true,
  },
];
