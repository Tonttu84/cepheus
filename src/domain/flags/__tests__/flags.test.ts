import { describe, it, expect } from 'vitest';
import { buildFlag } from '../index';
import type { WarningEffect } from '../../warning/index';

describe('Flags', () => {
  it('builds a flag from a warning effect', () => {
    const effect: WarningEffect = { type: 'warning', kind: 'low_answers', since: '2026-11-14', version: 1 };
    const flag = buildFlag(effect)!;
    expect(flag).toEqual({ area: 'check_in', since: '2026-11-14' });
  });

  it('has exactly area and since keys', () => {
    const effect: WarningEffect = { type: 'warning', kind: 'phq9', since: '2026-11-15', version: 1 };
    const flag = buildFlag(effect)!;
    const keys = Object.keys(flag);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('area');
    expect(keys).toContain('since');
    expect(flag.area).toBe('check_in');
  });

  it('returns null if effect is not a warning', () => {
    expect(buildFlag({ type: 'small_dip', version: 1 })).toBeNull();
    expect(buildFlag({ type: 'baseline_not_well', version: 1 })).toBeNull();
  });
});
