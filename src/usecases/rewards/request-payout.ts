import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import { calculateBalance, canRequestPayout, createLedgerEntry } from "../../domain/rewards/ledger";
import type { RewardsConfig } from "../../domain/rewards/types";
import {
  DuplicateLedgerEntryError,
  type RequestPayoutResult,
  type RewardsPorts,
  type UseCaseResult,
} from "./ports";

export interface RequestPayoutInput {
  readonly patientId: string;
  readonly requestId: string;
}

const MAX_REQUEST_ID_LENGTH = 128;

export async function requestPayout(
  actor: Actor,
  input: RequestPayoutInput,
  ports: RewardsPorts
): Promise<UseCaseResult<RequestPayoutResult>> {
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

  if (
    !input.requestId ||
    typeof input.requestId !== "string" ||
    input.requestId.trim().length === 0 ||
    input.requestId.length > MAX_REQUEST_ID_LENGTH
  ) {
    return { ok: false, error: "Invalid requestId" };
  }

  const access = decideRewardsAccess(actor, input.patientId);
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  return await ports.unitOfWork.execute<UseCaseResult<RequestPayoutResult>>(async () => {
    const existingPayout = await ports.ledger.getEntryByRequestId(
      input.patientId,
      input.requestId
    );
    if (existingPayout) {
      const all = await ports.ledger.getEntries(input.patientId);
      const currentBalance = calculateBalance(all);
      return {
        ok: true,
        value: {
          payoutCents: Math.abs(existingPayout.amountCents),
          newBalanceCents: currentBalance,
          isDuplicate: true,
          entry: existingPayout,
          isSimulated: true,
        },
      };
    }

    const allEntries = await ports.ledger.getEntries(input.patientId);
    const currentBalance = calculateBalance(allEntries);

    if (!canRequestPayout(currentBalance, config.payoutThresholdCents)) {
      return { ok: false, error: "insufficient_balance" };
    }

    const now = ports.clock.now();
    const entryId = `payout-${input.patientId}-${input.requestId}`;
    const payoutEntry = createLedgerEntry({
      id: entryId,
      patientId: input.patientId,
      kind: "payout",
      amountCents: -config.payoutThresholdCents,
      requestId: input.requestId,
      createdAt: now,
    });

    try {
      await ports.ledger.appendEntry(payoutEntry);
    } catch (error) {
      if (
        error instanceof DuplicateLedgerEntryError ||
        (error as Error)?.name === "DuplicateLedgerEntryError"
      ) {
        const existing =
          (await ports.ledger.getEntryByRequestId(input.patientId, input.requestId)) ??
          payoutEntry;
        return {
          ok: true,
          value: {
            payoutCents: config.payoutThresholdCents,
            newBalanceCents: currentBalance,
            isDuplicate: true,
            entry: existing,
            isSimulated: true,
          },
        };
      }
      throw error;
    }

    const newBalance = currentBalance - config.payoutThresholdCents;

    return {
      ok: true,
      value: {
        payoutCents: config.payoutThresholdCents,
        newBalanceCents: newBalance,
        isDuplicate: false,
        entry: payoutEntry,
        isSimulated: true,
      },
    };
  });
}
