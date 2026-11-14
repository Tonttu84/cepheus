import type { RoundsConfig } from "./types";

/**
 * Default configuration for round scheduling, reminders, and PHQ-9 cadence.
 * Every value that could later change is defined here and passed with a default.
 */
export const DEFAULT_ROUNDS_CONFIG: RoundsConfig = Object.freeze({
  reminderHour: 9,
  reminderMinute: 0,
  phq9IntervalRounds: 4,
  initialPhq9RoundNumber: 1,
  defaultRoundCount: 10,
  maxSearchRounds: 1000,
});
