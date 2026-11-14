import type {
  Clock,
  PatientScheduleInfo,
  PatientScheduleReader,
  RewardLedgerRepository,
  RewardsPorts,
  RoundOutcomeReader,
  StoredRoundOutcome,
  TaskPreferenceRepository,
  TaskRecordRepository,
  UnitOfWork,
} from "../ports";
import { DuplicateLedgerEntryError } from "../ports";
import type { RewardLedgerEntry, RewardsConfig } from "../../../domain/rewards/types";
import type { TaskKey, TaskRecord } from "../../../domain/small-tasks/types";
import { DEFAULT_REWARDS_CONFIG } from "../../../domain/rewards/config";
import { calculateBalance } from "../../../domain/rewards/ledger";

export class FakeClock implements Clock {
  private currentIso: string;

  constructor(initialIso: string = "2026-11-14T10:00:00.000Z") {
    this.currentIso = initialIso;
  }

  now(): string {
    return this.currentIso;
  }

  setTime(iso: string): void {
    this.currentIso = iso;
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  public executionCount = 0;
  private tail: Promise<void> = Promise.resolve();

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let resolveTail!: () => void;
    this.tail = new Promise<void>((resolve) => {
      resolveTail = resolve;
    });

    await prev;
    try {
      this.executionCount++;
      return await fn();
    } finally {
      resolveTail();
    }
  }
}

export class FakeRewardLedgerRepository implements RewardLedgerRepository {
  private entries: RewardLedgerEntry[] = [];

  async getEntries(patientId: string): Promise<readonly RewardLedgerEntry[]> {
    return this.entries.filter((e) => e.patientId === patientId);
  }

  async appendEntry(entry: RewardLedgerEntry): Promise<void> {
    if (this.entries.some((e) => e.id === entry.id)) {
      throw new DuplicateLedgerEntryError(entry.id);
    }
    const patientEntries = [
      ...this.entries.filter((e) => e.patientId === entry.patientId),
      entry,
    ];
    calculateBalance(patientEntries);
    this.entries.push(entry);
  }

  async getEntryByRound(
    patientId: string,
    roundNumber: number
  ): Promise<RewardLedgerEntry | null> {
    const entry = this.entries.find(
      (e) =>
        e.patientId === patientId &&
        e.kind === "answered_round" &&
        e.roundNumber === roundNumber
    );
    return entry ?? null;
  }

  async getEntryByTaskDate(
    patientId: string,
    localDate: string
  ): Promise<RewardLedgerEntry | null> {
    const entry = this.entries.find(
      (e) =>
        e.patientId === patientId &&
        e.kind === "small_task" &&
        e.localDate === localDate
    );
    return entry ?? null;
  }

  async getEntryByRequestId(
    patientId: string,
    requestId: string
  ): Promise<RewardLedgerEntry | null> {
    const entry = this.entries.find(
      (e) =>
        e.patientId === patientId &&
        e.kind === "payout" &&
        e.requestId === requestId
    );
    return entry ?? null;
  }

  getAllEntries(): readonly RewardLedgerEntry[] {
    return [...this.entries];
  }
}

export class FakeTaskPreferenceRepository implements TaskPreferenceRepository {
  private preferencesByPatient = new Map<string, TaskKey[]>();

  async getPreferences(patientId: string): Promise<readonly TaskKey[] | null> {
    const prefs = this.preferencesByPatient.get(patientId);
    return prefs ? [...prefs] : null;
  }

  async savePreferences(
    patientId: string,
    preferredTaskKeys: readonly TaskKey[]
  ): Promise<void> {
    this.preferencesByPatient.set(patientId, [...preferredTaskKeys]);
  }
}

export class FakeTaskRecordRepository implements TaskRecordRepository {
  private recordsByPatient = new Map<string, TaskRecord[]>();

  async getTaskRecord(
    patientId: string,
    localDate: string
  ): Promise<TaskRecord | null> {
    const records = this.recordsByPatient.get(patientId) ?? [];
    const found = records.find((r) => r.localDate === localDate);
    return found ? { ...found } : null;
  }

  async getHistory(patientId: string): Promise<readonly TaskRecord[]> {
    const records = this.recordsByPatient.get(patientId) ?? [];
    return [...records];
  }

  async saveTaskRecord(record: TaskRecord): Promise<void> {
    const records = this.recordsByPatient.get(record.patientId) ?? [];
    const index = records.findIndex((r) => r.localDate === record.localDate);
    if (index >= 0) {
      records[index] = { ...record };
    } else {
      records.push({ ...record });
    }
    this.recordsByPatient.set(record.patientId, records);
  }

  async getCompletedTasksCount(patientId: string): Promise<number> {
    const records = this.recordsByPatient.get(patientId) ?? [];
    return records.filter((r) => r.status === "completed").length;
  }
}

export class FakePatientScheduleReader implements PatientScheduleReader {
  private patients = new Map<string, PatientScheduleInfo>();

  setPatient(info: PatientScheduleInfo): void {
    this.patients.set(info.patientId, info);
  }

  async getPatientSchedule(patientId: string): Promise<PatientScheduleInfo | null> {
    const p = this.patients.get(patientId);
    return p ? { ...p } : null;
  }
}

export class FakeRoundOutcomeReader implements RoundOutcomeReader {
  private outcomesByPatient = new Map<string, StoredRoundOutcome[]>();

  setRoundOutcome(patientId: string, outcome: StoredRoundOutcome): void {
    const list = this.outcomesByPatient.get(patientId) ?? [];
    const index = list.findIndex((r) => r.roundNumber === outcome.roundNumber);
    if (index >= 0) {
      list[index] = outcome;
    } else {
      list.push(outcome);
    }
    this.outcomesByPatient.set(patientId, list);
  }

  async getRoundOutcome(
    patientId: string,
    roundNumber: number
  ): Promise<StoredRoundOutcome | null> {
    const list = this.outcomesByPatient.get(patientId) ?? [];
    const found = list.find((r) => r.roundNumber === roundNumber);
    return found ?? null;
  }

  async getAnsweredRoundsCount(patientId: string): Promise<number> {
    const list = this.outcomesByPatient.get(patientId) ?? [];
    return list.filter((r) => r.status === "answered").length;
  }
}

export interface FakeRewardsPorts extends RewardsPorts {
  readonly ledger: FakeRewardLedgerRepository;
  readonly preferences: FakeTaskPreferenceRepository;
  readonly taskRecords: FakeTaskRecordRepository;
  readonly patients: FakePatientScheduleReader;
  readonly rounds: FakeRoundOutcomeReader;
  readonly clock: FakeClock;
  readonly unitOfWork: FakeUnitOfWork;
  readonly config?: Partial<RewardsConfig>;
}

export function createFakeRewardsPorts(options?: {
  readonly config?: Partial<RewardsConfig>;
  readonly clockTime?: string;
}): FakeRewardsPorts {
  return {
    ledger: new FakeRewardLedgerRepository(),
    preferences: new FakeTaskPreferenceRepository(),
    taskRecords: new FakeTaskRecordRepository(),
    patients: new FakePatientScheduleReader(),
    rounds: new FakeRoundOutcomeReader(),
    clock: new FakeClock(options?.clockTime),
    unitOfWork: new FakeUnitOfWork(),
    config: options?.config ?? DEFAULT_REWARDS_CONFIG,
  };
}
