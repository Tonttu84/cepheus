/**
 * Answers to a questionnaire that is still in progress, kept in this process's
 * memory only and never written to disk (the owner's rule while no feature
 * sends item answers anywhere). Entries are keyed by patient, questionnaire
 * kind and round number, and an entry untouched for 14 days is dropped.
 * Nothing here logs.
 */

export interface InProgressAnswer {
  readonly id: string;
  readonly value: number;
}

export type AnswerKind = "phq9" | "gad7";

/** Reading and changing in-progress answers, directly or inside a unit of work. */
export interface AnswerStoreView {
  get(patientId: string, kind: AnswerKind, roundNumber: number): readonly InProgressAnswer[] | undefined;
  set(patientId: string, kind: AnswerKind, roundNumber: number, answers: readonly InProgressAnswer[]): void;
  delete(patientId: string, kind: AnswerKind, roundNumber: number): void;
}

interface Entry {
  readonly answers: readonly InProgressAnswer[];
  readonly updatedAtMs: number;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function keyOf(patientId: string, kind: AnswerKind, roundNumber: number): string {
  return JSON.stringify([patientId, kind, roundNumber]);
}

function copyOf(answers: readonly InProgressAnswer[]): readonly InProgressAnswer[] {
  return answers.map(({ id, value }) => ({ id, value }));
}

export class InMemoryAnswerStore implements AnswerStoreView {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly nowMs: () => number = () => Date.now(),
    private readonly maxAgeMs: number = FOURTEEN_DAYS_MS
  ) {}

  /** Starts a set of changes that reach this store only when `commit` is called. */
  stage(): StagedAnswerStore {
    return new StagedAnswerStore(this);
  }

  get(patientId: string, kind: AnswerKind, roundNumber: number): readonly InProgressAnswer[] | undefined {
    this.dropExpired();
    const entry = this.entries.get(keyOf(patientId, kind, roundNumber));
    return entry ? copyOf(entry.answers) : undefined;
  }

  set(patientId: string, kind: AnswerKind, roundNumber: number, answers: readonly InProgressAnswer[]): void {
    this.dropExpired();
    this.entries.set(keyOf(patientId, kind, roundNumber), {
      answers: copyOf(answers),
      updatedAtMs: this.nowMs(),
    });
  }

  delete(patientId: string, kind: AnswerKind, roundNumber: number): void {
    this.entries.delete(keyOf(patientId, kind, roundNumber));
  }

  deleteForPatient(patientId: string): void {
    for (const key of this.entries.keys()) {
      try {
        const parsed = JSON.parse(key);
        if (Array.isArray(parsed) && parsed[0] === patientId) {
          this.entries.delete(key);
        }
      } catch {
        // ignore malformed keys
      }
    }
  }

  deleteForPatients(patientIds: readonly string[]): void {
    for (const patientId of patientIds) {
      this.deleteForPatient(patientId);
    }
  }

  size(): number {
    return this.entries.size;
  }

  private dropExpired(): void {
    const now = this.nowMs();
    for (const [key, entry] of this.entries) {
      if (now - entry.updatedAtMs > this.maxAgeMs) this.entries.delete(key);
    }
  }
}

interface StagedChange {
  readonly patientId: string;
  readonly kind: AnswerKind;
  readonly roundNumber: number;
  readonly answers: readonly InProgressAnswer[] | null;
}

/**
 * The changes one unit of work makes. Its reads see them over the shared
 * store; nothing reaches the shared store until `commit`, so a unit of work
 * that rolls back leaves no answers behind and undoes none of its deletes.
 */
export class StagedAnswerStore implements AnswerStoreView {
  private readonly pending = new Map<string, StagedChange>();

  constructor(private readonly base: InMemoryAnswerStore) {}

  get(patientId: string, kind: AnswerKind, roundNumber: number): readonly InProgressAnswer[] | undefined {
    const change = this.pending.get(keyOf(patientId, kind, roundNumber));
    if (change) return change.answers === null ? undefined : copyOf(change.answers);
    return this.base.get(patientId, kind, roundNumber);
  }

  set(patientId: string, kind: AnswerKind, roundNumber: number, answers: readonly InProgressAnswer[]): void {
    this.pending.set(keyOf(patientId, kind, roundNumber), {
      patientId,
      kind,
      roundNumber,
      answers: copyOf(answers),
    });
  }

  delete(patientId: string, kind: AnswerKind, roundNumber: number): void {
    this.pending.set(keyOf(patientId, kind, roundNumber), { patientId, kind, roundNumber, answers: null });
  }

  /** Applies the staged changes to the shared store. */
  commit(): void {
    for (const change of this.pending.values()) {
      if (change.answers === null) this.base.delete(change.patientId, change.kind, change.roundNumber);
      else this.base.set(change.patientId, change.kind, change.roundNumber, change.answers);
    }
    this.pending.clear();
  }
}

/** The one store this process shares; tests inject their own. */
export const sharedAnswerStore = new InMemoryAnswerStore();
