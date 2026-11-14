import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTRA_ITEMS_CONFIG,
  EXTRA_ITEMS,
  getExtraItemById,
  getOfferedExtraItem,
  validateExtraAnswer,
  type ExtraItemsConfig,
} from '../index';

describe('Domain: extra-items', () => {
  describe('item set definitions', () => {
    it('has exactly three items with stable ids, topic keys, questions, 0..4 range and end labels', () => {
      expect(EXTRA_ITEMS).toHaveLength(3);

      const [sleep, energy, gettingOut] = EXTRA_ITEMS;

      expect(sleep.id).toBe('extra_sleep');
      expect(sleep.topicKey).toBe('sleep');
      expect(sleep.question).toBe('How well did you sleep last night?');
      expect(sleep.min).toBe(0);
      expect(sleep.max).toBe(4);
      expect(sleep.minLabel).toBe('very badly');
      expect(sleep.maxLabel).toBe('very well');

      expect(energy.id).toBe('extra_energy');
      expect(energy.topicKey).toBe('energy');
      expect(energy.question).toBe('How much energy do you have right now?');
      expect(energy.min).toBe(0);
      expect(energy.max).toBe(4);
      expect(energy.minLabel).toBe('none');
      expect(energy.maxLabel).toBe('a lot');

      expect(gettingOut.id).toBe('extra_getting_out');
      expect(gettingOut.topicKey).toBe('getting_out');
      expect(gettingOut.question).toBe('Have you been outside your home today?');
      expect(gettingOut.min).toBe(0);
      expect(gettingOut.max).toBe(4);
      expect(gettingOut.minLabel).toBe('not at all');
      expect(gettingOut.maxLabel).toBe('a lot');
    });

    it('marks every item in data as experimental, team wording, and not a validated instrument', () => {
      for (const item of EXTRA_ITEMS) {
        expect(item.isExperimental).toBe(true);
        expect(item.validatedInstrument).toBe(false);
        expect(item.wording).toBe('team');
        expect(item.isSelfHarm).toBe(false);
      }
    });

    it('contains no forbidden privacy keys on items (total, score, kind, baseline, warning, flag)', () => {
      const forbidden = ['total', 'score', 'kind', 'roundkind', 'baseline', 'warning', 'flag'];
      for (const item of EXTRA_ITEMS) {
        for (const key of Object.keys(item)) {
          expect(forbidden).not.toContain(key.toLowerCase());
        }
      }
    });

    it('can look up items by id', () => {
      expect(getExtraItemById('extra_sleep')?.topicKey).toBe('sleep');
      expect(getExtraItemById('extra_energy')?.topicKey).toBe('energy');
      expect(getExtraItemById('non_existent')).toBeNull();
    });
  });

  describe('configuration', () => {
    it('has default configuration disabled by default with version 1', () => {
      expect(DEFAULT_EXTRA_ITEMS_CONFIG.version).toBe(1);
      expect(DEFAULT_EXTRA_ITEMS_CONFIG.enabled).toBe(false);
      expect(DEFAULT_EXTRA_ITEMS_CONFIG.items).toEqual(EXTRA_ITEMS);
    });
  });

  describe('rotation logic', () => {
    const enabledConfig: ExtraItemsConfig = {
      version: 1,
      enabled: true,
      items: EXTRA_ITEMS,
    };

    it('returns null when feature is disabled', () => {
      const disabledConfig: ExtraItemsConfig = {
        ...enabledConfig,
        enabled: false,
      };
      for (let r = 1; r <= 20; r++) {
        expect(getOfferedExtraItem(r, disabledConfig)).toBeNull();
      }
    });

    it('returns null on PHQ-9 rounds (rounds 1, 5, 9, 13, ...)', () => {
      const phq9Rounds = [1, 5, 9, 13, 17, 21];
      for (const r of phq9Rounds) {
        expect(getOfferedExtraItem(r, enabledConfig)).toBeNull();
      }
    });

    it('returns null for non-positive round numbers', () => {
      expect(getOfferedExtraItem(0, enabledConfig)).toBeNull();
      expect(getOfferedExtraItem(-1, enabledConfig)).toBeNull();
    });

    it('rotates items in fixed sequence across non-PHQ-9 rounds', () => {
      // Non-PHQ-9 rounds:
      // Round 2 -> sleep (index 0)
      // Round 3 -> energy (index 1)
      // Round 4 -> getting_out (index 2)
      // Round 5 -> null (PHQ-9)
      // Round 6 -> sleep (index 0)
      // Round 7 -> energy (index 1)
      // Round 8 -> getting_out (index 2)
      // Round 9 -> null (PHQ-9)
      // Round 10 -> sleep (index 0)
      // Round 11 -> energy (index 1)
      // Round 12 -> getting_out (index 2)
      expect(getOfferedExtraItem(2, enabledConfig)?.id).toBe('extra_sleep');
      expect(getOfferedExtraItem(3, enabledConfig)?.id).toBe('extra_energy');
      expect(getOfferedExtraItem(4, enabledConfig)?.id).toBe('extra_getting_out');
      expect(getOfferedExtraItem(5, enabledConfig)).toBeNull();
      expect(getOfferedExtraItem(6, enabledConfig)?.id).toBe('extra_sleep');
      expect(getOfferedExtraItem(7, enabledConfig)?.id).toBe('extra_energy');
      expect(getOfferedExtraItem(8, enabledConfig)?.id).toBe('extra_getting_out');
      expect(getOfferedExtraItem(9, enabledConfig)).toBeNull();
      expect(getOfferedExtraItem(10, enabledConfig)?.id).toBe('extra_sleep');
      expect(getOfferedExtraItem(11, enabledConfig)?.id).toBe('extra_energy');
      expect(getOfferedExtraItem(12, enabledConfig)?.id).toBe('extra_getting_out');
    });

    it('is reproducible: every patient on the same round number receives the exact same item', () => {
      for (let r = 1; r <= 30; r++) {
        const item1 = getOfferedExtraItem(r, enabledConfig);
        const item2 = getOfferedExtraItem(r, enabledConfig);
        expect(item1?.id).toBe(item2?.id);
      }
    });
  });

  describe('answer validation', () => {
    const sleepItem = EXTRA_ITEMS[0];

    it('accepts integer values from 0 to 4 for the offered item', () => {
      for (let v = 0; v <= 4; v++) {
        const res = validateExtraAnswer({ itemId: 'extra_sleep', value: v }, sleepItem);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.value).toEqual({ itemId: 'extra_sleep', value: v });
        }
      }
    });

    it('rejects values outside 0 to 4', () => {
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: -1 }, sleepItem).ok).toBe(false);
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: 5 }, sleepItem).ok).toBe(false);
    });

    it('rejects non-integer numbers, NaN, null, and non-numeric values', () => {
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: 2.5 }, sleepItem).ok).toBe(false);
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: NaN }, sleepItem).ok).toBe(false);
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: '3' }, sleepItem).ok).toBe(false);
      expect(validateExtraAnswer({ itemId: 'extra_sleep', value: null }, sleepItem).ok).toBe(false);
      expect(validateExtraAnswer(null, sleepItem).ok).toBe(false);
    });

    it('rejects an answer when the item does not match the offered item', () => {
      const res = validateExtraAnswer({ itemId: 'extra_energy', value: 2 }, sleepItem);
      expect(res.ok).toBe(false);
    });

    it('rejects when no item is offered for the round', () => {
      const res = validateExtraAnswer({ itemId: 'extra_sleep', value: 2 }, null);
      expect(res.ok).toBe(false);
    });
  });
});
