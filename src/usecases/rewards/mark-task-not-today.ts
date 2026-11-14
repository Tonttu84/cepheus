import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import type { RewardsConfig } from "../../domain/rewards/types";
import { getTaskByKey } from "../../domain/small-tasks/catalogue";
import {
  createTaskRecord,
  determineOfferedTask,
  isCheckInDay,
} from "../../domain/small-tasks/rotation";
import type { MarkTaskNotTodayResult, RewardsPorts, UseCaseResult } from "./ports";

export interface MarkTaskNotTodayInput {
  readonly patientId: string;
}

export async function markTaskNotToday(
  actor: Actor,
  input: MarkTaskNotTodayInput,
  ports: RewardsPorts
): Promise<UseCaseResult<MarkTaskNotTodayResult>> {
  const config: RewardsConfig = {
    ...DEFAULT_REWARDS_CONFIG,
    ...ports.config,
  };
  validateRewardsConfig(config);

  if (!config.enabled) {
    return { ok: false, error: "not enabled" };
  }

  if (!input || !input.patientId || typeof input.patientId !== "string") {
    return { ok: false, error: "Invalid patientId" };
  }

  const access = decideRewardsAccess(actor, input.patientId);
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  return await ports.unitOfWork.execute<UseCaseResult<MarkTaskNotTodayResult>>(async () => {
    const patientInfo = await ports.patients.getPatientSchedule(input.patientId);
    if (!patientInfo) {
      throw new Error("Patient not found");
    }

    const now = ports.clock.now();
    const { isCheckIn, localDate } = isCheckInDay(now, patientInfo.schedule);

    if (isCheckIn) {
      return { ok: false, error: "No task offered on check-in days" };
    }

    const existingRecord = await ports.taskRecords.getTaskRecord(
      input.patientId,
      localDate
    );

    if (existingRecord && existingRecord.status === "completed") {
      const task = getTaskByKey(existingRecord.taskKey);
      return {
        ok: true,
        value: {
          task,
          localDate,
          status: "completed",
          rewarded: false,
        },
      };
    }

    let recordToUpdate = existingRecord;
    if (!recordToUpdate) {
      const preferred = await ports.preferences.getPreferences(input.patientId);
      const history = await ports.taskRecords.getHistory(input.patientId);
      const offeredTask = determineOfferedTask({
        preferredKeys: preferred,
        history,
        localDate,
      });

      recordToUpdate = createTaskRecord({
        id: `task-${input.patientId}-${localDate}`,
        patientId: input.patientId,
        localDate,
        taskKey: offeredTask.key,
        status: "offered",
      });
    }

    const updatedRecord = {
      ...recordToUpdate,
      status: "not_today" as const,
      respondedAt: now,
    };
    await ports.taskRecords.saveTaskRecord(updatedRecord);

    const task = getTaskByKey(updatedRecord.taskKey);
    return {
      ok: true,
      value: {
        task,
        localDate,
        status: "not_today",
        rewarded: false,
      },
    };
  });
}
