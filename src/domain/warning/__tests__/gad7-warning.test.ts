import { describe, it, expect } from 'vitest';
import {
  processWarningEvent,
  INITIAL_WARNING_STATE,
  foldWarningEvents,
  type WarningEvent,
} from '../index';
import { DEFAULT_RULE_CONFIG, type RuleConfig } from '../../config';

describe('GAD-7 Warning Rule', () => {
  it('threshold edge: 9 raises no warning, 10 raises warning', () => {
    const state = INITIAL_WARNING_STATE;

    // GAD-7 total 9: under threshold (default 10)
    const event9: WarningEvent = { type: 'gad7_completed', total: 9, date: '2026-01-15' };
    const res9 = processWarningEvent(state, event9, DEFAULT_RULE_CONFIG);
    expect(res9.ok).toBe(true);
    if (res9.ok) {
      expect(res9.effects).toEqual([]);
      expect(res9.newState.activeWarning).toBe(false);
    }

    // GAD-7 total 10: at threshold (default 10)
    const event10: WarningEvent = { type: 'gad7_completed', total: 10, date: '2026-01-15' };
    const res10 = processWarningEvent(state, event10, DEFAULT_RULE_CONFIG);
    expect(res10.ok).toBe(true);
    if (res10.ok) {
      expect(res10.effects).toEqual([
        {
          type: 'warning',
          kind: 'gad7',
          since: '2026-01-15',
          version: DEFAULT_RULE_CONFIG.version,
        },
      ]);
      expect(res10.newState.activeWarning).toBe(true);
    }
  });

  it('configurable threshold: custom gad7WarningCutoff is respected', () => {
    const customConfig: RuleConfig = {
      ...DEFAULT_RULE_CONFIG,
      gad7WarningCutoff: 12,
    };
    const state = INITIAL_WARNING_STATE;

    // 10 is under custom cutoff 12 -> no warning
    const res10 = processWarningEvent(state, { type: 'gad7_completed', total: 10, date: '2026-01-15' }, customConfig);
    expect(res10.ok).toBe(true);
    if (res10.ok) {
      expect(res10.effects).toEqual([]);
    }

    // 12 is at custom cutoff 12 -> warning
    const res12 = processWarningEvent(state, { type: 'gad7_completed', total: 12, date: '2026-01-15' }, customConfig);
    expect(res12.ok).toBe(true);
    if (res12.ok) {
      expect(res12.effects).toHaveLength(1);
      expect(res12.effects[0]).toEqual({
        type: 'warning',
        kind: 'gad7',
        since: '2026-01-15',
        version: customConfig.version,
      });
    }
  });

  it('repeats: while warning is active, a subsequent GAD-7 >= 10 does not raise a new warning', () => {
    const events: WarningEvent[] = [
      { type: 'gad7_completed', total: 11, date: '2026-01-15' },
      { type: 'gad7_completed', total: 14, date: '2026-01-29' },
    ];
    const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.effects).toHaveLength(1);
      expect(res.effects[0].effect).toEqual({
        type: 'warning',
        kind: 'gad7',
        since: '2026-01-15',
        version: DEFAULT_RULE_CONFIG.version,
      });
    }
  });

  it('a call recorded clears active warning, allowing subsequent GAD-7 >= 10 to warn again', () => {
    const events: WarningEvent[] = [
      { type: 'gad7_completed', total: 11, date: '2026-01-15' },
      { type: 'call_recorded' },
      { type: 'gad7_completed', total: 13, date: '2026-01-29' },
    ];
    const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const warnings = res.effects.filter((e) => e.effect.type === 'warning');
      expect(warnings).toHaveLength(2);
      expect(warnings[0].effect).toEqual({
        type: 'warning',
        kind: 'gad7',
        since: '2026-01-15',
        version: DEFAULT_RULE_CONFIG.version,
      });
      expect(warnings[1].effect).toEqual({
        type: 'warning',
        kind: 'gad7',
        since: '2026-01-29',
        version: DEFAULT_RULE_CONFIG.version,
      });
    }
  });

  it('rejects invalid GAD-7 total scores outside 0..21', () => {
    const state = INITIAL_WARNING_STATE;
    const resNeg = processWarningEvent(state, { type: 'gad7_completed', total: -1, date: '2026-01-15' }, DEFAULT_RULE_CONFIG);
    expect(resNeg.ok).toBe(false);

    const resOver = processWarningEvent(state, { type: 'gad7_completed', total: 22, date: '2026-01-15' }, DEFAULT_RULE_CONFIG);
    expect(resOver.ok).toBe(false);
  });
});
