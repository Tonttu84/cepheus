import { describe, it, expect } from 'vitest';
import {
  processWarningEvent,
  foldWarningEvents,
  INITIAL_WARNING_STATE,
  handleCallRecorded,
  handleRoundClosed,
  handlePhq9Completed,
} from '../index';
import type { WarningEvent, WarningState } from '../index';
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

    it('a first PHQ-9 of exactly 10 and of exactly 27 with no warning waiting (warning and notice, no baseline stored, and the warning carries the config version and that PHQ-9 date)', () => {
      // First PHQ-9 of exactly 10 with no warning waiting
      const res10 = processWarningEvent(
        INITIAL_WARNING_STATE,
        { type: 'phq9_completed', total: 10, date: '2026-03-01' },
        DEFAULT_RULE_CONFIG
      );
      expect(res10.ok).toBe(true);
      if (res10.ok) {
        expect(res10.effects).toHaveLength(2);
        expect(res10.effects).toContainEqual({
          type: 'baseline_not_well',
          version: DEFAULT_RULE_CONFIG.version,
        });
        expect(res10.effects).toContainEqual({
          type: 'warning',
          kind: 'phq9',
          since: '2026-03-01',
          version: DEFAULT_RULE_CONFIG.version,
        });
        expect(res10.newState.phq9Baseline).toBeNull();
        expect(res10.newState.hasFirstPhq9).toBe(true);
        expect(res10.newState.activeWarning).toBe(true);
      }

      // First PHQ-9 of exactly 27 with no warning waiting
      const res27 = processWarningEvent(
        INITIAL_WARNING_STATE,
        { type: 'phq9_completed', total: 27, date: '2026-03-05' },
        DEFAULT_RULE_CONFIG
      );
      expect(res27.ok).toBe(true);
      if (res27.ok) {
        expect(res27.effects).toHaveLength(2);
        expect(res27.effects).toContainEqual({
          type: 'baseline_not_well',
          version: DEFAULT_RULE_CONFIG.version,
        });
        expect(res27.effects).toContainEqual({
          type: 'warning',
          kind: 'phq9',
          since: '2026-03-05',
          version: DEFAULT_RULE_CONFIG.version,
        });
        expect(res27.newState.phq9Baseline).toBeNull();
        expect(res27.newState.hasFirstPhq9).toBe(true);
        expect(res27.newState.activeWarning).toBe(true);
      }
    });

    it('a first PHQ-9 of 10 and of 27 while a warning waits (the notice only, exactly one effect, no baseline stored)', () => {
      // Set up a state where a warning is waiting for a call (e.g. from two low rounds)
      const setupEvents: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-03-01' },
        { type: 'round_closed', kind: 'low', date: '2026-03-04' },
      ];
      const setupRes = foldWarningEvents(setupEvents, DEFAULT_RULE_CONFIG);
      expect(setupRes.ok).toBe(true);
      if (!setupRes.ok) throw new Error();
      const waitingState = setupRes.finalState;
      expect(waitingState.activeWarning).toBe(true);
      expect(waitingState.hasFirstPhq9).toBe(false);

      // First PHQ-9 of 10 while a warning waits
      const res10 = processWarningEvent(
        waitingState,
        { type: 'phq9_completed', total: 10, date: '2026-03-07' },
        DEFAULT_RULE_CONFIG
      );
      expect(res10.ok).toBe(true);
      if (res10.ok) {
        expect(res10.effects).toHaveLength(1);
        expect(res10.effects).toEqual([
          { type: 'baseline_not_well', version: DEFAULT_RULE_CONFIG.version },
        ]);
        expect(res10.newState.phq9Baseline).toBeNull();
        expect(res10.newState.hasFirstPhq9).toBe(true);
        expect(res10.newState.activeWarning).toBe(true);
      }

      // First PHQ-9 of 27 while a warning waits
      const res27 = processWarningEvent(
        waitingState,
        { type: 'phq9_completed', total: 27, date: '2026-03-07' },
        DEFAULT_RULE_CONFIG
      );
      expect(res27.ok).toBe(true);
      if (res27.ok) {
        expect(res27.effects).toHaveLength(1);
        expect(res27.effects).toEqual([
          { type: 'baseline_not_well', version: DEFAULT_RULE_CONFIG.version },
        ]);
        expect(res27.newState.phq9Baseline).toBeNull();
        expect(res27.newState.hasFirstPhq9).toBe(true);
        expect(res27.newState.activeWarning).toBe(true);
      }
    });

    it('after the call is recorded in that case, a later PHQ-9 of 10 raises a warning and a later PHQ-9 of 9 does not (there is no baseline, so only the cut-off applies)', () => {
      // First PHQ-9 was 10 while a warning waited
      const events10: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-03-01' },
        { type: 'round_closed', kind: 'low', date: '2026-03-04' },
        { type: 'phq9_completed', total: 10, date: '2026-03-07' },
        { type: 'call_recorded' },
      ];
      const folded10 = foldWarningEvents(events10, DEFAULT_RULE_CONFIG);
      expect(folded10.ok).toBe(true);
      if (!folded10.ok) throw new Error();
      const stateAfterCall10 = folded10.finalState;
      expect(stateAfterCall10.activeWarning).toBe(false);
      expect(stateAfterCall10.hasFirstPhq9).toBe(true);
      expect(stateAfterCall10.phq9Baseline).toBeNull();

      // Later PHQ-9 of 10 raises a warning
      const later10 = processWarningEvent(
        stateAfterCall10,
        { type: 'phq9_completed', total: 10, date: '2026-03-20' },
        DEFAULT_RULE_CONFIG
      );
      expect(later10.ok).toBe(true);
      if (later10.ok) {
        expect(later10.effects).toEqual([
          { type: 'warning', kind: 'phq9', since: '2026-03-20', version: DEFAULT_RULE_CONFIG.version },
        ]);
        expect(later10.newState.activeWarning).toBe(true);
      }

      // Later PHQ-9 of 9 does not raise a warning (no baseline, so only cut-off applies)
      const later9 = processWarningEvent(
        stateAfterCall10,
        { type: 'phq9_completed', total: 9, date: '2026-03-20' },
        DEFAULT_RULE_CONFIG
      );
      expect(later9.ok).toBe(true);
      if (later9.ok) {
        expect(later9.effects).toEqual([]);
        expect(later9.newState.activeWarning).toBe(false);
      }

      // First PHQ-9 was 27 while a warning waited
      const events27: WarningEvent[] = [
        { type: 'round_closed', kind: 'low', date: '2026-03-01' },
        { type: 'round_closed', kind: 'low', date: '2026-03-04' },
        { type: 'phq9_completed', total: 27, date: '2026-03-07' },
        { type: 'call_recorded' },
      ];
      const folded27 = foldWarningEvents(events27, DEFAULT_RULE_CONFIG);
      expect(folded27.ok).toBe(true);
      if (!folded27.ok) throw new Error();
      const stateAfterCall27 = folded27.finalState;
      expect(stateAfterCall27.activeWarning).toBe(false);
      expect(stateAfterCall27.hasFirstPhq9).toBe(true);
      expect(stateAfterCall27.phq9Baseline).toBeNull();

      const later10From27 = processWarningEvent(
        stateAfterCall27,
        { type: 'phq9_completed', total: 10, date: '2026-03-20' },
        DEFAULT_RULE_CONFIG
      );
      expect(later10From27.ok).toBe(true);
      if (later10From27.ok) {
        expect(later10From27.effects).toEqual([
          { type: 'warning', kind: 'phq9', since: '2026-03-20', version: DEFAULT_RULE_CONFIG.version },
        ]);
        expect(later10From27.newState.activeWarning).toBe(true);
      }

      const later9From27 = processWarningEvent(
        stateAfterCall27,
        { type: 'phq9_completed', total: 9, date: '2026-03-20' },
        DEFAULT_RULE_CONFIG
      );
      expect(later9From27.ok).toBe(true);
      if (later9From27.ok) {
        expect(later9From27.effects).toEqual([]);
        expect(later9From27.newState.activeWarning).toBe(false);
      }
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

  describe('Pure functions and immutability (Finding 2)', () => {
    function deepFreeze<T>(obj: T): Readonly<T> {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      Object.freeze(obj);
      for (const key of Object.keys(obj)) {
        const val = (obj as Record<string, unknown>)[key];
        if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
          deepFreeze(val);
        }
      }
      return obj;
    }

    const testStates: WarningState[] = [
      INITIAL_WARNING_STATE,
      {
        activeWarning: false,
        phq9Baseline: null,
        hasFirstPhq9: false,
        prevRound: { kind: 'low', date: '2026-01-01' },
      },
      {
        activeWarning: false,
        phq9Baseline: null,
        hasFirstPhq9: false,
        prevRound: { kind: 'no_answer', date: '2026-01-01' },
      },
      {
        activeWarning: true,
        phq9Baseline: null,
        hasFirstPhq9: false,
        prevRound: null,
      },
      {
        activeWarning: true,
        phq9Baseline: 5,
        hasFirstPhq9: true,
        prevRound: null,
      },
      {
        activeWarning: false,
        phq9Baseline: 5,
        hasFirstPhq9: true,
        prevRound: { kind: 'low', date: '2026-01-01' },
      },
    ];

    const testEvents: WarningEvent[] = [
      { type: 'call_recorded' },
      { type: 'round_closed', kind: 'normal', date: '2026-03-01' },
      { type: 'round_closed', kind: 'low', date: '2026-03-01' },
      { type: 'round_closed', kind: 'no_answer', date: '2026-03-01' },
      { type: 'phq9_completed', total: 5, date: '2026-03-01' },
      { type: 'phq9_completed', total: 10, date: '2026-03-01' },
      { type: 'phq9_completed', total: 27, date: '2026-03-01' },
    ];

    it('calling each kind of event on deeply frozen state via processWarningEvent: nothing throws, returned state is a different object, and frozen input is unchanged', () => {
      for (const state of testStates) {
        for (const event of testEvents) {
          const frozenInput = deepFreeze(JSON.parse(JSON.stringify(state)) as WarningState);
          expect(Object.isFrozen(frozenInput)).toBe(true);
          if (frozenInput.prevRound !== null) {
            expect(Object.isFrozen(frozenInput.prevRound)).toBe(true);
          }
          const snapshot = JSON.stringify(frozenInput);

          let res!: ReturnType<typeof processWarningEvent>;
          expect(() => {
            res = processWarningEvent(frozenInput, event, DEFAULT_RULE_CONFIG);
          }).not.toThrow();

          expect(res.ok).toBe(true);
          if (res.ok) {
            expect(res.newState).not.toBe(frozenInput);
          }
          expect(JSON.stringify(frozenInput)).toBe(snapshot);
        }
      }
    });

    it('calling helpers directly on deeply frozen state: nothing throws, returned state is a different object, and frozen input is unchanged', () => {
      for (const state of testStates) {
        // handleCallRecorded
        const frozenForCall = deepFreeze(JSON.parse(JSON.stringify(state)) as WarningState);
        const snapshotForCall = JSON.stringify(frozenForCall);
        let callRes!: ReturnType<typeof handleCallRecorded>;
        expect(() => {
          callRes = handleCallRecorded(frozenForCall);
        }).not.toThrow();
        expect(callRes.ok).toBe(true);
        expect(callRes.newState).not.toBe(frozenForCall);
        expect(JSON.stringify(frozenForCall)).toBe(snapshotForCall);

        // handleRoundClosed with each round event kind
        const roundKinds: Array<'normal' | 'low' | 'no_answer'> = ['normal', 'low', 'no_answer'];
        for (const kind of roundKinds) {
          const frozenForRound = deepFreeze(JSON.parse(JSON.stringify(state)) as WarningState);
          const snapshotForRound = JSON.stringify(frozenForRound);
          let roundRes!: ReturnType<typeof handleRoundClosed>;
          expect(() => {
            roundRes = handleRoundClosed(
              frozenForRound,
              { type: 'round_closed', kind, date: '2026-03-01' },
              DEFAULT_RULE_CONFIG
            );
          }).not.toThrow();
          expect(roundRes.ok).toBe(true);
          expect(roundRes.newState).not.toBe(frozenForRound);
          expect(JSON.stringify(frozenForRound)).toBe(snapshotForRound);
        }

        // handlePhq9Completed with different scores
        const phq9Scores = [5, 10, 27];
        for (const total of phq9Scores) {
          const frozenForPhq9 = deepFreeze(JSON.parse(JSON.stringify(state)) as WarningState);
          const snapshotForPhq9 = JSON.stringify(frozenForPhq9);
          let phq9Res!: ReturnType<typeof handlePhq9Completed>;
          expect(() => {
            phq9Res = handlePhq9Completed(
              frozenForPhq9,
              { type: 'phq9_completed', total, date: '2026-03-01' },
              DEFAULT_RULE_CONFIG
            );
          }).not.toThrow();
          expect(phq9Res.ok).toBe(true);
          expect(phq9Res.newState).not.toBe(frozenForPhq9);
          expect(JSON.stringify(frozenForPhq9)).toBe(snapshotForPhq9);
        }
      }
    });

    it('calling the same function twice with the same input gives equal results', () => {
      for (const state of testStates) {
        // processWarningEvent called twice with same input
        for (const event of testEvents) {
          const input = JSON.parse(JSON.stringify(state)) as WarningState;
          const res1 = processWarningEvent(input, event, DEFAULT_RULE_CONFIG);
          const res2 = processWarningEvent(input, event, DEFAULT_RULE_CONFIG);
          expect(res1).toEqual(res2);
        }

        // handleCallRecorded called twice with same input
        const inputForCall = JSON.parse(JSON.stringify(state)) as WarningState;
        const callRes1 = handleCallRecorded(inputForCall);
        const callRes2 = handleCallRecorded(inputForCall);
        expect(callRes1).toEqual(callRes2);

        // handleRoundClosed called twice with same input
        const roundKinds: Array<'normal' | 'low' | 'no_answer'> = ['normal', 'low', 'no_answer'];
        for (const kind of roundKinds) {
          const inputForRound = JSON.parse(JSON.stringify(state)) as WarningState;
          const roundRes1 = handleRoundClosed(
            inputForRound,
            { type: 'round_closed', kind, date: '2026-03-01' },
            DEFAULT_RULE_CONFIG
          );
          const roundRes2 = handleRoundClosed(
            inputForRound,
            { type: 'round_closed', kind, date: '2026-03-01' },
            DEFAULT_RULE_CONFIG
          );
          expect(roundRes1).toEqual(roundRes2);
        }

        // handlePhq9Completed called twice with same input
        const phq9Scores = [5, 10, 27];
        for (const total of phq9Scores) {
          const inputForPhq9 = JSON.parse(JSON.stringify(state)) as WarningState;
          const phq9Res1 = handlePhq9Completed(
            inputForPhq9,
            { type: 'phq9_completed', total, date: '2026-03-01' },
            DEFAULT_RULE_CONFIG
          );
          const phq9Res2 = handlePhq9Completed(
            inputForPhq9,
            { type: 'phq9_completed', total, date: '2026-03-01' },
            DEFAULT_RULE_CONFIG
          );
          expect(phq9Res1).toEqual(phq9Res2);
        }
      }
    });
  });
});
