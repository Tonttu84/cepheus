import type { Schedule, RoundStatus } from "../../domain/rounds/types";
import type {
  RewardLedgerEntry,
  RewardsConfig,
} from "../../domain/rewards/types";
import type {
  SmallTask,
  TaskKey,
  TaskRecord,
} from "../../domain/small-tasks/types";

export type UseCaseResult<T, E = unknown> =
  | { readonly ok: true; readonly value: T }
  | ({ readonly ok: false; readonly error: string } & E);

export interface Clock {
  now(): string;
}

export interface UnitOfWork {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

export class DuplicateLedgerEntryError extends Error {
  constructor(readonly entryId: string) {
    super(`Duplicate ledger entry: ${entryId}`);
    this.name = "DuplicateLedgerEntryError";
  }
}

export interface RewardLedgerRepository {
  getEntries(patientId: string): Promise<readonly RewardLedgerEntry[]>;
  /**
   * Appends a new ledger entry.
   * Must refuse a second entry with an existing id (a real implementation backs this
   * with a unique key constraint) by throwing a DuplicateLedgerEntryError.
   */
  appendEntry(entry: RewardLedgerEntry): Promise<void>;
  getEntryByRound(patientId: string, roundNumber: number): Promise<RewardLedgerEntry | null>;
  getEntryByTaskDate(patientId: string, localDate: string): Promise<RewardLedgerEntry | null>;
  getEntryByRequestId(patientId: string, requestId: string): Promise<RewardLedgerEntry | null>;
}

export interface TaskPreferenceRepository {
  getPreferences(patientId: string): Promise<readonly TaskKey[] | null>;
  savePreferences(patientId: string, preferredTaskKeys: readonly TaskKey[]): Promise<void>;
}

export interface TaskRecordRepository {
  getTaskRecord(patientId: string, localDate: string): Promise<TaskRecord | null>;
  getHistory(patientId: string): Promise<readonly TaskRecord[]>;
  saveTaskRecord(record: TaskRecord): Promise<void>;
  getCompletedTasksCount?(patientId: string): Promise<number>;
}

export interface PatientScheduleInfo {
  readonly patientId: string;
  readonly clinicId: string;
  readonly schedule: Schedule;
}

export interface PatientScheduleReader {
  getPatientSchedule(patientId: string): Promise<PatientScheduleInfo | null>;
}

export interface StoredRoundOutcome {
  readonly roundNumber: number;
  readonly status: RoundStatus;
  readonly answeredAt?: string | null;
}

export interface RoundOutcomeReader {
  getRoundOutcome(patientId: string, roundNumber: number): Promise<StoredRoundOutcome | null>;
  getAnsweredRoundsCount?(patientId: string): Promise<number>;
}

export interface RewardsPorts {
  readonly ledger: RewardLedgerRepository;
  readonly preferences: TaskPreferenceRepository;
  readonly taskRecords: TaskRecordRepository;
  readonly patients: PatientScheduleReader;
  readonly rounds: RoundOutcomeReader;
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
  readonly config?: Partial<RewardsConfig>;
}

export interface CreditAnsweredRoundResult {
  readonly rewarded: boolean;
  readonly amountCents: number;
  readonly roundNumber: number;
  readonly balanceCents: number;
  readonly isDuplicate: boolean;
  readonly isSimulated: true;
  readonly reason?: string;
}

export interface TodayTaskResult {
  readonly offered: boolean;
  readonly localDate: string;
  readonly reason?: "check_in_day";
  readonly task?: SmallTask;
  readonly status?: "offered" | "completed" | "not_today";
  readonly rewardCents?: number;
  readonly alreadyRewardedToday?: boolean;
}

export interface MarkTaskDoneResult {
  readonly task: SmallTask;
  readonly localDate: string;
  readonly status: "completed";
  readonly source: "self_report";
  readonly rewarded: boolean;
  readonly rewardCents: number;
  readonly balanceCents: number;
  readonly isSimulated: true;
}

export interface MarkTaskNotTodayResult {
  readonly task: SmallTask;
  readonly localDate: string;
  readonly status: "not_today" | "completed";
  readonly rewarded: false;
}

export interface PreferencesResult {
  readonly patientId: string;
  readonly preferredTaskKeys: readonly TaskKey[];
  readonly effectiveTasks: readonly SmallTask[];
}

export interface RequestPayoutResult {
  readonly payoutCents: number;
  readonly newBalanceCents: number;
  readonly isDuplicate: boolean;
  readonly entry: RewardLedgerEntry;
  readonly isSimulated: true;
}
