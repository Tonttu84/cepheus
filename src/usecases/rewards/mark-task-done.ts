import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import { calculateBalance, createLedgerEntry } from "../../domain/rewards/ledger";
import type { RewardsConfig } from "../../domain/rewards/types";
import { getTaskByKey } from "../../domain/small-tasks/catalogue";
import {
  createTaskRecord,
  determineOfferedTask,
  isCheckInDay,
} from "../../domain/small-tasks/rotation";
import {
  DuplicateLedgerEntryError,
  type MarkTaskDoneResult,
  type RewardsPorts,
  type UseCaseResult,
} from "./ports";

export interface MarkTaskDoneInput {
  readonly patientId: string;
}

export async function markTaskDone(
  actor: Actor,
  input: MarkTaskDoneInput,
  ports: RewardsPorts
): Promise<UseCaseResult<MarkTaskDoneResult>> {
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

  return await ports.unitOfWork.execute<UseCaseResult<MarkTaskDoneResult>>(async () => {
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
      const allEntries = await ports.ledger.getEntries(input.patientId);
      const currentBalance = calculateBalance(allEntries);
      return {
        ok: true,
        value: {
          task,
          localDate,
          status: "completed",
          source: "self_report",
          rewarded: false,
          rewardCents: 0,
          balanceCents: currentBalance,
          isSimulated: true,
        },
      };
    }

    let recordToComplete = existingRecord;
    if (!recordToComplete) {
      const preferred = await ports.preferences.getPreferences(input.patientId);
      const history = await ports.taskRecords.getHistory(input.patientId);
      const offeredTask = determineOfferedTask({
        preferredKeys: preferred,
        history,
        localDate,
      });

      recordToComplete = createTaskRecord({
        id: `task-${input.patientId}-${localDate}`,
        patientId: input.patientId,
        localDate,
        taskKey: offeredTask.key,
        status: "offered",
      });
    }

    const updatedRecord = {
      ...recordToComplete,
      status: "completed" as const,
      source: "self_report" as const,
      completedAt: recordToComplete.completedAt ?? now,
      respondedAt: now,
    };
    await ports.taskRecords.saveTaskRecord(updatedRecord);

    const task = getTaskByKey(updatedRecord.taskKey);
    const existingEntry = await ports.ledger.getEntryByTaskDate(
      input.patientId,
      localDate
    );

    const allEntries = await ports.ledger.getEntries(input.patientId);
    const currentBalance = calculateBalance(allEntries);

    if (existingEntry) {
      return {
        ok: true,
        value: {
          task,
          localDate,
          status: "completed",
          source: "self_report",
          rewarded: false,
          rewardCents: 0,
          balanceCents: currentBalance,
          isSimulated: true,
        },
      };
    }

    const entryId = `task-reward-${input.patientId}-${localDate}`;
    const newEntry = createLedgerEntry({
      id: entryId,
      patientId: input.patientId,
      kind: "small_task",
      amountCents: config.smallTaskRewardCents,
      taskKey: task.key,
      localDate,
      createdAt: now,
    });

    try {
      await ports.ledger.appendEntry(newEntry);
    } catch (error) {
      if (
        error instanceof DuplicateLedgerEntryError ||
        (error as Error)?.name === "DuplicateLedgerEntryError"
      ) {
        return {
          ok: true,
          value: {
            task,
            localDate,
            status: "completed",
            source: "self_report",
            rewarded: false,
            rewardCents: 0,
            balanceCents: currentBalance,
            isSimulated: true,
          },
        };
      }
      throw error;
    }

    const updatedBalance = currentBalance + config.smallTaskRewardCents;

    return {
      ok: true,
      value: {
        task,
        localDate,
        status: "completed",
        source: "self_report",
        rewarded: true,
        rewardCents: config.smallTaskRewardCents,
        balanceCents: updatedBalance,
        isSimulated: true,
      },
    };
  });
}
