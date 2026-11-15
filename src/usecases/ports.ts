import type {
  Actor,
  Action,
  TargetData,
  Purpose,
  AccessReasonCode,
} from '../domain/access';
import type { ConsentState } from '../domain/consent';
import type { Schedule, RoundStatus, Phq9Progress } from '../domain/rounds';
import type { Phq9Answer, Gad7Answer } from '../domain/instruments';
import type { CallPosition, EvaluatedEffect, QuestionnaireType } from '../domain/history';

export type { CallPosition };
import type { ExtraItem, ExtraItemsConfig } from '../domain/extra-items';
import type { CrisisResource } from '../lib/constants';
import type { CrisisEventItemId } from '../domain/crisis';

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
  readonly questionnaires?: readonly QuestionnaireType[];
  readonly isSimulated?: boolean;
}

export interface PatientAccessSwitches {
  readonly patientId: string;
  readonly clinicId: string;
  readonly consent: ConsentState;
  readonly questionnaires?: readonly QuestionnaireType[];
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

export type NurseCallStatus = 'requested' | 'completed' | 'unreachable';

export type NurseCallOutcomeTier =
  | 'rough_patch'
  | 'sustained_decline'
  | 'full_relapse'
  | 'crisis'
  | 'false_alarm';

export type NurseCallActionTaken =
  | 'advice_and_medication_check'
  | 'booster_tms_cluster'
  | 'new_tms_course_referral'
  | 'urgent_care'
  | 'none';

export interface StoredNurseCallRecord {
  readonly id?: string;
  readonly flagId?: string | null;
  readonly patientId: string;
  readonly clinicId?: string | null;
  readonly staffUserId?: string | null;
  readonly requestedAt?: string;
  readonly completedAt?: string | null;
  readonly status: NurseCallStatus;
  readonly outcomeTier?: NurseCallOutcomeTier | null;
  readonly actionTaken?: NurseCallActionTaken | null;
  readonly medicationChecked?: boolean;
  readonly watchNextRounds?: number;
  readonly boosterSessionsPlanned?: number | null;
  readonly isSimulated?: boolean;
  readonly date?: string | null;
  readonly position?: CallPosition | null;
}

export interface CallRepository {
  getCalls(patientId: string): Promise<readonly StoredCall[]>;
  saveCall(call: StoredCall): Promise<void>;
  saveNurseCallRecord(record: StoredNurseCallRecord): Promise<StoredNurseCallRecord>;
  getNurseCallRecords(patientId: string): Promise<readonly StoredNurseCallRecord[]>;
}

export type StoredCause =
  | { readonly type: 'round'; readonly roundNumber: number; readonly date: string }
  | { readonly type: 'phq9'; readonly date: string }
  | { readonly type: 'gad7'; readonly date: string };

export interface StoredWarning {
  readonly patientId: string;
  readonly kind: 'low_answers' | 'silence' | 'mixed' | 'phq9' | 'gad7';
  readonly since: string;
  readonly version: number;
  readonly causedBy: StoredCause;
  readonly raisedAt: string;
}

export interface StoredGad7 {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly answers: readonly Gad7Answer[];
  readonly total?: number | null;
  readonly completedAt?: string | null;
  readonly date?: string | null;
}

export interface Gad7Repository {
  getGad7s(patientId: string): Promise<readonly StoredGad7[]>;
  saveGad7(assessment: StoredGad7): Promise<void>;
}

export interface WarningRepository {
  getWarnings(patientId: string): Promise<readonly StoredWarning[]>;
  saveWarning(warning: StoredWarning): Promise<void>;
  updateFlagStatus(flagId: string, status: string): Promise<void>;
}

export interface StoredSmallDip {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly date: string;
  readonly version: number;
  readonly causedBy: StoredCause;
  readonly shownAt: string;
}

export interface SmallDipRepository {
  getSmallDips(patientId: string): Promise<readonly StoredSmallDip[]>;
  saveSmallDip(dip: StoredSmallDip): Promise<void>;
}

export interface StoredCrisisEvent {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly itemId: CrisisEventItemId;
  readonly value: number;
  readonly occurredAt: string;
  readonly acknowledgedAt?: string | null;
  readonly acknowledgedByStaffId?: string | null;
}

export interface CrisisRepository {
  getCrisisEvents(patientId: string): Promise<readonly StoredCrisisEvent[]>;
  getUnacknowledgedCrisisEvents(clinicId: string): Promise<readonly StoredCrisisEvent[]>;
  saveCrisisEvent(event: StoredCrisisEvent): Promise<void>;
}

export interface StoredBaselineNotWellNotice {
  readonly patientId: string;
  readonly version: number;
  readonly causedBy: StoredCause;
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

export interface StoredExtraAnswer {
  readonly patientId: string;
  readonly roundNumber: number;
  readonly itemId: string;
  readonly value: number;
  readonly answeredAt: string;
}

export interface ExtraAnswerRepository {
  getExtraAnswers(patientId: string): Promise<readonly StoredExtraAnswer[]>;
  getExtraAnswer(patientId: string, roundNumber: number): Promise<StoredExtraAnswer | null>;
  saveExtraAnswer(answer: StoredExtraAnswer): Promise<void>;
}

export type SuggestionStatus = 'shown' | 'accepted' | 'completed' | 'skipped';

export interface StoredSuggestion {
  readonly id: string;
  readonly patientId: string;
  readonly clinicId?: string | null;
  readonly createdAt: string;
  readonly date: string;
  readonly dayIndex?: number | null;
  readonly reason: string;
  readonly actionKey: string;
  readonly actionTitle: string;
  readonly actionDetail: string | null;
  readonly effortTier: string;
  readonly status: SuggestionStatus;
  readonly respondedAt?: string | null;
  readonly armType?: string;
  readonly nextCheckInDelta?: number | null;
  readonly isSimulated?: boolean;
}

export interface SuggestionRepository {
  getLatestSuggestion(patientId: string): Promise<StoredSuggestion | null>;
  getSuggestion(suggestionId: string): Promise<StoredSuggestion | null>;
  hasUnansweredSuggestion(patientId: string): Promise<boolean>;
  saveSuggestion(suggestion: StoredSuggestion): Promise<void>;
  updateSuggestionChoice(
    suggestionId: string,
    status: SuggestionStatus,
    respondedAt: string
  ): Promise<void>;
}

export interface StoredCameraReading {
  readonly participantId: string;
  readonly date: string;
  readonly dayIndex?: number | null;
  readonly taskId?: string;
  readonly durationSec: number;
  readonly sampleRateHz?: number;
  readonly effectiveFps: number;
  readonly faceDetectedRatio: number;
  readonly expressivityScore: number;
  readonly smileFraction: number;
  readonly mouthSmileMean?: number | null;
  readonly mouthSmileSd?: number | null;
  readonly browInnerUpSd?: number | null;
  readonly browDownSd?: number | null;
  readonly browOuterUpSd?: number | null;
  readonly eyeSquintSd?: number | null;
  readonly cheekSquintSd?: number | null;
  readonly jawOpenSd?: number | null;
  readonly blendshapeStatsJson?: string | null;
  readonly yawSdDeg: number;
  readonly pitchSdDeg: number;
  readonly rollSdDeg?: number | null;
  readonly angularPathDegPerMin: number;
  readonly translationSd?: number | null;
  readonly expressivityZScore?: number | null;
  readonly headMovementZScore?: number | null;
  readonly isSimulated?: boolean;
  readonly source?: string;
}

export interface CameraRepository {
  getCameraReadings(patientId: string): Promise<readonly StoredCameraReading[]>;
  saveCameraReading(reading: StoredCameraReading): Promise<void>;
}

/**
 * The real implementation must give a use case a consistent view for one patient 
 * (for example by locking that patient's row), so two requests for one patient cannot interleave.
 */
export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export interface HomeMonitoringFacts {
  readonly wearableWornLine?: string | null;
  readonly rhythmShiftLine?: string | null;
  readonly checkDoneLine?: string | null;
  readonly supportingLines: readonly string[];
}

export interface HomeMonitoringQuery {
  readonly patientId: string;
  readonly sinceDate: string;
  readonly isSilenceOrMissed?: boolean;
}

export interface HomeMonitoringRepository {
  getSupportingFacts(
    query: HomeMonitoringQuery,
    consent: ConsentState
  ): Promise<HomeMonitoringFacts>;
}

export interface Ports {
  readonly clock: Clock;
  readonly patients: PatientRepository;
  readonly rounds: RoundRepository;
  readonly phq9: Phq9Repository;
  readonly gad7?: Gad7Repository;
  readonly calls: CallRepository;
  readonly warnings: WarningRepository;
  readonly smallDips: SmallDipRepository;
  readonly crisis: CrisisRepository;
  readonly baselineNotWell: BaselineNotWellRepository;
  readonly accessLog: AccessLogRepository;
  readonly extraAnswers: ExtraAnswerRepository;
  readonly camera?: CameraRepository;
  readonly extraItemsConfig?: ExtraItemsConfig;
  readonly homeMonitoring?: HomeMonitoringRepository;
  readonly unitOfWork: UnitOfWork;
  readonly suggestions: SuggestionRepository;
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
  readonly extraItem: ExtraItem | null;
  readonly isGad7Due?: boolean;
  readonly gad7Progress?: Phq9Progress;
}

export interface SubmitTapsResult {
  readonly ruleRunNeeded: boolean;
  readonly roundNumber: number;
}

export interface SubmitExtraAnswerResult {
  readonly recorded: boolean;
}

export interface SubmitNotTodayResult {
  readonly recorded: boolean;
  readonly ruleRunNeeded: boolean;
}

export interface SubmitGad7AnswerResult {
  readonly isComplete: boolean;
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

export interface SubmitCrisisButtonResult {
  readonly saved: boolean;
  readonly showCrisisPath: true;
  readonly crisisResources: readonly CrisisResource[];
  readonly roundNumber: number;
  readonly duplicate?: boolean;
}

