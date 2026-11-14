import { describe, it, expect } from 'vitest';
import { calculateTapBaseline, calculateTapBaselines, calculatePhq9Baseline } from '../index';
import { DEFAULT_RULE_CONFIG } from '../../config';

describe('Baseline', () => {
  describe('Tap baselines summary', () => {
    it('returns how many answered rounds are still needed when fewer than required', () => {
      const answers = [
        { mood: 4, interest: 4 },
        { mood: null, interest: null },
        { mood: 3, interest: 3 },
      ];
      const res = calculateTapBaselines(answers, DEFAULT_RULE_CONFIG);
      expect(res).toEqual({
        ok: true,
        exists: false,
        hasBaseline: false,
        mood: null,
        interest: null,
        roundsNeeded: 6,
        answeredRoundsCount: 2,
        requiredRounds: 8,
      });
    });

    it('returns baselines when required answered rounds are reached', () => {
      const answers = [
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 2, interest: 2 },
        { mood: 2, interest: 2 },
        { mood: 2, interest: 2 },
        { mood: 2, interest: 2 },
      ];
      const res = calculateTapBaselines(answers, DEFAULT_RULE_CONFIG);
      expect(res).toEqual({
        ok: true,
        exists: true,
        hasBaseline: true,
        mood: 3,
        interest: 3,
        roundsNeeded: 0,
        answeredRoundsCount: 8,
        requiredRounds: 8,
      });
    });

    it('ignores unanswered rounds and later rounds do not change the baseline', () => {
      const answers = [
        { mood: 4, interest: 4 },
        { mood: null, interest: null },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 },
        { mood: 4, interest: 4 }, // 8th answered round
        { mood: 0, interest: 0 }, // 9th answered round (should not change baseline)
      ];
      const res = calculateTapBaselines(answers, DEFAULT_RULE_CONFIG);
      expect(res).toEqual({
        ok: true,
        exists: true,
        hasBaseline: true,
        mood: 4,
        interest: 4,
        roundsNeeded: 0,
        answeredRoundsCount: 9,
        requiredRounds: 8,
      });
    });

    it('refuses invalid scores', () => {
      expect(calculateTapBaselines([{ mood: -1, interest: 2 }], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculateTapBaselines([{ mood: 5, interest: 2 }], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculateTapBaselines([{ mood: 2, interest: 2.5 }], DEFAULT_RULE_CONFIG).ok).toBe(false);
    });
  });

  describe('Tap baseline', () => {
    it('median of the person\'s first eight answered rounds', () => {
      const answers = [3, 1, 4, 1, 5, 9, 2, 6].map(x => (x > 4 ? 4 : x)); 
      expect(calculateTapBaseline(answers, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 3.5 });
    });

    it('Rounds with no answer do not count toward the eight', () => {
      const answers = [3, null, 1, 4, null, 1, 4, 4, 2, 4];
      expect(calculateTapBaseline(answers, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 3.5 });
    });

    it('Fewer than eight: no baseline', () => {
      const answers = [3, 1, 4, 1, 4, 4, 2];
      expect(calculateTapBaseline(answers, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: null });
    });

    it('Later rounds never change it', () => {
      const answers = [3, 1, 4, 1, 4, 4, 2, 4, 0, 0, 0, 0];
      expect(calculateTapBaseline(answers, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 3.5 });
    });

    it('A median of eight values can end in .5; keep it', () => {
      const answers = [1, 2, 3, 4, 1, 2, 3, 4];
      expect(calculateTapBaseline(answers, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 2.5 });
    });

    it('a baseline of exactly seven and exactly eight answered rounds', () => {
      expect(calculateTapBaseline([1, 1, 1, 1, 1, 1, 1], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: null });
      expect(calculateTapBaseline([1, 1, 1, 1, 1, 1, 1, 1], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 1 });
    });
    
    it('unanswered rounds between answered ones', () => {
      expect(calculateTapBaseline([null, 1, null, 1, 1, 1, 1, null, 1, 1, 1], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 1 });
    });

    it('a person whose baseline is at or near the bottom of the scale', () => {
      expect(calculateTapBaseline([0, 0, 0, 0, 0, 0, 0, 0], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 0 });
      expect(calculateTapBaseline([0, 1, 0, 1, 0, 1, 0, 1], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: 0.5 });
    });

    it('invalid values give errors', () => {
      expect(calculateTapBaseline([0, NaN, 1, 2, 3, 4, 4, 4], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculateTapBaseline([0, -1, 1, 2, 3, 4, 4, 4], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculateTapBaseline([0, 5, 1, 2, 3, 4, 4, 4], DEFAULT_RULE_CONFIG).ok).toBe(false);
    });
  });

  describe('PHQ-9 baseline', () => {
    it('the first complete PHQ-9', () => {
      const scores = [null, 6, 8];
      expect(calculatePhq9Baseline(scores, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'baseline', value: 6 } });
    });

    it('If it is 10 or more, the result says so ("not at a well baseline") and there is no PHQ-9 baseline to compare against', () => {
      const scores = [null, 10, 5];
      expect(calculatePhq9Baseline(scores, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'not_well' } });
      
      const scores2 = [15, 5];
      expect(calculatePhq9Baseline(scores2, DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'not_well' } });
    });
    
    it('no complete PHQ-9 gives null', () => {
      expect(calculatePhq9Baseline([], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: null });
      expect(calculatePhq9Baseline([null, null], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: null });
    });

    it('the PHQ-9 at 9, at 10', () => {
      expect(calculatePhq9Baseline([9], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'baseline', value: 9 } });
      expect(calculatePhq9Baseline([10], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'not_well' } });
    });

    it('the PHQ-9 at 9, 10, baseline plus 5 and plus 6, with a baseline of 0 and of 9', () => {
      // Tested more comprehensively in warning, but these function bounds:
      expect(calculatePhq9Baseline([0], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'baseline', value: 0 } });
      expect(calculatePhq9Baseline([9], DEFAULT_RULE_CONFIG)).toEqual({ ok: true, value: { type: 'baseline', value: 9 } });
    });

    it('invalid totals give errors (NaN, negatives, non-integers, above 27)', () => {
      expect(calculatePhq9Baseline([NaN], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([-1], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([1.5], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([28], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([null, NaN, 5], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([null, -5], DEFAULT_RULE_CONFIG).ok).toBe(false);
      expect(calculatePhq9Baseline([null, 30], DEFAULT_RULE_CONFIG).ok).toBe(false);
    });
  });
});
