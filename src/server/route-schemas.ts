import { z } from "zod";

/** Pseudonymous patient ids (database ids); never a name. */
export const PatientIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .meta({ description: "Pseudonymous patient id" });

export const CheckInTapsRequestSchema = z
  .object({
    mood: z.number().int().min(0).max(4).meta({ description: "Mood, 0 (very low) to 4 (very good)" }),
    interest: z
      .number()
      .int()
      .min(0)
      .max(4)
      .meta({ description: "Feeling like doing things, 0 (not at all) to 4 (very much)" }),
  })
  .strict()
  .meta({ description: "The two taps of a round" });

export const CheckInNotTodayRequestSchema = z
  .object({})
  .strict()
  .meta({ description: '"Not today": an empty object, or no body' });

const QUESTIONNAIRE_VALUE = z
  .number()
  .int()
  .min(0)
  .max(3)
  .meta({ description: "0 (not at all) to 3 (nearly every day)" });

export const CheckInPhq9RequestSchema = z
  .object({
    itemId: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]).meta({ description: "PHQ-9 item, 1 to 9" }),
    value: QUESTIONNAIRE_VALUE,
  })
  .strict()
  .meta({ description: "One PHQ-9 item answer" });

export const CheckInGad7RequestSchema = z
  .object({
    itemId: z.enum(["1", "2", "3", "4", "5", "6", "7"]).meta({ description: "GAD-7 item, 1 to 7" }),
    value: QUESTIONNAIRE_VALUE,
  })
  .strict()
  .meta({ description: "One GAD-7 item answer" });

export const CheckInCrisisRequestSchema = z
  .object({
    screen: z.literal("check-in").meta({ description: "Screen the crisis help request came from" }),
  })
  .strict()
  .meta({ description: "A typed or spoken request for help on the check-in screen (carries no text)" });

export const CheckInExtraAnswerRequestSchema = z
  .object({
    itemId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/)
      .meta({ description: "The rotating extra question offered in this round (D25)" }),
    value: z.number().int().min(0).max(4).meta({ description: "0 to 4" }),
  })
  .strict()
  .meta({ description: "The answer to the round's experimental extra question" });

export const RoundsCloseRequestSchema = z
  .object({ patientId: PatientIdSchema })
  .strict()
  .meta({ description: "The patient whose elapsed rounds are closed" });

export const PatientEvaluateParamsSchema = z
  .object({ patientId: PatientIdSchema })
  .strict()
  .meta({ description: "The patient whose warning rule is run" });

export const AcknowledgeCrisisEventRequestSchema = z
  .object({
    patientId: PatientIdSchema,
    roundNumber: z.number().int().positive().meta({ description: "Round number of the crisis event" }),
  })
  .strict()
  .meta({ description: "Acknowledge a patient's unacknowledged crisis event" });

export const RecordNurseCallRequestSchema = z
  .object({
    patientId: PatientIdSchema,
    flagId: z.string().min(1).max(64).nullable().optional().meta({ description: "The clinic flag being addressed" }),
    status: z.enum(["requested", "completed", "unreachable"]).default("completed"),
    outcomeTier: z
      .enum(["rough_patch", "sustained_decline", "full_relapse", "crisis", "false_alarm"])
      .nullable()
      .optional()
      .meta({ description: "What the nurse found during outreach" }),
    actionTaken: z
      .enum([
        "advice_and_medication_check",
        "booster_tms_cluster",
        "new_tms_course_referral",
        "urgent_care",
        "none",
      ])
      .nullable()
      .optional()
      .meta({ description: "Clinical action step decided following the call" }),
    medicationChecked: z.boolean().default(false),
    watchNextRounds: z.number().int().min(0).max(12).default(0),
    boosterSessionsPlanned: z.number().int().min(0).max(20).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().meta({ description: "YYYY-MM-DD local date of the call" }),
    position: z.enum(["before", "after"]).optional().meta({ description: "Position relative to round of that date" }),
  })
  .strict()
  .meta({ description: "Record the outcome of a nurse call about a flag" });

