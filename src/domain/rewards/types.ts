export type RewardLedgerEntryKind = "answered_round" | "small_task" | "payout";

export interface RewardLedgerEntry {
  readonly id: string;
  readonly patientId: string;
  readonly kind: RewardLedgerEntryKind;
  readonly amountCents: number; // Integer cents; positive for earned rewards, negative for payout
  readonly roundNumber?: number;
  readonly taskKey?: string;
  readonly localDate?: string; // YYYY-MM-DD in patient's local time zone
  readonly requestId?: string;
  readonly createdAt: string; // ISO 8601 UTC
  readonly isSimulated: true;
}

export interface RewardsConfig {
  readonly enabled: boolean;
  readonly answeredRoundRewardCents: number;
  readonly smallTaskRewardCents: number;
  readonly payoutThresholdCents: number;
  readonly maxRewardedTasksPerLocalDay: number;
}

export interface ActivityCounts {
  readonly tasksDone: number;
  readonly roundsAnswered: number;
  readonly walks?: number;
}

export interface AccountSummary {
  readonly balanceCents: number;
  readonly entries: readonly RewardLedgerEntry[];
  readonly counts: ActivityCounts;
  readonly payoutThresholdCents: number;
  readonly payoutAvailable: boolean;
  readonly centsToPayout: number;
  readonly isSimulated: true;
}

export interface RewardsAccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
}
