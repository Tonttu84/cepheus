import { describe, it, expect } from 'vitest';
import { scorePhq9, validatePhq9Answers, validateTapAnswer } from '../index';

describe('Instruments', () => {
  describe('The PHQ-9', () => {
    it('has nine questions about the last two weeks', () => {
      const answers = [
        { id: '1', value: 0 },
        { id: '2', value: 1 },
        { id: '3', value: 2 },
        { id: '4', value: 3 },
        { id: '5', value: 0 },
        { id: '6', value: 1 },
        { id: '7', value: 2 },
        { id: '8', value: 3 },
        { id: '9', value: 0 }
      ];
      const result = validatePhq9Answers(answers);
      expect(result.ok).toBe(true);
    });

    it('rejects every wrongly formatted value: missing, null, undefined, a string, a non-integer, NaN, Infinity, negative, above the range', () => {
      const invalidValues = [undefined, null, '1', 1.5, NaN, Infinity, -Infinity, -1, 4];
      for (const val of invalidValues) {
        expect(validatePhq9Answers([{ id: '1', value: val }]).ok).toBe(false);
      }
      expect(validatePhq9Answers([{ id: '1' }]).ok).toBe(false); // missing value
    });

    it('rejects an unknown item id', () => {
      expect(validatePhq9Answers([{ id: 'unknown', value: 1 }]).ok).toBe(false);
      expect(validatePhq9Answers([{ id: '10', value: 1 }]).ok).toBe(false);
    });

    it('rejects a duplicated item', () => {
      expect(validatePhq9Answers([
        { id: '1', value: 1 },
        { id: '1', value: 2 }
      ]).ok).toBe(false);
    });

    it('drops extra fields in the output', () => {
      const input = [{ id: '1', value: 1, extra: 'field', unknown: true }];
      const result = validatePhq9Answers(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([{ id: '1', value: 1 }]);
        expect((result.value[0] as { extra?: unknown }).extra).toBeUndefined();
      }
    });

    it('scored 0 to 27, total of a complete set', () => {
      const answers = [
        { id: '1', value: 3 },
        { id: '2', value: 3 },
        { id: '3', value: 3 },
        { id: '4', value: 3 },
        { id: '5', value: 3 },
        { id: '6', value: 3 },
        { id: '7', value: 3 },
        { id: '8', value: 3 },
        { id: '9', value: 3 }
      ];
      expect(scorePhq9(answers)).toBe(27);
    });

    it('an incomplete set has no total', () => {
      const answers = [
        { id: '1', value: 3 }
      ];
      expect(scorePhq9(answers)).toBeNull();
    });
  });

  describe('The two taps', () => {
    it('mood and interest, each an integer 0 to 4', () => {
      expect(validateTapAnswer({ kind: 'mood', value: 0 }).ok).toBe(true);
      expect(validateTapAnswer({ kind: 'interest', value: 4 }).ok).toBe(true);
    });

    it('rejects every wrongly formatted value: missing, null, undefined, a string, a non-integer, NaN, Infinity, negative, above the range', () => {
      const invalidValues = [undefined, null, '1', 1.5, NaN, Infinity, -Infinity, -1, 5];
      for (const val of invalidValues) {
        expect(validateTapAnswer({ kind: 'mood', value: val }).ok).toBe(false);
      }
      expect(validateTapAnswer({ kind: 'mood' }).ok).toBe(false); // missing value
    });

    it('rejects unknown kinds', () => {
      expect(validateTapAnswer({ kind: 'unknown', value: 1 }).ok).toBe(false);
    });

    it('drops extra fields in the output', () => {
      const input = { kind: 'mood', value: 1, extra: 'field', unknown: true };
      const result = validateTapAnswer(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ kind: 'mood', value: 1 });
        expect((result.value as { extra?: unknown }).extra).toBeUndefined();
      }
    });
  });
});
