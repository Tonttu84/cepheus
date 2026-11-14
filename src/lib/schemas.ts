import { z } from "zod";
import { BROAD_AREA_KEYS, type BroadAreaKey } from "./constants";

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const checkInTwoTapItemScoreSchema = z.number().int().min(0).max(4);
const phq9ItemScoreSchema = z.number().int().min(0).max(3);

export const BroadAreaKeySchema = z.enum(BROAD_AREA_KEYS);

/**
 * Twice-weekly short wellbeing check-in submission schema (Step 2).
 *
 * Rules enforced:
 * - Missed ("missed") or skipped ("not_today") rounds are recorded as missed events,
 *   NEVER scored as 0. Both tap scores must be null or undefined when not completed.
 * - Completed rounds require the 2-tap integers (moodScore, interestScore in 0..4).
 * - No free text or self-harm fields on the check-in (self-harm belongs to PHQ-9 alone).
 */
export const CheckInSubmissionSchema = z
  .object({
    participantId: z.string().min(1),
    date: isoDateString,
    dayIndex: z.number().int().nonnegative().optional(),
    weekNumber: z.number().int().positive().optional(),
    roundNumber: z.number().int().positive().optional(),
    status: z.enum(["completed", "not_today", "missed"]),
    moodScore: checkInTwoTapItemScoreSchema.nullable().optional(),
    interestScore: checkInTwoTapItemScoreSchema.nullable().optional(),
    itemOrderJson: z.string().nullable().optional(),
    responseLatencyMs: z.number().int().nonnegative().nullable().optional(),
    ringActiveAtRound: z.boolean().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("live"),
  })
  .strict()
  .superRefine((val, ctx) => {
    const scoreFields = ["moodScore", "interestScore"] as const;

    if (val.status === "missed" || val.status === "not_today") {
      for (const field of scoreFields) {
        if (val[field] !== null && val[field] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `When status is "${val.status}", ${field} must be null or undefined (missed answers are never scored).`,
          });
        }
      }
      return;
    }

    // status === "completed"
    for (const field of scoreFields) {
      if (typeof val[field] !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Completed check-in requires ${field} as an integer 0..4.`,
        });
      }
    }
  });

export type CheckInSubmissionInput = z.infer<typeof CheckInSubmissionSchema>;

/**
 * Fortnightly PHQ-9 assessment schema.
 *
 * Rules enforced:
 * - When status === "missed", all 9 item scores and totalScore must be null or undefined.
 * - When status === "in_progress", partial items are allowed (not scored until complete),
 *   totalScore must be null or undefined, and item9SelfHarm > 0 still triggers the immediate crisis path.
 * - When status === "completed", all 9 items must be integers 0..3.
 * - Any item9SelfHarm > 0 requires the immediate crisis path.
 */
export const Phq9SubmissionSchema = z
  .object({
    participantId: z.string().min(1),
    date: isoDateString,
    dayIndex: z.number().int().nonnegative().optional(),
    weekNumber: z.number().int().positive().optional(),
    roundNumber: z.number().int().positive().nullable().optional(),
    status: z.enum(["completed", "in_progress", "missed"]),
    totalScore: z.number().int().min(0).max(27).nullable().optional(),
    item1Interest: phq9ItemScoreSchema.nullable().optional(),
    item2Mood: phq9ItemScoreSchema.nullable().optional(),
    item3Sleep: phq9ItemScoreSchema.nullable().optional(),
    item4Energy: phq9ItemScoreSchema.nullable().optional(),
    item5Appetite: phq9ItemScoreSchema.nullable().optional(),
    item6SelfWorth: phq9ItemScoreSchema.nullable().optional(),
    item7Concentration: phq9ItemScoreSchema.nullable().optional(),
    item8Psychomotor: phq9ItemScoreSchema.nullable().optional(),
    item9SelfHarm: phq9ItemScoreSchema.nullable().optional(),
    baselineDelta: z.number().int().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("live"),
  })
  .strict()
  .superRefine((val, ctx) => {
    const itemFields = [
      "item1Interest",
      "item2Mood",
      "item3Sleep",
      "item4Energy",
      "item5Appetite",
      "item6SelfWorth",
      "item7Concentration",
      "item8Psychomotor",
      "item9SelfHarm",
    ] as const;

    if (val.status === "missed") {
      for (const field of itemFields) {
        if (val[field] !== null && val[field] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `When PHQ-9 status is "missed", ${field} must be null or undefined.`,
          });
        }
      }
      if (val.totalScore !== null && val.totalScore !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalScore"],
          message:
            'When PHQ-9 status is "missed", totalScore must be null or undefined.',
        });
      }
      return;
    }

    if (val.status === "in_progress") {
      if (val.totalScore !== null && val.totalScore !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalScore"],
          message:
            'When PHQ-9 status is "in_progress", totalScore must be null or undefined (unfinished PHQ-9 is not scored).',
        });
      }
      return;
    }

    // status === "completed"
    for (const field of itemFields) {
      if (typeof val[field] !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Completed PHQ-9 requires ${field} (0..3).`,
        });
      }
    }
  });

