import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import { buildAccountSummary } from "../../domain/rewards/ledger";
import type { AccountSummary, RewardsConfig } from "../../domain/rewards/types";
import type { RewardsPorts, UseCaseResult } from "./ports";

export interface ReadAccountInput {
  readonly patientId: string;
}

export async function readAccount(
  actor: Actor,
  input: ReadAccountInput,
  ports: RewardsPorts
): Promise<UseCaseResult<AccountSummary>> {
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

  const summary = await ports.unitOfWork.execute(async () => {
    const entries = await ports.ledger.getEntries(input.patientId);

    let tasksDone = 0;
    if (ports.taskRecords.getCompletedTasksCount) {
      tasksDone = await ports.taskRecords.getCompletedTasksCount(input.patientId);
    } else {
      const history = await ports.taskRecords.getHistory(input.patientId);
      tasksDone = history.filter((r) => r.status === "completed").length;
    }

    let walks = 0;
    if (ports.taskRecords.getCompletedWalksCount) {
      walks = await ports.taskRecords.getCompletedWalksCount(input.patientId);
    } else {
      const history = await ports.taskRecords.getHistory(input.patientId);
      walks = history.filter((r) => r.status === "completed" && r.taskKey === "short_walk").length;
    }

    let roundsAnswered = 0;
    if (ports.rounds.getAnsweredRoundsCount) {
      roundsAnswered = await ports.rounds.getAnsweredRoundsCount(input.patientId);
    }

    return buildAccountSummary({
      entries,
      counts: { tasksDone, roundsAnswered, walks },
      config,
    });
  });

  return { ok: true, value: summary };
}
