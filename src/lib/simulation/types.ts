import type { PatientHistory } from "../../domain/history";

export type DemoMomentKey = "well" | "small_dip" | "sustained_drift";

export interface GenerateSimulationOptions {
  seed?: number;
  baseDate?: string;
  throughDay?: number;
  condition?: "depression_only" | "depression_and_anxiety";
  profile?: "depression_only" | "depression_and_anxiety";
}

export interface SimulatedParticipantRecord {
  externalId: string;
  participantCode: string;
  label: string;
  source: "synthetic";
  isSimulated: true;
  seed: number;
  enrolmentDate: string;
  scheduleDaysJson: string;
  scheduleTime: string;
  timeZone: string;
  takingPart: true;
  ruleCheckConsent: false;
  tmsCompletedDate: string;
  currentDemoDay: number;
  group: string;
  age: number | null;
  gender: string | null;
  madrsBaseline: number | null;
  madrsEnd: number | null;
  questionnaires?: readonly ("phq9" | "gad7")[];
  condition?: "depression_only" | "depression_and_anxiety";
}

export interface SimulatedConsentRecord {
  method: string;
  broadArea: string;
  recordedDescription: string;
  enabled: boolean;
  isPersonalSign: boolean;
  consentedAt: Date | null;
  revokedAt: Date | null;
}

export interface SimulatedRingDayRecord {
  date: string;
  dayIndex: number;
  ringActive: boolean;
  wearMinutes: number;
  steps: number;
  activeCaloriesKcal: number;
  daytimeMeanActivity: number;
  nighttimeMeanActivity: number;
  m10: number;
  l5: number;
  relativeAmplitude: number;
  hourlyActivityJson: string;
  bedtimeStart: Date;
  bedtimeEnd: Date;
  sleepMidpointMin: number;
  timeInBedMin: number;
  totalSleepMin: number;
  onsetLatencyMin: number;
  wasoMinutes: number;
  nightActivityBouts: number;
  lowestHrBpm: number;
  avgHrBpm: number;
  avgHrvRmssdMs: number;
  tempDeviationC: number;
  sleepWakeGrid: string;
  sleepPhase5MinRaw: string | null;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedCheckInRoundRecord {
  scheduledAt: Date;
  respondedAt: Date | null;
  reminderSentAt: Date | null;
  date: string;
  dayIndex: number;
  weekNumber: number;
  roundNumber: number;
  status: "completed" | "not_today" | "missed";
  moodScore: number | null;
  interestScore: number | null;
  itemOrderJson: string | null;
  responseLatencyMs: number | null;
  ringActiveAtRound: boolean;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedPhq9AssessmentRecord {
  scheduledAt: Date;
  completedAt: Date | null;
  date: string;
  dayIndex: number;
  weekNumber: number;
  roundNumber: number | null;
  completedInRoundNumber: number | null;
  status: "completed" | "missed";
  totalScore: number | null;
  item1Interest: number | null;
  item2Mood: number | null;
  item3Sleep: number | null;
  item4Energy: number | null;
  item5Appetite: number | null;
  item6SelfWorth: number | null;
  item7Concentration: number | null;
  item8Psychomotor: number | null;
  item9SelfHarm: number | null;
  baselineDelta: number | null;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedGad7AssessmentRecord {
  scheduledAt: Date;
  completedAt: Date | null;
  date: string;
  dayIndex: number;
  weekNumber: number;
  status: "completed" | "missed";
  totalScore: number | null;
  item1Nervous: number | null;
  item2ControlWorry: number | null;
  item3ExcessiveWorry: number | null;
  item4Relaxing: number | null;
  item5Restless: number | null;
  item6Irritable: number | null;
  item7Afraid: number | null;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedRhythmWindowRecord {
  windowEndDate: string;
  dayIndex: number;
  windowDays: number;
  validDays: number;
  m10: number;
  l5: number;
  relativeAmplitude: number;
  interdailyStability: number;
  intradailyVariability: number;
  sri: number;
  sleepMidpointSdMin: number;
  wasoMeanMin: number;
  stepsMean: number;
  raZScore: number;
  isZScore: number;
  sriZScore: number;
  isSimulated: true;
}

export interface SimulatedCameraReadingRecord {
  recordedAt: Date;
  date: string;
  dayIndex: number;
  taskId: string;
  durationSec: number;
  sampleRateHz: number;
  effectiveFps: number;
  faceDetectedRatio: number;
  expressivityScore: number;
  smileFraction: number;
  mouthSmileMean: number;
  mouthSmileSd: number;
  browInnerUpSd: number;
  browDownSd: number;
  browOuterUpSd: number;
  eyeSquintSd: number;
  cheekSquintSd: number;
  jawOpenSd: number;
  blendshapeStatsJson: string;
  yawSdDeg: number;
  pitchSdDeg: number;
  rollSdDeg: number;
  angularPathDegPerMin: number;
  translationSd: number;
  expressivityZScore: number;
  headMovementZScore: number;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedRoutineReadingRecord {
  periodStartDate: string;
  periodEndDate: string;
  dayIndex: number;
  channel: "laundry" | "shower_humidity" | "kitchen_motion" | "financial_routine";
  broadArea: "daily_routine" | "financial_routine";
  derivedValue: number;
  unit: string;
  baselineZScore: number;
  isSimulated: true;
  source: "synthetic";
}

export interface SimulatedPersonalBaselineRecord {
  metricName: string;
  windowStartDate: string;
  windowEndDate: string;
  sampleCount: number;
  mean: number;
  sd: number;
  median: number;
  iqr: number;
}

export interface SimulatedPatientSuggestionRecord {
  createdAt: Date;
  date: string;
  dayIndex: number;
  reason: "small_dip" | "practice";
  actionKey: "short_walk" | "breathing_space" | "bright_light" | "social_contact";
  actionTitle: string;
  actionDetail: string;
  effortTier: "low";
  status: "shown" | "accepted" | "completed" | "skipped";
  respondedAt: Date | null;
  armType: "intervention" | "control";
  nextCheckInDelta: number | null;
  isSimulated: true;
}

export interface SimulatedClinicFlagRecord {
  createdAt: Date;
  sinceDate: string;
  dayIndex: number;
  triggerKind: "low_answers" | "silence" | "mixed" | "phq9" | "sustained_dip";
  ruleVersion: number;
  primaryArea: "check_in" | "sleep" | "daily_routine" | "activity_outside_home" | "financial_routine";
  broadAreasJson: string;
  status: "open" | "nurse_call_requested" | "booster_offered" | "watching" | "resolved";
  ringActiveDuringSilence: boolean;
  patientSharedDetails: boolean;
  sharedAt: Date | null;
  isSimulated: true;
}

export interface SimulatedPersonDataset {
  participant: SimulatedParticipantRecord;
  consents: SimulatedConsentRecord[];
  ringDays: SimulatedRingDayRecord[];
  checkInRounds: SimulatedCheckInRoundRecord[];
  phq9Assessments: SimulatedPhq9AssessmentRecord[];
  gad7Assessments?: SimulatedGad7AssessmentRecord[];
  calls?: Array<{ date: string; position?: "before" | "after" }>;
  rhythmWindows: SimulatedRhythmWindowRecord[];
  cameraReadings: SimulatedCameraReadingRecord[];
  routineReadings: SimulatedRoutineReadingRecord[];
  personalBaselines: SimulatedPersonalBaselineRecord[];
  patientSuggestions: SimulatedPatientSuggestionRecord[];
  clinicFlags: SimulatedClinicFlagRecord[];
  history?: PatientHistory;
}
