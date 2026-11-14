import { RuleConfig } from '../config';

export type Phq9BaselineValue = { type: 'baseline'; value: number } | { type: 'not_well' } | null;
export type Phq9BaselineResult = { ok: true; value: Phq9BaselineValue } | { ok: false; error: string };

export interface TapPairAnswer {
  readonly mood?: number | null;
  readonly interest?: number | null;
}

export type TapBaselinesResult =
  | {
      readonly ok: true;
      readonly exists: true;
      readonly hasBaseline: true;
      readonly mood: number;
      readonly interest: number;
      readonly roundsNeeded: 0;
      readonly answeredRoundsCount: number;
      readonly requiredRounds: number;
    }
  | {
      readonly ok: true;
      readonly exists: false;
      readonly hasBaseline: false;
      readonly mood: null;
      readonly interest: null;
      readonly roundsNeeded: number;
      readonly answeredRoundsCount: number;
      readonly requiredRounds: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export function calculateTapBaselines(
  answers: readonly TapPairAnswer[],
  config: RuleConfig
): TapBaselinesResult {
  const validPairs: { mood: number; interest: number }[] = [];

  for (const a of answers) {
    const hasMood = a.mood !== null && a.mood !== undefined;
    const hasInterest = a.interest !== null && a.interest !== undefined;

    if (!hasMood && !hasInterest) {
      continue;
    }

    if (!hasMood || !hasInterest) {
      return { ok: false, error: 'invalid tap answer' };
    }

    if (
      typeof a.mood !== 'number' ||
      !Number.isInteger(a.mood) ||
      a.mood < 0 ||
      a.mood > 4 ||
      typeof a.interest !== 'number' ||
      !Number.isInteger(a.interest) ||
      a.interest < 0 ||
      a.interest > 4
    ) {
      return { ok: false, error: 'invalid tap answer' };
    }

    validPairs.push({ mood: a.mood, interest: a.interest });
  }

  const answeredRoundsCount = validPairs.length;
  const requiredRounds = config.tapBaselineRequiredRounds;

  if (answeredRoundsCount < requiredRounds) {
    return {
      ok: true,
      exists: false,
      hasBaseline: false,
      mood: null,
      interest: null,
      roundsNeeded: requiredRounds - answeredRoundsCount,
      answeredRoundsCount,
      requiredRounds,
    };
  }

  const firstRequired = validPairs.slice(0, requiredRounds);
  const moodValues = firstRequired.map((p) => p.mood).sort((a, b) => a - b);
  const interestValues = firstRequired.map((p) => p.interest).sort((a, b) => a - b);

  const mid1 = Math.floor((requiredRounds - 1) / 2);
  const mid2 = Math.ceil((requiredRounds - 1) / 2);

  const mood = (moodValues[mid1] + moodValues[mid2]) / 2;
  const interest = (interestValues[mid1] + interestValues[mid2]) / 2;

  return {
    ok: true,
    exists: true,
    hasBaseline: true,
    mood,
    interest,
    roundsNeeded: 0,
    answeredRoundsCount,
    requiredRounds,
  };
}

export function calculateTapBaseline(answers: (number | null)[], config: RuleConfig): { ok: true; value: number | null } | { ok: false; error: string } {
  const validAnswers: number[] = [];
  for (const a of answers) {
    if (a !== null) {
      if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a > 4) {
        return { ok: false, error: 'invalid tap answer' };
      }
      validAnswers.push(a);
    }
  }

  if (validAnswers.length < config.tapBaselineRequiredRounds) return { ok: true, value: null };
  const firstRequired = validAnswers.slice(0, config.tapBaselineRequiredRounds);
  firstRequired.sort((a, b) => a - b);
  
  const mid1 = Math.floor((config.tapBaselineRequiredRounds - 1) / 2);
  const mid2 = Math.ceil((config.tapBaselineRequiredRounds - 1) / 2);
  return { ok: true, value: (firstRequired[mid1] + firstRequired[mid2]) / 2 };
}

export function calculatePhq9Baseline(scores: (number | null)[], config: RuleConfig): Phq9BaselineResult {
  for (const s of scores) {
    if (s !== null) {
      if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 27) {
        return { ok: false, error: 'invalid phq9 total' };
      }
    }
  }

  const firstComplete = scores.find((s): s is number => s !== null);
  if (firstComplete === undefined) return { ok: true, value: null };
  if (firstComplete >= config.phq9NotWellCutoff) return { ok: true, value: { type: 'not_well' } };
  return { ok: true, value: { type: 'baseline', value: firstComplete } };
}
