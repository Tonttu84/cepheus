import { describe, it, expect } from 'vitest';
import { isCrisis } from '../index';
import { PHQ9_ITEMS } from '../../instruments';

describe('Crisis', () => {
  it('true only for the self-harm item with 1, 2 or 3', () => {
    // Valid inputs for self-harm item
    expect(isCrisis({ id: '9', value: 1 })).toEqual({ ok: true, value: true });
    expect(isCrisis({ id: '9', value: 2 })).toEqual({ ok: true, value: true });
    expect(isCrisis({ id: '9', value: 3 })).toEqual({ ok: true, value: true });

    // Valid inputs that are not crisis: self-harm item with 0
    expect(isCrisis({ id: '9', value: 0 })).toEqual({ ok: true, value: false });

    // Valid inputs for all other items with 0, 1, 2, 3
    const nonSelfHarmItems = PHQ9_ITEMS.filter(item => !item.isSelfHarm);
    for (const item of nonSelfHarmItems) {
      for (let value = 0; value <= 3; value++) {
        expect(isCrisis({ id: item.id, value })).toEqual({ ok: true, value: false });
      }
    }
  });

  it('rejects invalid inputs instead of silently returning false', () => {
    // Unknown item ID
    expect(isCrisis({ id: 'unknown', value: 1 }).ok).toBe(false);
    expect(isCrisis({ id: '0', value: 1 }).ok).toBe(false);
    expect(isCrisis({ id: '10', value: 1 }).ok).toBe(false);

    // Out of range values
    expect(isCrisis({ id: '9', value: -1 }).ok).toBe(false);
    expect(isCrisis({ id: '9', value: 4 }).ok).toBe(false);
    expect(isCrisis({ id: '1', value: -1 }).ok).toBe(false);
    expect(isCrisis({ id: '1', value: 5 }).ok).toBe(false);

    // Non-integers, NaN, and infinities
    expect(isCrisis({ id: '9', value: NaN }).ok).toBe(false);
    expect(isCrisis({ id: '9', value: 1.5 }).ok).toBe(false);
    expect(isCrisis({ id: '9', value: Infinity }).ok).toBe(false);
    expect(isCrisis({ id: '9', value: -Infinity }).ok).toBe(false);
  });
});
