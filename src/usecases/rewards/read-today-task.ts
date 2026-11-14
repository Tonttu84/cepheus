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
import type { RewardsPorts, TodayTaskResult, UseCaseResult } from "./ports";

export interface ReadTodayTaskInput {
  readonly patientId: string;
}

export async function readTodayTask(
  actor: Actor,
  input: ReadTodayTaskInput,
  ports: RewardsPorts
): Promise<UseCaseResult<TodayTaskResult>> {
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

  const result = await ports.unitOfWork.execute(async () => {
    const patientInfo = await ports.patients.getPatientSchedule(input.patientId);
    if (!patientInfo) {
      throw new Error("Patient not found");
    }

    const now = ports.clock.now();
    const { isCheckIn, localDate } = isCheckInDay(now, patientInfo.schedule);

    if (isCheckIn) {
      return {
        offered: false,
        reason: "check_in_day" as const,
        localDate,
      };
    }

    const existingRecord = await ports.taskRecords.getTaskRecord(
      input.patientId,
      localDate
    );

    const rewardedEntry = await ports.ledger.getEntryByTaskDate(
      input.patientId,
      localDate
    );

    if (existingRecord) {
      const task = getTaskByKey(existingRecord.taskKey);
      return {
        offered: true,
        localDate,
        task,
        status: existingRecord.status,
        rewardCents: config.smallTaskRewardCents,
        alreadyRewardedToday: Boolean(rewardedEntry),
      };
    }

    const preferred = await ports.preferences.getPreferences(input.patientId);
    const history = await ports.taskRecords.getHistory(input.patientId);
    const task = determineOfferedTask({
      preferredKeys: preferred,
      history,
      localDate,
    });

    const newRecord = createTaskRecord({
      id: `task-${input.patientId}-${localDate}`,
      patientId: input.patientId,
      localDate,
      taskKey: task.key,
      status: "offered",
    });

    await ports.taskRecords.saveTaskRecord(newRecord);

    return {
      offered: true,
      localDate,
      task,
      status: "offered" as const,
      rewardCents: config.smallTaskRewardCents,
      alreadyRewardedToday: false,
    };
  });

  return { ok: true, value: result };
}