export type Phq9SubmissionInput = z.infer<typeof Phq9SubmissionSchema>;

export function evaluatePhq9Submission(input: Phq9SubmissionInput): {
  totalScore: number | null;
  crisisPathRequired: boolean;
} {
  const parsed = Phq9SubmissionSchema.parse(input);
  if (parsed.status === "missed") {
    return {
      totalScore: null,
      crisisPathRequired: false,
    };
  }

  const crisisPathRequired = (parsed.item9SelfHarm ?? 0) > 0;
  if (parsed.status === "in_progress") {
    return {
      totalScore: null,
      crisisPathRequired,
    };
  }

  const items = [
    parsed.item1Interest ?? 0,
    parsed.item2Mood ?? 0,
    parsed.item3Sleep ?? 0,
    parsed.item4Energy ?? 0,
    parsed.item5Appetite ?? 0,
    parsed.item6SelfWorth ?? 0,
    parsed.item7Concentration ?? 0,
    parsed.item8Psychomotor ?? 0,
    parsed.item9SelfHarm ?? 0,
  ];
  const totalScore = items.reduce((acc, v) => acc + v, 0);

  return {
    totalScore,
    crisisPathRequired,
  };
}

/**
 * Daily smart-ring summary schema including optional 24-hour activity array and 1440-char sleep/wake grid.
 */
export const RingDayInputSchema = z.object({
  participantId: z.string().min(1),
  date: isoDateString,
  dayIndex: z.number().int().nonnegative(),
  ringActive: z.boolean().default(true),
  wearMinutes: z.number().int().min(0).max(1440).default(1400),
  steps: z.number().int().nonnegative().nullable().optional(),
  activeCaloriesKcal: z.number().nonnegative().nullable().optional(),
  daytimeMeanActivity: z.number().nonnegative().nullable().optional(),
  nighttimeMeanActivity: z.number().nonnegative().nullable().optional(),
  m10: z.number().nonnegative().nullable().optional(),
  l5: z.number().nonnegative().nullable().optional(),
  relativeAmplitude: z.number().min(0).max(1).nullable().optional(),
  hourlyActivity: z.array(z.number().nonnegative()).length(24).optional(),
  sleepMidpointMin: z.number().nullable().optional(),
  timeInBedMin: z.number().nonnegative().nullable().optional(),
  totalSleepMin: z.number().nonnegative().nullable().optional(),
  onsetLatencyMin: z.number().nonnegative().nullable().optional(),
  wasoMinutes: z.number().nonnegative().nullable().optional(),
  nightActivityBouts: z.number().int().nonnegative().nullable().optional(),
  lowestHrBpm: z.number().positive().nullable().optional(),
  avgHrBpm: z.number().positive().nullable().optional(),
  avgHrvRmssdMs: z.number().positive().nullable().optional(),
  tempDeviationC: z.number().nullable().optional(),
  sleepWakeGrid: z
    .string()
    .length(1440)
    .regex(/^[01]+$/, "sleepWakeGrid must be 1440 characters of '0' or '1'")
    .nullable()
    .optional(),
  sleepPhase5MinRaw: z.string().nullable().optional(),
  isSimulated: z.boolean().default(false),
  source: z.string().default("synthetic"),
});

export type RingDayInput = z.infer<typeof RingDayInputSchema>;

/**
 * On-device MediaPipe camera reading schema.
 * Uses .strict() so any unexpected raw frame, video, image, or audio payload is rejected.
 */
