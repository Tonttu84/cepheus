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
