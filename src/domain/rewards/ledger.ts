import type {
  AccountSummary,
  ActivityCounts,
  RewardLedgerEntry,
  RewardLedgerEntryKind,
  RewardsConfig,
} from "./types";

export function calculateBalance(entries: readonly RewardLedgerEntry[]): number {
  let sum = 0;
  for (const entry of entries) {
    if (!Number.isInteger(entry.amountCents)) {
      throw new Error(`Non-integer amount in ledger entry ${entry.id}: ${entry.amountCents}`);
    }
    sum += entry.amountCents;
    if (sum < 0) {
      throw new Error(
        `Ledger invariant violated: balance cannot be negative (dropped to ${sum} at entry ${entry.id})`
      );
    }
  }
  return sum;
}

export function canRequestPayout(balanceCents: number, thresholdCents: number): boolean {
  return balanceCents >= thresholdCents;
}

export function calculateCentsToPayout(balanceCents: number, thresholdCents: number): number {
  if (balanceCents >= thresholdCents) {
    return 0;
  }
  return thresholdCents - balanceCents;
}

export interface BuildAccountSummaryParams {
  readonly entries: readonly RewardLedgerEntry[];
  readonly counts: ActivityCounts;
  readonly config: RewardsConfig;
}

export function buildAccountSummary(params: BuildAccountSummaryParams): AccountSummary {
  const balanceCents = calculateBalance(params.entries);
  const thresholdCents = params.config.payoutThresholdCents;
  return {
    balanceCents,
    entries: params.entries,
    counts: {
      ...params.counts,
      walks: params.counts.walks ?? 0,
    },
    payoutThresholdCents: thresholdCents,
    payoutAvailable: canRequestPayout(balanceCents, thresholdCents),
    centsToPayout: calculateCentsToPayout(balanceCents, thresholdCents),
    isSimulated: true,
  };
}

export interface CreateEntryParams {
  readonly id: string;
  readonly patientId: string;
  readonly kind: RewardLedgerEntryKind;
  readonly amountCents: number;
  readonly createdAt: string;
  readonly roundNumber?: number;
  readonly taskKey?: string;
  readonly localDate?: string;
  readonly requestId?: string;
}

export function createLedgerEntry(params: CreateEntryParams): RewardLedgerEntry {
  if (!Number.isInteger(params.amountCents) || params.amountCents === 0) {
    throw new Error(`Entry amount must be a non-zero integer in cents, received: ${params.amountCents}`);
  }
  if (params.kind === "payout" && params.amountCents > 0) {
    throw new Error(`Payout entry amount must be negative, received: ${params.amountCents}`);
  }
  if ((params.kind === "answered_round" || params.kind === "small_task") && params.amountCents < 0) {
    throw new Error(`Reward credit entry amount must be positive, received: ${params.amountCents}`);
  }

  return {
    id: params.id,
    patientId: params.patientId,
    kind: params.kind,
    amountCents: params.amountCents,
    roundNumber: params.roundNumber,
    taskKey: params.taskKey,
    localDate: params.localDate,
    requestId: params.requestId,
    createdAt: params.createdAt,
    isSimulated: true,
  };
}
