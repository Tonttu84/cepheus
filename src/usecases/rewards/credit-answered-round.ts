import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import { calculateBalance, createLedgerEntry } from "../../domain/rewards/ledger";
import type { RewardsConfig } from "../../domain/rewards/types";
import {
  DuplicateLedgerEntryError,
  type CreditAnsweredRoundResult,
  type RewardsPorts,
  type UseCaseResult,
} from "./ports";

export interface CreditAnsweredRoundInput {
  readonly patientId: string;
  readonly roundNumber: number;
}

export async function creditAnsweredRound(
  actor: Actor,
  input: CreditAnsweredRoundInput,
  ports: RewardsPorts
): Promise<UseCaseResult<CreditAnsweredRoundResult>> {
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

  if (!Number.isInteger(input.roundNumber) || input.roundNumber <= 0) {
    return { ok: false, error: "Invalid roundNumber" };
  }

  const access = decideRewardsAccess(actor, input.patientId);
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  const result = await ports.unitOfWork.execute(async () => {
    const existingEntry = await ports.ledger.getEntryByRound(
      input.patientId,
      input.roundNumber
    );

    const allEntries = await ports.ledger.getEntries(input.patientId);
    const currentBalance = calculateBalance(allEntries);

    if (existingEntry) {
      return {
        rewarded: false,
        amountCents: 0,
        roundNumber: input.roundNumber,
        balanceCents: currentBalance,
        isDuplicate: true,
        isSimulated: true as const,
      };
    }

    const outcome = await ports.rounds.getRoundOutcome(
      input.patientId,
      input.roundNumber
    );

    if (!outcome || outcome.status !== "answered") {
      return {
        rewarded: false,
        amountCents: 0,
        roundNumber: input.roundNumber,
        balanceCents: currentBalance,
        isDuplicate: false,
        isSimulated: true as const,
        reason: "round_not_answered",
      };
    }

    const now = ports.clock.now();
    const entryId = `round-${input.patientId}-${input.roundNumber}`;
    const newEntry = createLedgerEntry({
      id: entryId,
      patientId: input.patientId,
      kind: "answered_round",
      amountCents: config.answeredRoundRewardCents,
      roundNumber: input.roundNumber,
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
          rewarded: false,
          amountCents: 0,
          roundNumber: input.roundNumber,
          balanceCents: currentBalance,
          isDuplicate: true,
          isSimulated: true as const,
        };
      }
      throw error;
    }

    const updatedBalance = currentBalance + config.answeredRoundRewardCents;

    return {
      rewarded: true,
      amountCents: config.answeredRoundRewardCents,
      roundNumber: input.roundNumber,
      balanceCents: updatedBalance,
      isDuplicate: false,
      isSimulated: true as const,
    };
  });

  return { ok: true, value: result };
}
