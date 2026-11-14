/**
 * Pure domain types for patient round schedules, round windows, PHQ-9 cadence,
 * reminders, and round outcomes.
 */

/** ISO 8601 weekday number: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface Schedule {
  readonly weekdays: readonly [Weekday, Weekday];
  readonly timeOfDay: string; // "HH:MM"
  readonly timeZone: string; // IANA time zone identifier
  readonly enrolmentDate: string; // "YYYY-MM-DD"
}

export interface ScheduleInput {
  readonly weekdays?: readonly unknown[];
  readonly timeOfDay?: unknown;
  readonly timeZone?: unknown;
  readonly enrolmentDate?: unknown;
}

export interface Round {
  readonly number: number;
  readonly localDate: string; // "YYYY-MM-DD" in the patient's time zone
  readonly opensAt: string; // ISO 8601 UTC instant
  readonly endsAt: string; // ISO 8601 UTC instant when the round ends
}

export type RoundStatus = "answered" | "not_today" | "missed";

export type Phq9Progress = "not_started" | "unfinished" | "completed";

export interface TapAnswerData {
  readonly mood?: number;
  readonly interest?: number;
  readonly phq9Completed?: boolean;
}

export type Submission =
  | {
      readonly kind: "answer";
      readonly answers?: TapAnswerData;
      readonly mood?: number;
      readonly interest?: number;
      readonly phq9Completed?: boolean;
    }
  | {
      readonly kind: "not_today";
    };

export type Phq9Submission =
  | {
      readonly kind?: "phq9";
      readonly progress: "unfinished" | "completed";
    }
  | "unfinished"
  | "completed";

export interface Phq9ApplicationResult {
  readonly progress: Phq9Progress;
  readonly isDuplicate: boolean;
}

export interface Phq9SubmissionContext {
  readonly isDue: boolean;
  readonly isRoundOpen?: boolean;
  readonly round?: Round;
  readonly moment?: string | Date;
  readonly roundStatus?: RoundStatus | null;
  readonly currentSubmission?: Submission | null;
  readonly currentProgress?: Phq9Progress;
}

export interface RoundOutcome {
  readonly roundNumber: number;
  readonly status: RoundStatus;
  readonly phq9Progress?: Phq9Progress;
  readonly phq9Completed?: boolean;
}

export interface RoundsConfig {
  readonly reminderHour: number;
  readonly reminderMinute: number;
  readonly phq9IntervalRounds: number;
  readonly initialPhq9RoundNumber: number;
  readonly defaultRoundCount: number;
  readonly maxSearchRounds: number;
}
