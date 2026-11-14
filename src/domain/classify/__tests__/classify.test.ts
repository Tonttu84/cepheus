import { describe, it, expect } from 'vitest';
import { classifyRound } from '../index';
import type { RoundAnswer } from '../index';
import { DEFAULT_RULE_CONFIG } from '../../config';

describe('Classify', () => {
  describe('Each round is one of three kinds', () => {
    it('Normal: Answered, and not low', () => {
      const answer: RoundAnswer = { status: 'answered', mood: 4, interest: 4 };
      expect(classifyRound(answer, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'normal' });
      
      const answer2: RoundAnswer = { status: 'answered', mood: 1, interest: 1 };
      expect(classifyRound(answer2, DEFAULT_RULE_CONFIG, { mood: 1, interest: 1 })).toEqual({ ok: true, value: 'normal' });
    });

    it('Low: Either tap at its bottom option; applies with or without a baseline', () => {
      expect(classifyRound({ status: 'answered', mood: 0, interest: 4 }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 4, interest: 0 }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 0, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 0, interest: 0 })).toEqual({ ok: true, value: 'low' });
    });

    it('Low: once a baseline exists, mood or interest at least 2 points under the person\'s baseline', () => {
      expect(classifyRound({ status: 'answered', mood: 2, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 4, interest: 1 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 3 })).toEqual({ ok: true, value: 'low' });
      // Just 1 point under is normal if the other is not under
      expect(classifyRound({ status: 'answered', mood: 3, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'normal' });
    });

    it('Low: both at least 1 point under', () => {
      expect(classifyRound({ status: 'answered', mood: 3, interest: 3 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 2, interest: 3 }, DEFAULT_RULE_CONFIG, { mood: 3, interest: 4 })).toEqual({ ok: true, value: 'low' });
    });

    it('No answer: Missed, or "Not today"', () => {
      expect(classifyRound({ status: 'missed' }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'no_answer' });
      expect(classifyRound({ status: 'not_today' }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'no_answer' });
    });

    it('missed and not_today both give no_answer', () => {
      expect(classifyRound({ status: 'missed' }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'no_answer' });
      expect(classifyRound({ status: 'not_today' }, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 'no_answer' });
    });
  });

  describe('Boundary tests and invalid values', () => {
    it('exactly 2 under and 1.5 under for one tap', () => {
      expect(classifyRound({ status: 'answered', mood: 2, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 2, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 3.5, interest: 4 })).toEqual({ ok: true, value: 'normal' });
    });

    it('exactly 1 under on both and 1 under on one only', () => {
      expect(classifyRound({ status: 'answered', mood: 3, interest: 3 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 3, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'normal' });
    });

    it('a baseline ending in .5', () => {
      expect(classifyRound({ status: 'answered', mood: 2, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4.5, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 3, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4.5, interest: 4 })).toEqual({ ok: true, value: 'normal' });
    });

    it('a baseline of 0, 1 and 4', () => {
      expect(classifyRound({ status: 'answered', mood: 0, interest: 0 }, DEFAULT_RULE_CONFIG, { mood: 0, interest: 0 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 1, interest: 1 }, DEFAULT_RULE_CONFIG, { mood: 1, interest: 1 })).toEqual({ ok: true, value: 'normal' });
      expect(classifyRound({ status: 'answered', mood: 4, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'normal' });
    });

    it('score 0 with a baseline of 0', () => {
      expect(classifyRound({ status: 'answered', mood: 0, interest: 4 }, DEFAULT_RULE_CONFIG, { mood: 0, interest: 4 })).toEqual({ ok: true, value: 'low' });
    });

    it('invalid values', () => {
      const invalidMoods = [null, undefined, '2', 2.5, NaN, Infinity, -1, 5] as unknown[];
      for (const val of invalidMoods) {
        // @ts-expect-error testing invalid values
        expect(classifyRound({ status: 'answered', mood: val, interest: 4 }, DEFAULT_RULE_CONFIG).ok).toBe(false);
      }
    });

    it('uses configured tapDropOne and tapDropBoth', () => {
      const customConfig = {
        ...DEFAULT_RULE_CONFIG,
        tapDropOne: 3,
        tapDropBoth: 2,
      };
      expect(classifyRound({ status: 'answered', mood: 2, interest: 4 }, customConfig, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'normal' });
      expect(classifyRound({ status: 'answered', mood: 1, interest: 4 }, customConfig, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
      expect(classifyRound({ status: 'answered', mood: 3, interest: 3 }, customConfig, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'normal' });
      expect(classifyRound({ status: 'answered', mood: 2, interest: 2 }, customConfig, { mood: 4, interest: 4 })).toEqual({ ok: true, value: 'low' });
    });
  });
});
