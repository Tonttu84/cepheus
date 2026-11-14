import { RuleConfig } from '../config';

export type Phq9BaselineValue = { type: 'baseline'; value: number } | { type: 'not_well' } | null;
export type Phq9BaselineResult = { ok: true; value: Phq9BaselineValue } | { ok: false; error: string };

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