export const CameraReadingInputSchema = z
  .object({
    participantId: z.string().min(1),
    date: isoDateString,
    dayIndex: z.number().int().nonnegative().nullable().optional(),
    taskId: z.string().default("check_in_clip_60s"),
    durationSec: z.number().positive().max(600),
    sampleRateHz: z.number().positive().max(120).default(10.0),
    effectiveFps: z.number().nonnegative().max(120),
    faceDetectedRatio: z.number().min(0).max(1),
    expressivityScore: z.number().min(0).max(1),
    smileFraction: z.number().min(0).max(1),
    mouthSmileMean: z.number().min(0).max(1).nullable().optional(),
    mouthSmileSd: z.number().min(0).max(1).nullable().optional(),
    browInnerUpSd: z.number().min(0).max(1).nullable().optional(),
    browDownSd: z.number().min(0).max(1).nullable().optional(),
    browOuterUpSd: z.number().min(0).max(1).nullable().optional(),
    eyeSquintSd: z.number().min(0).max(1).nullable().optional(),
    cheekSquintSd: z.number().min(0).max(1).nullable().optional(),
    jawOpenSd: z.number().min(0).max(1).nullable().optional(),
    blendshapeStatsJson: z.string().nullable().optional(),
    yawSdDeg: z.number().nonnegative(),
    pitchSdDeg: z.number().nonnegative(),
    rollSdDeg: z.number().nonnegative().nullable().optional(),
    angularPathDegPerMin: z.number().nonnegative(),
    translationSd: z.number().nonnegative().nullable().optional(),
    expressivityZScore: z.number().nullable().optional(),
    headMovementZScore: z.number().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("live"),
  })
  .strict();

export type CameraReadingInput = z.infer<typeof CameraReadingInputSchema>;

/**
 * On-device read-aloud speech timing schema.
 * Uses .strict() so raw audio blobs, waveforms, or transcripts are rejected.
 */
export const SpeechReadingInputSchema = z
  .object({
    participantId: z.string().min(1),
    date: isoDateString,
    dayIndex: z.number().int().nonnegative().nullable().optional(),
    passageId: z.string().default("standard_passage_1"),
    syllableCount: z.number().int().positive(),
    readingTimeSec: z.number().positive(),
    speakingTimeSec: z.number().nonnegative(),
    pauseTimeSec: z.number().nonnegative(),
    speechRateSylPerSec: z.number().nonnegative(),
    articulationRateSylPerSec: z.number().nonnegative(),
    pauseCountOver250ms: z.number().int().nonnegative(),
    meanPauseLengthMs: z.number().nonnegative(),
    pauseRatio: z.number().min(0).max(1),
    noiseFloorDb: z.number().nullable().optional(),
    speechRateZScore: z.number().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("live"),
  })
  .strict();

export type SpeechReadingInput = z.infer<typeof SpeechReadingInputSchema>;

/**
 * Optional weekly ambiguous-faces / scenario interpretation game summary schema.
 */
export const CognitiveGameInputSchema = z
  .object({
    participantId: z.string().min(1),
    date: isoDateString,
    dayIndex: z.number().int().nonnegative().nullable().optional(),
    taskType: z.string().default("ambiguous_faces"),
    trialCount: z.number().int().positive(),
    validTrialCount: z.number().int().nonnegative(),
    negativeRatingCount: z.number().int().nonnegative(),
    positiveRatingCount: z.number().int().nonnegative(),
    interpretationBiasScore: z.number().min(-1).max(1),
    meanReactionTimeMs: z.number().nonnegative().nullable().optional(),
    biasZScore: z.number().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("live"),
  })
  .strict();

export type CognitiveGameInput = z.infer<typeof CognitiveGameInputSchema>;

/**
 * Optional derived routine or financial period aggregate schema.
 * Uses .strict() so raw merchant names, transaction descriptions, or continuous traces are rejected.
 */
export const RoutineSignalInputSchema = z
  .object({
    participantId: z.string().min(1),
    periodStartDate: isoDateString,
    periodEndDate: isoDateString,
    dayIndex: z.number().int().nonnegative().nullable().optional(),
    channel: z.enum([
      "laundry",
      "shower_humidity",
      "kitchen_motion",
      "financial_routine",
    ]),
    broadArea: z.enum(["daily_routine", "financial_routine"]),
    derivedValue: z.number().nonnegative(),
    unit: z.string().min(1),
    baselineZScore: z.number().nullable().optional(),
    isSimulated: z.boolean().default(false),
    source: z.string().default("synthetic"),
  })
  .strict();

export type RoutineSignalInput = z.infer<typeof RoutineSignalInputSchema>;

/**
 * Per-method participant consent toggle schema.
 */
export const ConsentToggleSchema = z
  .object({
    participantId: z.string().min(1),
    method: z.enum([
      "check_in",
      "phq9",
      "ring_rhythm",
      "camera_expressivity",
      "speech_rate",
      "ambiguous_faces",
      "home_routine",
      "financial_routine",
    ]),
    enabled: z.boolean(),
    isPersonalSign: z.boolean().optional(),
  })
  .strict();

