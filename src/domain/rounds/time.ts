import type { Weekday } from "./types";

export function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(dateString: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateString.split("-").map((v) => Number.parseInt(v, 10));
  return { year, month, day };
}

export function addDays(localDate: string, days: number): string {
  const { year, month, day } = parseIsoDate(localDate);
  const target = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}

/**
 * Returns ISO 8601 weekday: 1 = Monday ... 7 = Sunday.
 */
export function getIsoWeekday(localDate: string): Weekday {
  const { year, month, day } = parseIsoDate(localDate);
  const target = new Date(Date.UTC(year, month - 1, day));
  const jsDay = target.getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

interface WallClockParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function getWallClockParts(utcMs: number, timeZone: string): WallClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const record: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      record[part.type] = Number.parseInt(part.value, 10);
    }
  }
  return {
    year: record.year ?? 0,
    month: record.month ?? 1,
    day: record.day ?? 1,
    hour: record.hour ?? 0,
    minute: record.minute ?? 0,
    second: record.second ?? 0,
  };
}

function getLocalWallMs(utcMs: number, timeZone: string): number {
  const p = getWallClockParts(utcMs, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Extracts the local calendar date and time for a UTC instant in an IANA time zone.
 */
export function parseLocalWallClockInTimeZone(
  utcInstant: string | Date,
  timeZone: string
): { localDate: string; timeOfDay: string; weekday: Weekday } {
  const utcMs = typeof utcInstant === "string" ? new Date(utcInstant).getTime() : utcInstant.getTime();
  const parts = getWallClockParts(utcMs, timeZone);
  const localDate = formatIsoDate(parts.year, parts.month, parts.day);
  const timeOfDay = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return {
    localDate,
    timeOfDay,
    weekday: getIsoWeekday(localDate),
  };
}

function binarySearchFirstMomentAfter(
  tGuess: number,
  targetWallMs: number,
  timeZone: string
): number {
  let low = Math.floor((tGuess - 3 * 3600 * 1000) / 1000);
  let high = Math.ceil((tGuess + 3 * 3600 * 1000) / 1000);
  let answerSecond = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const wallMs = getLocalWallMs(mid * 1000, timeZone);
    if (wallMs >= targetWallMs) {
      answerSecond = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return answerSecond * 1000;
}

/**
 * Converts a local wall-clock date and time in an IANA time zone into a UTC instant.
 * Ruling (h):
 * - On spring forward, if the local time does not exist, opens at the first moment that does exist after it.
 * - On fall back, if the local time occurs twice, opens at its first occurrence.
 */
export function findUtcInstantForLocalWallClock(
  localDate: string,
  timeOfDay: string,
  timeZone: string
): string {
  const { year, month, day } = parseIsoDate(localDate);
  const [hour, minute] = timeOfDay.split(":").map((v) => Number.parseInt(v, 10));
  const targetWallMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const initialOffset = getLocalWallMs(targetWallMs, timeZone) - targetWallMs;
  const tGuess = targetWallMs - initialOffset;

  // For fall back, check earlier occurrence candidates first (1h and 30m shifts)
  for (const shift of [3600000, 1800000]) {
    const tEarlier = tGuess - shift;
    if (getLocalWallMs(tEarlier, timeZone) === targetWallMs) {
      return new Date(tEarlier).toISOString();
    }
  }

  if (getLocalWallMs(tGuess, timeZone) === targetWallMs) {
    return new Date(tGuess).toISOString();
  }

  // If target did not exist (e.g. spring forward gap), find the first moment after it
  const resolvedMs = binarySearchFirstMomentAfter(tGuess, targetWallMs, timeZone);
  return new Date(resolvedMs).toISOString();
}
