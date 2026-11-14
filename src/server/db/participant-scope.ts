import type { Prisma } from "@prisma/client";
import {
  findUtcInstantForLocalWallClock,
  parseIsoDate,
  validateSchedule,
  type Schedule,
} from "@/domain/rounds";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ScheduleColumns {
  readonly enrolmentDate: string | null;
  readonly scheduleDaysJson: string | null;
  readonly scheduleTime: string | null;
  readonly timeZone: string;
}

export interface ParticipantScope {
  readonly clinicId: string | null;
  readonly schedule: Schedule | null;
}

export interface RoundColumns {
  readonly scheduledAt: Date;
  readonly dayIndex: number;
  readonly weekNumber: number;
}

export function toSchedule(row: ScheduleColumns): Schedule | null {
  if (!row.enrolmentDate || !row.scheduleDaysJson || !row.scheduleTime) return null;

  const result = validateSchedule({
    weekdays: JSON.parse(row.scheduleDaysJson),
    timeOfDay: row.scheduleTime,
    timeZone: row.timeZone,
    enrolmentDate: row.enrolmentDate,
  });
  if (!result.ok) {
    throw new Error(`Stored schedule is not valid: ${result.error}`);
  }
  return result.value;
}

function utcDayNumber(localDate: string): number {
  const { year, month, day } = parseIsoDate(localDate);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function roundColumnsFor(schedule: Schedule, localDate: string): RoundColumns {
  const dayIndex = utcDayNumber(localDate) - utcDayNumber(schedule.enrolmentDate) + 1;
  return {
    scheduledAt: new Date(
      findUtcInstantForLocalWallClock(localDate, schedule.timeOfDay, schedule.timeZone)
    ),
    dayIndex,
    weekNumber: Math.ceil(dayIndex / 7),
  };
}

export async function loadParticipantScope(
  db: Prisma.TransactionClient,
  patientId: string
): Promise<ParticipantScope> {
  const row = await db.participant.findUnique({
    where: { id: patientId },
    select: {
      clinicId: true,
      enrolmentDate: true,
      scheduleDaysJson: true,
      scheduleTime: true,
      timeZone: true,
    },
  });
  if (!row) throw new Error("Patient not found");
  return { clinicId: row.clinicId, schedule: toSchedule(row) };
}