export type ConsentToggleInput = z.infer<typeof ConsentToggleSchema>;

/**
 * Nurse call outreach and post-warning verification outcome schema.
 */
export const NurseCallOutcomeSchema = z
  .object({
    participantId: z.string().min(1),
    flagId: z.string().min(1).nullable().optional(),
    staffUserId: z.string().min(1).nullable().optional(),
    status: z.enum(["requested", "completed", "unreachable"]).default("completed"),
    outcomeTier: z
      .enum([
        "rough_patch",
        "sustained_decline",
        "full_relapse",
        "crisis",
        "false_alarm",
      ])
      .nullable()
      .optional(),
    actionTaken: z
      .enum([
        "advice_and_medication_check",
        "booster_tms_cluster",
        "new_tms_course_referral",
        "urgent_care",
        "none",
      ])
      .nullable()
      .optional(),
    medicationChecked: z.boolean().default(false),
    watchNextRounds: z.number().int().min(0).max(12).default(0),
    boosterSessionsPlanned: z.number().int().min(0).max(20).nullable().optional(),
    isSimulated: z.boolean().default(false),
  })
  .strict();

export type NurseCallOutcomeInput = z.infer<typeof NurseCallOutcomeSchema>;

/**
 * Safe clinic-side flag view schema enforcing Decision D8 and behaviour-flags rules:
 * - Only broad areas and sinceDate are exposed by default.
 * - Optional sharedMeasureSummary is populated ONLY when patientSharedDetails === true
 *   AND primaryArea !== "financial_routine" (and broadAreas does not expose financial details).
 */
export const ClinicFlagViewSchema = z
  .object({
    id: z.string().min(1),
    participantId: z.string().min(1),
    sinceDate: isoDateString,
    triggerKind: z.enum(["low_answers", "silence", "mixed", "phq9", "sustained_dip"]),
    primaryArea: BroadAreaKeySchema,
    broadAreas: z.array(BroadAreaKeySchema).min(1),
    status: z.enum([
      "open",
      "nurse_call_requested",
      "booster_offered",
      "watching",
      "resolved",
    ]),
    ringActiveDuringSilence: z.boolean().nullable(),
    isSimulated: z.boolean(),
    sharedMeasureSummary: z.string().nullable(),
  })
  .strict();

export type ClinicFlagView = z.infer<typeof ClinicFlagViewSchema>;

export interface RawClinicFlagLike {
  id: string;
  participantId: string;
  sinceDate: string;
  triggerKind: string;
  primaryArea: string;
  broadAreasJson?: string;
  broadAreas?: BroadAreaKey[];
  status: string;
  ringActiveDuringSilence: boolean | null;
  patientSharedDetails: boolean;
  isSimulated: boolean;
}

export function toSafeClinicFlagView(
  flag: RawClinicFlagLike,
  detailSummary?: string | null
): ClinicFlagView {
  let parsedAreas: BroadAreaKey[] = [];
  if (Array.isArray(flag.broadAreas) && flag.broadAreas.length > 0) {
    parsedAreas = flag.broadAreas;
  } else if (typeof flag.broadAreasJson === "string") {
    try {
      const raw = JSON.parse(flag.broadAreasJson);
      if (Array.isArray(raw)) {
        parsedAreas = raw.filter((item): item is BroadAreaKey =>
          (BROAD_AREA_KEYS as readonly string[]).includes(String(item))
        );
      }
    } catch {
      parsedAreas = [];
    }
  }

  const primaryArea = BroadAreaKeySchema.parse(flag.primaryArea);
  if (parsedAreas.length === 0) {
    parsedAreas = [primaryArea];
  }

  const involvesFinancialRoutine =
    primaryArea === "financial_routine" ||
    parsedAreas.includes("financial_routine");

  const canExposeDetailSummary =
    flag.patientSharedDetails === true &&
    !involvesFinancialRoutine &&
    typeof detailSummary === "string" &&
    detailSummary.trim().length > 0;

  return ClinicFlagViewSchema.parse({
    id: flag.id,
    participantId: flag.participantId,
    sinceDate: flag.sinceDate,
    triggerKind: flag.triggerKind,
    primaryArea,
    broadAreas: parsedAreas,
    status: flag.status,
    ringActiveDuringSilence: flag.ringActiveDuringSilence ?? null,
    isSimulated: flag.isSimulated,
    sharedMeasureSummary: canExposeDetailSummary ? detailSummary!.trim() : null,
  });
}
