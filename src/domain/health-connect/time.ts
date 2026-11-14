import type { HealthConnectRecordMetadata } from "./types";

export const MINUTES_PER_DAY = 1440;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

export interface WallContext {
  readonly epochMs: number;
  readonly localDate: string;
  readonly localHour: number;
  readonly offsetMin: number;
}

export interface OffsetHint {
  readonly startZoneOffset?: string;
  readonly metadata?: HealthConnectRecordMetadata;
  readonly timezone?: string;
}

function parseOffsetString(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /([+-])(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function resolveIanaOffsetMin(epochMs: number, timeZone: string): number {
  const tz = timeZone.trim();
  if (!tz || tz === "UTC" || tz === "Etc/UTC") return 0;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = fmt.formatToParts(new Date(epochMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const wallUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    const baseUtc = Math.floor(epochMs / 1000) * 1000;
    return Math.round((wallUtc - baseUtc) / MS_PER_MINUTE);
  } catch {
    return 0;
  }
}

export function resolveOffsetMin(
  iso: string,
  epochMs: number,
  hint?: OffsetHint
): number {
  const explicit = parseOffsetString(iso) ?? parseOffsetString(hint?.startZoneOffset);
  if (explicit !== null) return explicit;

  const metaSec =
    hint?.metadata?.start_zone_offset_seconds ?? hint?.metadata?.zone_offset_seconds;
  if (typeof metaSec === "number" && Number.isFinite(metaSec)) {
    return Math.round(metaSec / 60);
  }

  if (hint?.timezone) {
    return resolveIanaOffsetMin(epochMs, hint.timezone);
  }
  return 0;
}

export function toWallContext(epochMs: number, offsetMin: number): WallContext {
  const shifted = new Date(epochMs + offsetMin * MS_PER_MINUTE);
  return {
    epochMs,
    localDate: shifted.toISOString().slice(0, 10),
    localHour: shifted.getUTCHours(),
    offsetMin,
  };
}

export function parseIsoWithWallContext(
  iso: string,
  hint?: OffsetHint
): WallContext | null {
  const trimmed = iso.trim();
  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) return null;
  const offsetMin = resolveOffsetMin(trimmed, parsedMs, hint);
  return toWallContext(parsedMs, offsetMin);
}

export function getDateMidnightEpochMs(
  dateStr: string,
  offsetMin: number
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  return utcMidnight - offsetMin * MS_PER_MINUTE;
}
