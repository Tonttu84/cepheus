import { DEFAULT_ROUNDS_CONFIG } from "./config";
import { addDays, findUtcInstantForLocalWallClock } from "./time";
import type { Round, RoundsConfig, Schedule } from "./types";

export interface ReminderCheckOptions {
  readonly moment: string | Date;
  readonly timeZone?: string;
  readonly schedule?: Schedule;
  readonly hasSubmission?: boolean;
  readonly reminderSent?: boolean;
}

export type ReminderCheckResult =
  | { readonly due: true }
  | { readonly due: false; readonly reason: string };

/**
 * Calculates the UTC instant when a round's reminder becomes due.
 * Ruling (d): from 09:00 local time on the day after the round opened.
 * The hour and minute are config values.
 */
export function getReminderDueInstant(
  round: Round,
  timeZone: string,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): string {
  const hour = config.reminderHour ?? DEFAULT_ROUNDS_CONFIG.reminderHour;
  const minute = config.reminderMinute ?? DEFAULT_ROUNDS_CONFIG.reminderMinute;
  const dayAfterOpened = addDays(round.localDate, 1);
  const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return findUtcInstantForLocalWallClock(dayAfterOpened, timeString, timeZone);
}

/**
 * Evaluates whether a reminder is due, returning an explicit named reason when not due.
 * Requirement 4, Ruling (d), and Ruling (i):
 * - Ruling (i): when the next round opens before or at the reminder time, no reminder is sent for that round,
 *   because the next round's own prompt reaches the person sooner ("not due: the next round opens first").
 * - Otherwise due from 09:00 local time on the day after the round opened, if the round has no submission
 *   yet and has not ended. Once sent it is never due again for that round.
 */
export function checkReminder(
  round: Round,
  options: ReminderCheckOptions,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): ReminderCheckResult {
  const timeZone = options.timeZone ?? options.schedule?.timeZone;
  if (!timeZone) {
    return { due: false, reason: "missing time zone" };
  }

  const reminderDueMs = new Date(
    getReminderDueInstant(round, timeZone, config)
  ).getTime();
  const roundEndsAtMs = new Date(round.endsAt).getTime();

  // Ruling (i): when the next round opens before or at the reminder time,
  // no reminder is sent for that round, because the next round's own prompt reaches the person sooner.
  if (roundEndsAtMs <= reminderDueMs) {
    return { due: false, reason: "not due: the next round opens first" };
  }

  if (options.reminderSent) {
    return { due: false, reason: "reminder already sent" };
  }
  if (options.hasSubmission) {
    return { due: false, reason: "round already has submission" };
  }

  const currentMs =
    typeof options.moment === "string"
      ? new Date(options.moment).getTime()
      : options.moment.getTime();

  const roundOpensAtMs = new Date(round.opensAt).getTime();
  if (currentMs < roundOpensAtMs) {
    return { due: false, reason: "round has not opened yet" };
  }

  if (currentMs >= roundEndsAtMs) {
    return { due: false, reason: "round has ended" };
  }

  if (currentMs < reminderDueMs) {
    return { due: false, reason: "reminder time has not arrived yet" };
  }

  return { due: true };
}

/**
 * Requirement 4 & Ruling (d), Ruling (i):
 * The reminder is due once: from 09:00 local time on the day after the round opened,
 * if the round has no submission yet and has not ended. Once sent it is never due
 * again for that round.
 */
export function isReminderDue(
  round: Round,
  options: ReminderCheckOptions,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): boolean {
  return checkReminder(round, options, config).due;
}
