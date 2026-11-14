import type {
  Actor,
  Action,
  TargetData,
  Purpose,
  AccessReasonCode,
} from '../domain/access';
import type { ConsentState } from '../domain/consent';
import type { Schedule, RoundStatus, Phq9Progress } from '../domain/rounds';
import type { Phq9Answer } from '../domain/instruments';
import type { CallPosition, EvaluatedEffect } from '../domain/history';

export type UseCaseResult<T, E = unknown> =
  | { readonly ok: true; readonly value: T }
  | ({ readonly ok: false; readonly error: string } & E);

export interface Clock {
  now(): string;
}

export interface PatientRecord {
  readonly patientId: string;
  readonly clinicId: string;
  readonly schedule: Schedule;
  readonly consent: ConsentState;
}

export interface PatientAccessSwitches {
  readonly patientId: string;
  readonly clinicId: string;
  readonly consent: ConsentState;
}

export interface PatientRepository {
  getPatient(patientId: string): Promise<PatientRecord | null>;
  getPatientAccessSwitches(patientId: string): Promise<PatientAccessSwitches | null>;
  savePatient(record: PatientRecord): Promise<void>;
}

export interface StoredRound {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly localDate: string;
  readonly status?: RoundStatus | null;
  readonly mood?: number | null;
  readonly interest?: number | null;
  readonly reminderSentAt?: string | null;
  readonly answeredAt?: string | null;
}

export interface RoundRepository {
  getRounds(patientId: string): Promise<readonly StoredRound[]>;
  getRound(patientId: string, roundNumber: number): Promise<StoredRound | null>;
  saveRound(round: StoredRound): Promise<void>;
}

export interface StoredPhq9 {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly progress: Phq9Progress;
  readonly answers: readonly Phq9Answer[];
  readonly total?: number | null;
  readonly completedAt?: string | null;
  readonly completedInRoundNumber?: number | null;
  readonly date?: string | null;
}

export interface Phq9Repository {
  getPhq9s(patientId: string): Promise<readonly StoredPhq9[]>;
  getCurrentPhq9(patientId: string): Promise<StoredPhq9 | null>;
  savePhq9(assessment: StoredPhq9): Promise<void>;
}

export interface StoredCall {
  readonly patientId: string;
  readonly date: string;
  readonly position?: CallPosition;
}

export interface CallRepository {
  getCalls(patientId: string): Promise<readonly StoredCall[]>;
  saveCall(call: StoredCall): Promise<void>;
}

export interface StoredWarning {
  readonly patientId: string;
  readonly kind: 'low_answers' | 'silence' | 'mixed' | 'phq9';
  readonly since: string;
  readonly version: number;
  readonly causedBy: EvaluatedEffect['causedBy'];
  readonly raisedAt: string;
}

export interface WarningRepository {
  getWarnings(patientId: string): Promise<readonly StoredWarning[]>;
  saveWarning(warning: StoredWarning): Promise<void>;
}

export interface StoredSmallDip {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly date: string;
  readonly version: number;
  readonly causedBy: EvaluatedEffect['causedBy'];
  readonly shownAt: string;
}

export interface SmallDipRepository {
  getSmallDips(patientId: string): Promise<readonly StoredSmallDip[]>;
  saveSmallDip(dip: StoredSmallDip): Promise<void>;
}

export interface StoredCrisisEvent {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly itemId: string;
  readonly value: number;
  readonly occurredAt: string;
  readonly acknowledgedAt?: string | null;
}

export interface CrisisRepository {
  getCrisisEvents(patientId: string): Promise<readonly StoredCrisisEvent[]>;
  saveCrisisEvent(event: StoredCrisisEvent): Promise<void>;
}

export interface StoredBaselineNotWellNotice {
  readonly patientId: string;
  readonly version: number;
  readonly causedBy: EvaluatedEffect['causedBy'];
  readonly notifiedAt: string;
}

export interface BaselineNotWellRepository {
  getNotices(patientId: string): Promise<readonly StoredBaselineNotWellNotice[]>;
  saveNotice(notice: StoredBaselineNotWellNotice): Promise<void>;
}

export interface StoredAccessLogEntry {
  readonly actor: Actor;
  readonly action: Action;
  readonly target: TargetData;
  readonly purpose: Purpose;
  readonly allowed: boolean;
  readonly reason: AccessReasonCode;
  readonly timestamp: string;
}

export interface AccessLogRepository {
  appendLog(entry: StoredAccessLogEntry): Promise<void>;
  getLogs(patientId?: string): Promise<readonly StoredAccessLogEntry[]>;
}

/**
 * The real implementation must give a use case a consistent view for one patient 
 * (for example by locking that patient's row), so two requests for one patient cannot interleave.
 */
export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export interface Ports {
  readonly clock: Clock;
  readonly patients: PatientRepository;
  readonly rounds: RoundRepository;
  readonly phq9: Phq9Repository;
  readonly calls: CallRepository;
  readonly warnings: WarningRepository;
  readonly smallDips: SmallDipRepository;
  readonly crisis: CrisisRepository;
  readonly baselineNotWell: BaselineNotWellRepository;
  readonly accessLog: AccessLogRepository;
  readonly unitOfWork: UnitOfWork;
}

export interface OpenRoundInfo {
  readonly number: number;
  readonly localDate: string;
  readonly opensAt: string;
  readonly endsAt: string;
}

export interface CheckInState {
  readonly openRound: OpenRoundInfo | null;
  readonly taps: 'waiting' | 'answered' | 'not_today';
  readonly isPhq9Due: boolean;
  readonly phq9Progress: Phq9Progress;
  readonly hasSuggestionWaiting: boolean;
}

export interface SubmitTapsResult {
  readonly ruleRunNeeded: boolean;
}

export interface SubmitNotTodayResult {
  readonly recorded: boolean;
  readonly ruleRunNeeded: boolean;
}

export interface SubmitPhq9AnswerResult {
  readonly showCrisisPath: boolean;
  readonly progress: Phq9Progress;
  readonly ruleRunNeeded: boolean;
}

export interface CloseElapsedRoundsResult {
  readonly closedRoundsCount: number;
  readonly remindersSentCount: number;
  readonly ruleRunNeeded: boolean;
}

export interface EvaluatePatientResult {
  readonly storedEffectsCount: number;
  readonly newEffects: readonly EvaluatedEffect[];
}
