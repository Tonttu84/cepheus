import { describe, it, expect } from 'vitest';
import {
  GAD7_ITEMS,
  scoreGad7,
  validateGad7Answers,
  type Gad7Answer,
} from '../gad7';

describe('The GAD-7 Instrument', () => {
  const validCompleteAnswers: Gad7Answer[] = [
    { id: '1', value: 0 },
    { id: '2', value: 1 },
    { id: '3', value: 2 },
    { id: '4', value: 3 },
    { id: '5', value: 1 },
    { id: '6', value: 2 },
    { id: '7', value: 0 },
  ];

  describe('Item structure', () => {
    it('has seven items and none of them is a self-harm item', () => {
      expect(GAD7_ITEMS).toHaveLength(7);
      // Unlike the PHQ-9, the GAD-7 has no self-harm item, so nothing here raises the crisis path
      GAD7_ITEMS.forEach((item) => {
        expect(item.isSelfHarm).toBe(false);
        expect(item.min).toBe(0);
        expect(item.max).toBe(3);
      });
    });
  });

  describe('Validation', () => {
    it('accepts a valid set of exactly seven whole numbers 0 to 3', () => {
      const result = validateGad7Answers(validCompleteAnswers);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validCompleteAnswers);
      }
    });

    it('refuses non-array inputs with an explicit error, not thrown', () => {
      const invalidInputs = [null, undefined, 'answers', 123, {}, true];
      for (const input of invalidInputs) {
        const result = validateGad7Answers(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(typeof result.error).toBe('string');
        }
      }
    });

    it('refuses missing answers (fewer than seven) with an explicit error', () => {
      expect(validateGad7Answers([]).ok).toBe(false);
      expect(validateGad7Answers([{ id: '1', value: 1 }]).ok).toBe(false);
      expect(validateGad7Answers(validCompleteAnswers.slice(0, 6)).ok).toBe(false);
    });

    it('refuses extra answers (more than seven) with an explicit error', () => {
      const extraAnswers = [
        ...validCompleteAnswers,
        { id: '7', value: 2 },
      ];
      expect(validateGad7Answers(extraAnswers).ok).toBe(false);
    });

    it('refuses unknown item ids with an explicit error', () => {
      const answersWithUnknown = [
        { id: '1', value: 0 },
        { id: '2', value: 1 },
        { id: '3', value: 2 },
        { id: '4', value: 3 },
        { id: '5', value: 1 },
        { id: '6', value: 2 },
        { id: '8', value: 0 }, // unknown id '8'
      ];
      const result = validateGad7Answers(answersWithUnknown);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/unknown/i);
      }
    });

    it('refuses duplicated items with an explicit error', () => {
      const answersWithDuplicate = [
        { id: '1', value: 0 },
        { id: '2', value: 1 },
        { id: '3', value: 2 },
        { id: '4', value: 3 },
        { id: '5', value: 1 },
        { id: '6', value: 2 },
        { id: '1', value: 0 }, // duplicated id '1'
      ];
      const result = validateGad7Answers(answersWithDuplicate);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/duplicate/i);
      }
    });

    it('refuses missing values with an explicit error', () => {
      const answersWithMissing = [
        { id: '1' },
        { id: '2', value: 1 },
        { id: '3', value: 2 },
        { id: '4', value: 3 },
        { id: '5', value: 1 },
        { id: '6', value: 2 },
        { id: '7', value: 0 },
      ];
      expect(validateGad7Answers(answersWithMissing).ok).toBe(false);
    });

    it('refuses non-number values: null, undefined, strings, booleans, objects', () => {
      const invalidValues = [null, undefined, '1', true, false, {}];
      for (const val of invalidValues) {
        const answers = [
          { id: '1', value: val },
          { id: '2', value: 1 },
          { id: '3', value: 2 },
          { id: '4', value: 3 },
          { id: '5', value: 1 },
          { id: '6', value: 2 },
          { id: '7', value: 0 },
        ];
        const res = validateGad7Answers(answers);
        expect(res.ok).toBe(false);
      }
    });

    it('refuses non-finite numbers: NaN, Infinity, -Infinity', () => {
      const invalidNumbers = [NaN, Infinity, -Infinity];
      for (const val of invalidNumbers) {
        const answers = [
          { id: '1', value: val },
          { id: '2', value: 1 },
          { id: '3', value: 2 },
          { id: '4', value: 3 },
          { id: '5', value: 1 },
          { id: '6', value: 2 },
          { id: '7', value: 0 },
        ];
        const res = validateGad7Answers(answers);
        expect(res.ok).toBe(false);
      }
    });

    it('refuses fractional numbers with an explicit error', () => {
      const fractions = [0.5, 1.2, 2.99, 1.0001];
      for (const val of fractions) {
        const answers = [
          { id: '1', value: val },
          { id: '2', value: 1 },
          { id: '3', value: 2 },
          { id: '4', value: 3 },
          { id: '5', value: 1 },
          { id: '6', value: 2 },
          { id: '7', value: 0 },
        ];
        const res = validateGad7Answers(answers);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/integer/i);
        }
      }
    });

    it('refuses negative numbers with an explicit error', () => {
      const negatives = [-1, -2, -10];
      for (const val of negatives) {
        const answers = [
          { id: '1', value: val },
          { id: '2', value: 1 },
          { id: '3', value: 2 },
          { id: '4', value: 3 },
          { id: '5', value: 1 },
          { id: '6', value: 2 },
          { id: '7', value: 0 },
        ];
        const res = validateGad7Answers(answers);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/range/i);
        }
      }
    });

    it('refuses out-of-range numbers above 3 with an explicit error', () => {
      const outOfRange = [4, 5, 10, 100];
      for (const val of outOfRange) {
        const answers = [
          { id: '1', value: val },
          { id: '2', value: 1 },
          { id: '3', value: 2 },
          { id: '4', value: 3 },
          { id: '5', value: 1 },
          { id: '6', value: 2 },
          { id: '7', value: 0 },
        ];
        const res = validateGad7Answers(answers);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/range/i);
        }
      }
    });

    it('drops extra fields in the output objects', () => {
      const input = [
        { id: '1', value: 0, extra: 'dropped', clientTime: 123 },
        { id: '2', value: 1 },
        { id: '3', value: 2 },
        { id: '4', value: 3 },
        { id: '5', value: 1 },
        { id: '6', value: 2 },
        { id: '7', value: 0 },
      ];
      const result = validateGad7Answers(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0]).toEqual({ id: '1', value: 0 });
        expect((result.value[0] as { extra?: unknown }).extra).toBeUndefined();
      }
    });
  });

  describe('Scoring and Totalling', () => {
    it('computes total for all-zero answers (score = 0)', () => {
      const allZero: Gad7Answer[] = [
        { id: '1', value: 0 },
        { id: '2', value: 0 },
        { id: '3', value: 0 },
        { id: '4', value: 0 },
        { id: '5', value: 0 },
        { id: '6', value: 0 },
        { id: '7', value: 0 },
      ];
      expect(scoreGad7(allZero)).toBe(0);
    });

    it('computes total for all-three answers (score = 21)', () => {
      const allThree: Gad7Answer[] = [
        { id: '1', value: 3 },
        { id: '2', value: 3 },
        { id: '3', value: 3 },
        { id: '4', value: 3 },
        { id: '5', value: 3 },
        { id: '6', value: 3 },
        { id: '7', value: 3 },
      ];
      expect(scoreGad7(allThree)).toBe(21);
    });

    it('computes total for a mixed set of answers', () => {
      // 0 + 1 + 2 + 3 + 1 + 2 + 0 = 9
      expect(scoreGad7(validCompleteAnswers)).toBe(9);

      // 1 + 2 + 1 + 2 + 1 + 2 + 1 = 10 (clinical cut-off)
      const mixedTen: Gad7Answer[] = [
        { id: '1', value: 1 },
        { id: '2', value: 2 },
        { id: '3', value: 1 },
        { id: '4', value: 2 },
        { id: '5', value: 1 },
        { id: '6', value: 2 },
        { id: '7', value: 1 },
      ];
      expect(scoreGad7(mixedTen)).toBe(10);
    });

    it('returns null for incomplete or invalid answer sets', () => {
      expect(scoreGad7([])).toBeNull();
      expect(scoreGad7(validCompleteAnswers.slice(0, 6))).toBeNull();
      expect(scoreGad7(null as unknown as Gad7Answer[])).toBeNull();
      expect(scoreGad7([{ id: '1', value: 4 }])).toBeNull();
    });
  });

  describe('Purity', () => {
    it('functions are pure: same input produces same output', () => {
      const out1 = validateGad7Answers(validCompleteAnswers);
      const out2 = validateGad7Answers(validCompleteAnswers);
      expect(out1).toEqual(out2);

      const score1 = scoreGad7(validCompleteAnswers);
      const score2 = scoreGad7(validCompleteAnswers);
      expect(score1).toBe(score2);
    });

    it('functions are pure: input arrays and objects are never mutated', () => {
      const frozenInput = Object.freeze(
        validCompleteAnswers.map((a) => Object.freeze({ ...a }))
      );

      // Should not throw attempting to mutate frozen objects
      const result = validateGad7Answers(frozenInput);
      expect(result.ok).toBe(true);

      const total = scoreGad7(frozenInput);
      expect(total).toBe(9);

      // Verify original input matches
      expect(frozenInput).toEqual(validCompleteAnswers);
    });
  });
});
