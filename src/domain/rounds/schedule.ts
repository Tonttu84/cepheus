import type { Result, Schedule, Weekday } from "./types";

function isValidCalendarDate(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  const [year, month, day] = dateString.split("-").map((v) => Number.parseInt(v, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTimeOfDay(timeString: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeString);
}

function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") {
    return false;
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

function validateWeekdays(weekdays: unknown): Result<readonly [Weekday, Weekday]> {
  if (!Array.isArray(weekdays) || weekdays.length !== 2) {
    return { ok: false, error: "Schedule requires exactly two weekdays" };
  }
  const [first, second] = weekdays;
  const isFirstValid = Number.isInteger(first) && first >= 1 && first <= 7;
  const isSecondValid = Number.isInteger(second) && second >= 1 && second <= 7;
  if (!isFirstValid || !isSecondValid) {
    return { ok: false, error: "Weekday out of range: must be integers 1 to 7" };
  }
  if (first === second) {
    return { ok: false, error: "Invalid schedule: the same weekday twice" };
  }
  return { ok: true, value: [first as Weekday, second as Weekday] };
}

/**
 * Validates a patient's schedule according to ruling (g).
 * Refuses invalid schedules with plain error results.
 */
export function validateSchedule(input: unknown): Result<Schedule> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Schedule must be an object" };
  }
  const candidate = input as Record<string, unknown>;

  const weekdaysResult = validateWeekdays(candidate.weekdays);
  if (!weekdaysResult.ok) {
    return weekdaysResult;
  }

  if (typeof candidate.timeOfDay !== "string" || !isValidTimeOfDay(candidate.timeOfDay)) {
    return { ok: false, error: "Malformed time: expected HH:MM in 24-hour format" };
  }

  if (typeof candidate.timeZone !== "string" || !isValidTimeZone(candidate.timeZone)) {
    return { ok: false, error: "Unknown time zone: must be a valid IANA identifier" };
  }

  if (
    typeof candidate.enrolmentDate !== "string" ||
    !isValidCalendarDate(candidate.enrolmentDate)
  ) {
    return { ok: false, error: "Malformed date: expected valid YYYY-MM-DD" };
  }

  return {
    ok: true,
    value: {
      weekdays: weekdaysResult.value,
      timeOfDay: candidate.timeOfDay,
      timeZone: candidate.timeZone,
      enrolmentDate: candidate.enrolmentDate,
    },
  };
}
