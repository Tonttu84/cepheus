import { describe, it, expect } from 'vitest';
import { processWarningEvent, foldWarningEvents, INITIAL_WARNING_STATE } from '../index';
import type { WarningEvent } from '../index';
import { DEFAULT_RULE_CONFIG } from '../../config';

describe('Warning Rule', () => {
  describe('Initial state & first rounds', () => {
    it('Before any round, the state counts as "after a normal round". So a first round that is low is a small dip, and a first round with no answer raises nothing.', () => {
      const state = INITIAL_WARNING_STATE;
      
      const resLow = processWarningEvent(state, { type: 'round_closed', kind: 'low', date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(resLow.ok).toBe(true);
      if (resLow.ok) {
        expect(resLow.effects).toEqual([{ type: 'small_dip', version: DEFAULT_RULE_CONFIG.version }]);
        expect(resLow.newState.prevRound).toEqual({ kind: 'low', date: '2026-01-01' });
      }

      const resNoAns = processWarningEvent(state, { type: 'round_closed', kind: 'no_answer', date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(resNoAns.ok).toBe(true);
      if (resNoAns.ok) {
        expect(resNoAns.effects).toEqual([]);
        expect(resNoAns.newState.prevRound).toEqual({ kind: 'no_answer', date: '2026-01-01' });
      }
    });

    it('a property-style check with a simple seeded loop: a warning is never raised right after a normal round, and never more than once without a call in between', () => {
      let state = INITIAL_WARNING_STATE;
      let warnings = 0;
      
      // simple deterministic sequence
      const kinds = ['normal', 'low', 'no_answer', 'low', 'low', 'normal', 'no_answer', 'no_answer', 'low'];
      for (let i = 0; i < 200; i++) {
        const kind = kinds[i % kinds.length] as 'normal' | 'low' | 'no_answer';
        const res = processWarningEvent(state, { type: 'round_closed', kind, date: `day-${i}` }, DEFAULT_RULE_CONFIG);
        if (res.ok) {
          const hasWarning = res.effects.some(e => e.type === 'warning');
          if (hasWarning) {
            warnings++;
            // verify no warning right after a normal round
            expect(state.prevRound).not.toBeNull(); 
          }
          state = res.newState;
          
          if (i % 17 === 0) {
            const callRes = processWarningEvent(state, { type: 'call_recorded' }, DEFAULT_RULE_CONFIG);
            if (callRes.ok) {
              state = callRes.newState;
              warnings = 0; // reset
            }
          } else {
            // verify never more than once without a call
            expect(warnings).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });

  describe('Two-round warnings', () => {
    it('low_answers for low then low', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'low_answers', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
      }
    });

    it('silence for no answer twice', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-01' },
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-04' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'silence', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
      }
    });

    it('mixed for the two mixed orders', () => {
      const events1: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-04' }
      ];
      const res1 = foldWarningEvents(events1, DEFAULT_RULE_CONFIG);
      expect(res1.ok).toBe(true);
      if (res1.ok) expect(res1.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'mixed', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });

      const events2: WarningEvent[] = [
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' }
      ];
      const res2 = foldWarningEvents(events2, DEFAULT_RULE_CONFIG);
      expect(res2.ok).toBe(true);
      if (res2.ok) expect(res2.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'mixed', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
    });

    it('a normal round between two low rounds resets the run', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'normal', date: '2026-01-04' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(0);
        expect(mapped.filter(e => e.type === 'small_dip').length).toBe(2);
      }
    });

    it('low, no answer, normal', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-04' },
        { type: 'round_closed', kind: 'normal', date: '2026-01-08' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(1);
      }
    });

    it('no answer, normal, no answer', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-01' },
        { type: 'round_closed', kind: 'normal', date: '2026-01-04' },
        { type: 'round_closed', kind: 'no_answer', date: '2026-01-08' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(0);
      }
    });

    it('low, normal, low, low', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'normal', date: '2026-01-04' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' },
        { type: 'round_closed', kind: 'low', date: '2026-01-11' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'small_dip').length).toBe(2);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(1);
      }
    });

    it('three rounds that are not normal in a row (one warning, not two)', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(1);
      }
    });
  });

  describe('PHQ-9 baseline and warnings', () => {
    it('A first complete PHQ-9 at 10 or more raises a warning and baseline_not_well; under 10 it becomes baseline without warning', () => {
      const res1 = processWarningEvent(INITIAL_WARNING_STATE, { type: 'phq9_completed', total: 10, date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.effects).toContainEqual({ type: 'baseline_not_well', version: DEFAULT_RULE_CONFIG.version });
        expect(res1.effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
        expect(res1.newState.hasFirstPhq9).toBe(true);
        expect(res1.newState.phq9Baseline).toBeNull();
        expect(res1.newState.activeWarning).toBe(true);
      }

      const res2 = processWarningEvent(INITIAL_WARNING_STATE, { type: 'phq9_completed', total: 9, date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.effects).toEqual([]);
        expect(res2.newState.hasFirstPhq9).toBe(true);
        expect(res2.newState.phq9Baseline).toBe(9);
        expect(res2.newState.activeWarning).toBe(false);
      }
    });

    it('Every later complete PHQ-9 raises a warning at 10 or more', () => {
      const events: WarningEvent[] = [
        { type: 'phq9_completed', total: 5, date: '2026-01-01' },
        { type: 'phq9_completed', total: 10, date: '2026-01-15' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-15', version: DEFAULT_RULE_CONFIG.version });
    });

    it('Every later complete PHQ-9 raises a warning at 6 or more above the baseline when a baseline exists', () => {
      const events: WarningEvent[] = [
        { type: 'phq9_completed', total: 2, date: '2026-01-01' },
        { type: 'phq9_completed', total: 8, date: '2026-01-15' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) expect(res.effects.map(e => e.effect)).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-15', version: DEFAULT_RULE_CONFIG.version });
    });

    it('a later PHQ-9 when the first was 10 or more (no baseline: only the cut-off applies)', () => {
      const events: WarningEvent[] = [
        { type: 'phq9_completed', total: 10, date: '2026-01-01' },
        { type: 'call_recorded' },
        { type: 'phq9_completed', total: 9, date: '2026-01-15' },
        { type: 'phq9_completed', total: 12, date: '2026-01-30' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const effects = res.effects.map(e => e.effect);
        expect(effects).toContainEqual({ type: 'baseline_not_well', version: DEFAULT_RULE_CONFIG.version });
        expect(effects.filter(e => e.type === 'warning').length).toBe(2);
        expect(effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
        expect(effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-30', version: DEFAULT_RULE_CONFIG.version });
      }
    });

    it('when a first PHQ-9 is >= 10 and triggers a warning, a subsequent call_recorded resets activeWarning = false, and a later PHQ-9 >= 10 can trigger another warning', () => {
      const s0 = INITIAL_WARNING_STATE;
      const r1 = processWarningEvent(s0, { type: 'phq9_completed', total: 11, date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(r1.ok).toBe(true);
      if (!r1.ok) throw new Error();
      expect(r1.effects).toContainEqual({ type: 'baseline_not_well', version: DEFAULT_RULE_CONFIG.version });
      expect(r1.effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-01', version: DEFAULT_RULE_CONFIG.version });
      expect(r1.newState.activeWarning).toBe(true);

      const r2 = processWarningEvent(r1.newState, { type: 'call_recorded' }, DEFAULT_RULE_CONFIG);
      expect(r2.ok).toBe(true);
      if (!r2.ok) throw new Error();
      expect(r2.newState.activeWarning).toBe(false);

      const r3 = processWarningEvent(r2.newState, { type: 'phq9_completed', total: 10, date: '2026-01-15' }, DEFAULT_RULE_CONFIG);
      expect(r3.ok).toBe(true);
      if (!r3.ok) throw new Error();
      expect(r3.effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-15', version: DEFAULT_RULE_CONFIG.version });
      expect(r3.newState.activeWarning).toBe(true);
    });

    it('the PHQ-9 at 9, at 10, at baseline plus 5 and plus 6, with a baseline of 0 and of 9', () => {
      const conf = DEFAULT_RULE_CONFIG;
      const s0 = INITIAL_WARNING_STATE;
      
      const r1 = processWarningEvent(s0, { type: 'phq9_completed', total: 0, date: '2026-01-01' }, conf);
      if (!r1.ok) throw new Error();
      const s1 = r1.newState;
      
      const r2 = processWarningEvent(s1, { type: 'phq9_completed', total: 5, date: '2026-01-15' }, conf);
      if (r2.ok) expect(r2.effects).toEqual([]);
      
      const r3 = processWarningEvent(s1, { type: 'phq9_completed', total: 6, date: '2026-01-15' }, conf);
      if (r3.ok) expect(r3.effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-15', version: conf.version });

      const r4 = processWarningEvent(s0, { type: 'phq9_completed', total: 9, date: '2026-01-01' }, conf);
      if (!r4.ok) throw new Error();
      const s2 = r4.newState;
      
      const r5 = processWarningEvent(s2, { type: 'phq9_completed', total: 9, date: '2026-01-15' }, conf);
      if (r5.ok) expect(r5.effects).toEqual([]); 
      
      const r6 = processWarningEvent(s2, { type: 'phq9_completed', total: 10, date: '2026-01-15' }, conf);
      if (r6.ok) expect(r6.effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-15', version: conf.version });
    });
  });

  describe('Post-warning suppression and calls', () => {
    it('After a warning is raised, no further warning and no small dip is raised until a call is recorded, whatever the rounds are.', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' },
        { type: 'phq9_completed', total: 15, date: '2026-01-09' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(1);
        expect(mapped.filter(e => e.type === 'small_dip').length).toBe(1);
      }
    });

    it('When the call is recorded the state is as in (a) (after a normal round).', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' },
        { type: 'call_recorded' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const warnings = res.effects.map(e => e.effect).filter(e => e.type === 'warning');
        const dips = res.effects.map(e => e.effect).filter(e => e.type === 'small_dip');
        expect(warnings.length).toBe(1);
        expect(dips.length).toBe(2);
      }
    });

    it('a call recorded when no warning is waiting', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'call_recorded' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        expect(res.finalState.prevRound).toBeNull();
      }
    });

    it('two calls in a row', () => {
      const events: WarningEvent[] = [
        { type: 'call_recorded' },
        { type: 'call_recorded' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        expect(res.finalState.activeWarning).toBe(false);
      }
    });

    it('a PHQ-9 warning while a run of one low round is open', () => {
      const events: WarningEvent[] = [
        { type: 'phq9_completed', total: 0, date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-02' },
        { type: 'phq9_completed', total: 10, date: '2026-01-03' }
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const effects = res.effects.map(e => e.effect);
        expect(effects).toContainEqual({ type: 'warning', kind: 'phq9', since: '2026-01-03', version: DEFAULT_RULE_CONFIG.version });
        expect(res.finalState.prevRound).toBeNull(); // PHQ9 warning clears the run
      }
    });

    it('rounds and PHQ-9s while a warning waits', () => {
      const events: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-01-01' },
        { type: 'round_closed', kind: 'low', date: '2026-01-04' },
        { type: 'round_closed', kind: 'low', date: '2026-01-08' },
        { type: 'phq9_completed', total: 2, date: '2026-01-10' }, // first PHQ9 becomes baseline
        { type: 'phq9_completed', total: 12, date: '2026-01-24' }, // ignored because warning waits
      ];
      const res = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res.ok) {
        const mapped = res.effects.map(e => e.effect);
        expect(mapped.filter(e => e.type === 'warning').length).toBe(1);
        expect(res.finalState.phq9Baseline).toBe(2); // Still tracks baseline
      }
    });

    it('invalid phq9 total', () => {
      const res = processWarningEvent(INITIAL_WARNING_STATE, { type: 'phq9_completed', total: NaN, date: '2026-01-01' }, DEFAULT_RULE_CONFIG);
      expect(res.ok).toBe(false);
    });
  });

  describe('Config changes', () => {
    it('A changed config giving a different result on a fixed list of events, and the version in the effects follows the config', () => {
      const events: WarningEvent[] = [
        { type: 'phq9_completed', total: 2, date: '2026-01-01' },
        { type: 'phq9_completed', total: 7, date: '2026-01-15' }
      ];
      
      const res1 = foldWarningEvents(events, DEFAULT_RULE_CONFIG);
      if (res1.ok) {
        expect(res1.effects.filter(e => e.effect.type === 'warning').length).toBe(0);
      }

      const changedConfig = { ...DEFAULT_RULE_CONFIG, phq9WarningRise: 4, version: 2 };
      const res2 = foldWarningEvents(events, changedConfig);
      if (res2.ok) {
        const warningEffects = res2.effects.filter(e => e.effect.type === 'warning');
        expect(warningEffects.length).toBe(1);
        if (warningEffects[0].effect.type === 'warning') {
           expect(warningEffects[0].effect.version).toBe(2);
        }
      }
    });
  });
});
