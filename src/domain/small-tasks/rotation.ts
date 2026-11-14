import { parseLocalWallClockInTimeZone } from "../rounds/time";
import type { Schedule } from "../rounds/types";
import { getTaskByKey, resolvePreferredTasks } from "./catalogue";
import type { SmallTask, TaskKey, TaskRecord } from "./types";

/**
 * Rule 8: A task is offered only on a day that is not one of the person's check-in days.
 */
export function isCheckInDay(
  utcInstant: string | Date,
  schedule: Schedule
): { isCheckIn: boolean; localDate: string } {
  const { localDate, weekday } = parseLocalWallClockInTimeZone(
    utcInstant,
    schedule.timeZone
  );
  const isCheckIn = schedule.weekdays.includes(weekday);
  return { isCheckIn, localDate };
}

export interface DetermineOfferedTaskParams {
  readonly preferredKeys?: readonly string[] | null;
  readonly history: readonly TaskRecord[];
  readonly localDate: string;
}

/**
 * Rule 7: The task offered for a day is chosen only from the preferred ones,
 * by a fixed rotation over the person's own history (no randomness, so the same
 * inputs give the same offer), and the same task is offered all day once shown.
 */
export function determineOfferedTask(params: DetermineOfferedTaskParams): SmallTask {
  // If already shown/recorded today, return that exact task all day
  const todayRecord = params.history.find((r) => r.localDate === params.localDate);
  if (todayRecord) {
    return getTaskByKey(todayRecord.taskKey);
  }

  const preferredTasks = resolvePreferredTasks(params.preferredKeys);

  // Distinct prior dates before localDate in the person's history
  const priorDates = new Set(
    params.history
      .filter((r) => r.localDate < params.localDate)
      .map((r) => r.localDate)
  );

  const index = priorDates.size % preferredTasks.length;
  return preferredTasks[index];
}

export function createTaskRecord(params: {
  id: string;
  patientId: string;
  localDate: string;
  taskKey: TaskKey;
  status: "offered" | "completed" | "not_today";
  completedAt?: string | null;
  respondedAt?: string | null;
}): TaskRecord {
  return {
    id: params.id,
    patientId: params.patientId,
    localDate: params.localDate,
    taskKey: params.taskKey,
    status: params.status,
    source: "self_report",
    completedAt: params.completedAt,
    respondedAt: params.respondedAt,
    isSimulated: true,
  };
}
