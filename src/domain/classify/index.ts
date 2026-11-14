import { RuleConfig } from '../config';

export type RoundAnswer = 
  | { status: 'answered'; mood: number; interest: number }
  | { status: 'missed' }
  | { status: 'not_today' };

export type RoundKind = 'normal' | 'low' | 'no_answer';

export interface Baselines {
  mood: number;
  interest: number;
}

export function classifyRound(answer: RoundAnswer, config: RuleConfig, baselines?: Baselines): { ok: true; value: RoundKind } | { ok: false; error: string } {
  if (answer.status === 'missed' || answer.status === 'not_today') {
    return { ok: true, value: 'no_answer' };
  }

  if (typeof answer.mood !== 'number' || !Number.isInteger(answer.mood) || answer.mood < 0 || answer.mood > 4) {
    return { ok: false, error: 'invalid mood' };
  }
  if (typeof answer.interest !== 'number' || !Number.isInteger(answer.interest) || answer.interest < 0 || answer.interest > 4) {
    return { ok: false, error: 'invalid interest' };
  }

  if (answer.mood === config.bottomOptionScore || answer.interest === config.bottomOptionScore) {
    return { ok: true, value: 'low' };
  }

  if (baselines) {
    const moodDiff = baselines.mood - answer.mood;
    const interestDiff = baselines.interest - answer.interest;

    if (moodDiff >= config.tapDropOne || interestDiff >= config.tapDropOne) {
      return { ok: true, value: 'low' };
    }

    if (moodDiff >= config.tapDropBoth && interestDiff >= config.tapDropBoth) {
      return { ok: true, value: 'low' };
    }
  }

  return { ok: true, value: 'normal' };
}
