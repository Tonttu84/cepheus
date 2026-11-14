import type { RoundStatus } from '../rounds';
import type { RoundKind } from '../classify';
import type { Phq9BaselineValue } from '../baseline';
import type { WarningEffect } from '../warning';
import type { ClinicFlag } from '../flags';

export interface HistoryRound {
  readonly roundNumber: number;
  readonly localDate: string;
  readonly status: RoundStatus;
  readonly mood?: number;
  readonly interest?: number;
}

export interface HistoryPhq9 {
  readonly date: string;
  readonly total: number;
}

export interface HistoryGad7 {
  readonly date: string;
  readonly total: number;
}

export type QuestionnaireType = 'phq9' | 'gad7';

export type CallPosition = 'before' | 'after';

export interface HistoryCall {
  readonly date: string;
  readonly position?: CallPosition;
}

export interface PatientHistory {
  readonly rounds: readonly HistoryRound[];
  readonly phq9s?: readonly HistoryPhq9[];
  readonly gad7s?: readonly HistoryGad7[];
  readonly calls?: readonly HistoryCall[];
  readonly questionnaires?: readonly QuestionnaireType[];
}

export interface EvaluatedRound {
  readonly roundNumber: number;
  readonly localDate: string;
  readonly status: RoundStatus;
  readonly kind: RoundKind;
  readonly mood?: number;
  readonly interest?: number;
}

export type TapBaselineSummary =
  | {
      readonly exists: true;
      readonly hasBaseline: true;
      readonly mood: number;
      readonly interest: number;
      readonly roundsNeeded: 0;
      readonly answeredRoundsCount: number;
    }
  | {
      readonly exists: false;
      readonly hasBaseline: false;
      readonly mood: null;
      readonly interest: null;
      readonly roundsNeeded: number;
      readonly answeredRoundsCount: number;
    };

export interface EvaluatedEffect {
  readonly effect: WarningEffect;
  readonly type: WarningEffect['type'];
  readonly kind?: 'low_answers' | 'silence' | 'mixed' | 'phq9' | 'gad7';
  readonly since?: string;
  readonly version: number;
  readonly causedBy:
    | { readonly type: 'round'; readonly roundNumber: number; readonly date: string }
    | { readonly type: 'phq9'; readonly date: string; readonly total: number }
    | { readonly type: 'gad7'; readonly date: string; readonly total: number };
  readonly roundNumber?: number;
  readonly roundDate?: string;
  readonly phq9Date?: string;
  readonly phq9Total?: number;
  readonly gad7Date?: string;
  readonly gad7Total?: number;
}

export interface WarningCurrentState {
  readonly isWarningWaitingForCall: boolean;
  readonly waitingForCall: boolean;
  readonly since: string | null;
}

export interface HistoryEvaluation {
  readonly configVersion: number;
  readonly rounds: readonly EvaluatedRound[];
  readonly tapBaseline: TapBaselineSummary;
  readonly phq9Baseline: Phq9BaselineValue;
  readonly effects: readonly EvaluatedEffect[];
  readonly currentState: WarningCurrentState;
  readonly flags: readonly ClinicFlag[];
}

export type EvaluateHistoryResult =
  | { readonly ok: true; readonly value: HistoryEvaluation }
  | { readonly ok: false; readonly error: string };
