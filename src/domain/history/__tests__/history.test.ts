import { describe, it, expect } from 'vitest';
import { evaluateHistory } from '../index';
import type { HistoryRound, HistoryPhq9, HistoryCall } from '../types';
import { DEFAULT_RULE_CONFIG, RuleConfig } from '../../config';
import type { RoundStatus } from '../../rounds';

type RoundInputSpec =
  | 'normal'
  | 'low'
  | 'missed'
  | 'not_today'
  | {
      status?: RoundStatus;
      kind?: 'normal' | 'low' | 'missed' | 'not_today';
      mood?: number;
      interest?: number;
      date?: string;
      roundNumber?: number;
    };

function testDate(index: number): string {
  const week = Math.floor(index / 2);
  const dayInWeek = (index % 2) === 0 ? 0 : 3;
  const dayOffset = week * 7 + dayInWeek;
  const d = new Date(Date.UTC(2026, 0, 5 + dayOffset));
  return d.toISOString().slice(0, 10);
}

function makeRounds(specs: readonly RoundInputSpec[]): HistoryRound[] {
  return specs.map((spec, i) => {
    const roundNumber = i + 1;
    const localDate = testDate(i);

    if (typeof spec === 'string') {
      if (spec === 'normal') {
        return { roundNumber, localDate, status: 'answered', mood: 4, interest: 4 };
      }
      if (spec === 'low') {
        return { roundNumber, localDate, status: 'answered', mood: 0, interest: 4 };
      }
      if (spec === 'missed') {
        return { roundNumber, localDate, status: 'missed' };
      }
      return { roundNumber, localDate, status: 'not_today' };
    }

    const date = spec.date ?? localDate;
    const num = spec.roundNumber ?? roundNumber;
    const kind = spec.kind ?? (spec.status === 'answered' ? 'normal' : spec.status);

    if (kind === 'missed' || spec.status === 'missed') {
      return { roundNumber: num, localDate: date, status: 'missed' };
    }
    if (kind === 'not_today' || spec.status === 'not_today') {
      return { roundNumber: num, localDate: date, status: 'not_today' };
    }
    if (kind === 'low') {
      return {
        roundNumber: num,
        localDate: date,
        status: 'answered',
        mood: spec.mood ?? 0,
        interest: spec.interest ?? 4,
      };
    }
    return {
      roundNumber: num,
      localDate: date,
      status: 'answered',
      mood: spec.mood ?? 4,
      interest: spec.interest ?? 4,
    };
  });
}

describe('evaluateHistory', () => {
  describe('Full eight weeks of a person who stays well', () => {
    it('16 normal rounds over eight weeks produce no effects and establish tap baselines', () => {
      // 16 rounds = 8 weeks (2 per week)
      const rounds = makeRounds(Array(16).fill('normal') as RoundInputSpec[]);
      const phq9s: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 3 },
        { date: rounds[4].localDate, total: 2 },
        { date: rounds[8].localDate, total: 3 },
        { date: rounds[12].localDate, total: 2 },
      ];

      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.configVersion).toBe(DEFAULT_RULE_CONFIG.version);
      expect(res.value.rounds).toHaveLength(16);
      expect(res.value.rounds.every((r) => r.kind === 'normal')).toBe(true);

      // Tap baseline exists after first 8 answered rounds
      expect(res.value.tapBaseline.hasBaseline).toBe(true);
      expect(res.value.tapBaseline.mood).toBe(4);
      expect(res.value.tapBaseline.interest).toBe(4);
      expect(res.value.tapBaseline.roundsNeeded).toBe(0);

      // PHQ-9 baseline established from first score 3
      expect(res.value.phq9Baseline).toEqual({ type: 'baseline', value: 3 });

      // No effects, no warnings waiting, no flags
      expect(res.value.effects).toEqual([]);
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.currentState.since).toBeNull();
      expect(res.value.flags).toEqual([]);
    });
  });

  describe('A small dip that recovers', () => {
    it('one low round after a normal one raises a small dip suggestion, and recovering to normal ends the run with no warning', () => {
      const rounds = makeRounds(['normal', 'low', 'normal']);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.rounds.map((r) => r.kind)).toEqual(['normal', 'low', 'normal']);
      expect(res.value.effects).toHaveLength(1);
      expect(res.value.effects[0].type).toBe('small_dip');
      expect(res.value.effects[0].version).toBe(DEFAULT_RULE_CONFIG.version);
      expect(res.value.effects[0].causedBy).toEqual({
        type: 'round',
        roundNumber: 2,
        date: rounds[1].localDate,
      });

      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.flags).toHaveLength(0);
    });
  });

  describe('Two-round check-in warnings', () => {
    it('low then low: raises a warning with kind low_answers', () => {
      const rounds = makeRounds(['low', 'low']);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.rounds.map((r) => r.kind)).toEqual(['low', 'low']);
      expect(res.value.effects).toHaveLength(2);
      expect(res.value.effects[0].type).toBe('small_dip');
      expect(res.value.effects[1].type).toBe('warning');
      expect(res.value.effects[1].kind).toBe('low_answers');
      expect(res.value.effects[1].since).toBe(rounds[0].localDate);
      expect(res.value.effects[1].causedBy).toEqual({
        type: 'round',
        roundNumber: 2,
        date: rounds[1].localDate,
      });

      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(rounds[0].localDate);
      expect(res.value.flags).toHaveLength(1);
      expect(res.value.flags[0]).toEqual({
        area: 'check_in',
        since: rounds[0].localDate,
      });
    });

    it('silence twice: two missed rounds raise a warning with kind silence', () => {
      const rounds = makeRounds(['missed', 'missed']);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.rounds.map((r) => r.kind)).toEqual(['no_answer', 'no_answer']);
      expect(res.value.effects).toHaveLength(1);
      expect(res.value.effects[0].type).toBe('warning');
      expect(res.value.effects[0].kind).toBe('silence');
      expect(res.value.effects[0].since).toBe(rounds[0].localDate);
      expect(res.value.effects[0].causedBy).toEqual({
        type: 'round',
        roundNumber: 2,
        date: rounds[1].localDate,
      });

      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(rounds[0].localDate);
      expect(res.value.flags).toHaveLength(1);
      expect(res.value.flags[0]).toEqual({
        area: 'check_in',
        since: rounds[0].localDate,
      });
    });

    it('the two mixes: low then no answer, and no answer then low both raise mixed warning', () => {
      // low then not_today
      const rounds1 = makeRounds(['low', 'not_today']);
      const res1 = evaluateHistory({ rounds: rounds1 });
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error(res1.error);
      expect(res1.value.effects.filter((e) => e.type === 'warning')).toHaveLength(1);
      expect(res1.value.effects.find((e) => e.type === 'warning')?.kind).toBe('mixed');
      expect(res1.value.effects.find((e) => e.type === 'warning')?.since).toBe(rounds1[0].localDate);

      // missed then low
      const rounds2 = makeRounds(['missed', 'low']);
      const res2 = evaluateHistory({ rounds: rounds2 });
      expect(res2.ok).toBe(true);
      if (!res2.ok) throw new Error(res2.error);
      expect(res2.value.effects.filter((e) => e.type === 'warning')).toHaveLength(1);
      expect(res2.value.effects.find((e) => e.type === 'warning')?.kind).toBe('mixed');
      expect(res2.value.effects.find((e) => e.type === 'warning')?.since).toBe(rounds2[0].localDate);
    });
  });

  describe('PHQ-9 evaluations and cut-offs', () => {
    it('the first PHQ-9 completes while a warning waits for a call, asserting the reported baseline state', () => {
      // Rounds 1 and 2 are low -> warning raised at round 2, waiting for a call
      // Round 3 is normal, and on round 3 date the first PHQ-9 completes with total 6 (< 10)
      const rounds = makeRounds(['low', 'low', 'normal']);
      const phq9s: HistoryPhq9[] = [{ date: rounds[2].localDate, total: 6 }];

      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Warning remains waiting for call from round 2 (since round 1 date)
      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(rounds[0].localDate);

      // PHQ-9 baseline state reported from fold's final state is { type: 'baseline', value: 6 }
      expect(res.value.phq9Baseline).toEqual({ type: 'baseline', value: 6 });
    });

    it('the first PHQ-9 is 10 or more while a warning waits for a call, asserting reported baseline state is not_well', () => {
      // Rounds 1 and 2 are low -> warning raised at round 2, waiting for a call
      // Round 3 is normal, and on round 3 date the first PHQ-9 completes with total 14 (>= 10)
      const rounds = makeRounds(['low', 'low', 'normal']);
      const phq9s: HistoryPhq9[] = [{ date: rounds[2].localDate, total: 14 }];

      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Reported baseline state from fold's final state must be { type: 'not_well' }
      expect(res.value.phq9Baseline).toEqual({ type: 'not_well' });
    });

    it('a first PHQ-9 of 9 becomes baseline without warning', () => {
      const rounds = makeRounds(['normal']);
      const phq9s: HistoryPhq9[] = [{ date: rounds[0].localDate, total: 9 }];
      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.phq9Baseline).toEqual({ type: 'baseline', value: 9 });
      expect(res.value.effects).toEqual([]);
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.flags).toHaveLength(0);
    });

    it('a first PHQ-9 of 10 raises warning and baseline_not_well notice, with no baseline stored', () => {
      const rounds = makeRounds(['normal']);
      const phq9s: HistoryPhq9[] = [{ date: rounds[0].localDate, total: 10 }];
      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.phq9Baseline).toEqual({ type: 'not_well' });
      expect(res.value.effects).toHaveLength(2);
      expect(res.value.effects[0].type).toBe('baseline_not_well');
      expect(res.value.effects[0].causedBy).toEqual({
        type: 'phq9',
        date: phq9s[0].date,
        total: 10,
      });
      expect(res.value.effects[1].type).toBe('warning');
      expect(res.value.effects[1].kind).toBe('phq9');
      expect(res.value.effects[1].since).toBe(phq9s[0].date);
      expect(res.value.effects[1].causedBy).toEqual({
        type: 'phq9',
        date: phq9s[0].date,
        total: 10,
      });

      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(phq9s[0].date);
      expect(res.value.flags).toHaveLength(1);
    });

    it('a first PHQ-9 of 27 raises warning and baseline_not_well notice', () => {
      const rounds = makeRounds(['normal']);
      const phq9s: HistoryPhq9[] = [{ date: rounds[0].localDate, total: 27 }];
      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.phq9Baseline).toEqual({ type: 'not_well' });
      expect(res.value.effects).toHaveLength(2);
      expect(res.value.effects[0].type).toBe('baseline_not_well');
      expect(res.value.effects[1].type).toBe('warning');
      expect(res.value.effects[1].kind).toBe('phq9');
      expect(res.value.effects[1].since).toBe(phq9s[0].date);
    });

    it('a later PHQ-9 at baseline plus 5 raises no warning, but baseline plus 6 raises a warning', () => {
      const rounds = makeRounds(['normal', 'normal', 'normal', 'normal', 'normal']);
      // First PHQ-9 is 2 (establishes baseline = 2)
      // Second PHQ-9 is at round 5 (2 + 5 = 7) -> no warning
      const phq9sPlus5: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 2 },
        { date: rounds[4].localDate, total: 7 },
      ];
      const res5 = evaluateHistory({ rounds, phq9s: phq9sPlus5 });
      expect(res5.ok).toBe(true);
      if (!res5.ok) throw new Error(res5.error);
      expect(res5.value.effects).toHaveLength(0);

      // Second PHQ-9 is at round 5 (2 + 6 = 8) -> warning!
      const phq9sPlus6: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 2 },
        { date: rounds[4].localDate, total: 8 },
      ];
      const res6 = evaluateHistory({ rounds, phq9s: phq9sPlus6 });
      expect(res6.ok).toBe(true);
      if (!res6.ok) throw new Error(res6.error);
      expect(res6.value.effects).toHaveLength(1);
      expect(res6.value.effects[0].type).toBe('warning');
      expect(res6.value.effects[0].kind).toBe('phq9');
      expect(res6.value.effects[0].since).toBe(rounds[4].localDate);
      expect(res6.value.effects[0].causedBy).toEqual({
        type: 'phq9',
        date: rounds[4].localDate,
        total: 8,
      });
    });
  });

  describe('Post-warning suppression, nurse calls, and fresh runs', () => {
    it('a warning, more low rounds while it waits, a call, then a fresh run', () => {
      const rounds = makeRounds(['low', 'low', 'low', 'low', 'low', 'low']);
      // Warning is raised at round 2 (since round 1 date)
      // Rounds 3 and 4 happen while warning is active -> no new warnings or dips
      // Nurse call occurs on the date of round 4 (after round 4 closes)
      // Round 5 is low -> fresh run, raises small dip
      // Round 6 is low -> raises new warning
      const calls: HistoryCall[] = [
        { date: rounds[3].localDate, position: 'after' },
      ];

      const res = evaluateHistory({ rounds, calls });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Effects:
      // 1. small_dip from round 1
      // 2. warning (low_answers) from round 2 (since round 1 date)
      // (rounds 3 and 4 suppressed)
      // call clears activeWarning
      // 3. small_dip from round 5
      // 4. warning (low_answers) from round 6 (since round 5 date)
      expect(res.value.effects).toHaveLength(4);
      expect(res.value.effects[0]).toMatchObject({
        type: 'small_dip',
        causedBy: { roundNumber: 1 },
      });
      expect(res.value.effects[1]).toMatchObject({
        type: 'warning',
        kind: 'low_answers',
        since: rounds[0].localDate,
        causedBy: { roundNumber: 2 },
      });
      expect(res.value.effects[2]).toMatchObject({
        type: 'small_dip',
        causedBy: { roundNumber: 5 },
      });
      expect(res.value.effects[3]).toMatchObject({
        type: 'warning',
        kind: 'low_answers',
        since: rounds[4].localDate,
        causedBy: { roundNumber: 6 },
      });

      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(rounds[4].localDate);
      expect(res.value.flags).toHaveLength(2);
      expect(res.value.flags[0].since).toBe(rounds[0].localDate);
      expect(res.value.flags[1].since).toBe(rounds[4].localDate);
    });

    it('a call on the same date as a round, placed before and after it', () => {
      const rounds = makeRounds(['low', 'low']);
      const sameDate = rounds[1].localDate;

      // Case 1: Call placed AFTER round 2 closes on the same date
      // Round 1 (low) -> small dip
      // Round 2 (low) -> warning (since round 1 date)
      // Call placed after -> clears the active warning!
      const resAfter = evaluateHistory({
        rounds,
        calls: [{ date: sameDate, position: 'after' }],
      });
      expect(resAfter.ok).toBe(true);
      if (!resAfter.ok) throw new Error(resAfter.error);
      expect(resAfter.value.effects.some((e) => e.type === 'warning')).toBe(true);
      expect(resAfter.value.currentState.isWarningWaitingForCall).toBe(false);

      // Default position is "after" when omitted
      const resDefault = evaluateHistory({
        rounds,
        calls: [{ date: sameDate }],
      });
      expect(resDefault.ok).toBe(true);
      if (!resDefault.ok) throw new Error(resDefault.error);
      expect(resDefault.value.currentState.isWarningWaitingForCall).toBe(false);

      // Case 2: Call placed BEFORE round 2 closes on the same date
      // Round 1 (low) -> small dip
      // Call placed before round 2 -> resets prevRound to null!
      // Round 2 (low) is now the first low round -> raises small dip, NOT a warning!
      const resBefore = evaluateHistory({
        rounds,
        calls: [{ date: sameDate, position: 'before' }],
      });
      expect(resBefore.ok).toBe(true);
      if (!resBefore.ok) throw new Error(resBefore.error);
      expect(resBefore.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);
      expect(resBefore.value.effects.filter((e) => e.type === 'small_dip')).toHaveLength(2);
      expect(resBefore.value.currentState.isWarningWaitingForCall).toBe(false);
    });

    it('a call before and after a PHQ-9 on the same date', () => {
      const rounds = makeRounds(['normal', 'normal']);
      const secondDate = rounds[1].localDate;
      const phq9s: HistoryPhq9[] = [{ date: secondDate, total: 12 }];

      // Case 1: Call placed BEFORE everything on that date (before round closing and PHQ-9)
      // Round 2 closes (normal). PHQ-9 completes (total 12 >= 10 -> raises warning!).
      // Warning is waiting for a call because the call happened before the PHQ-9.
      const resBefore = evaluateHistory({
        rounds,
        phq9s,
        calls: [{ date: secondDate, position: 'before' }],
      });
      expect(resBefore.ok).toBe(true);
      if (!resBefore.ok) throw new Error(resBefore.error);
      expect(resBefore.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(resBefore.value.currentState.since).toBe(secondDate);

      // Case 2: Call placed AFTER everything on that date (after round closing and PHQ-9)
      // PHQ-9 raises warning, and call placed after clears the warning.
      const resAfter = evaluateHistory({
        rounds,
        phq9s,
        calls: [{ date: secondDate, position: 'after' }],
      });
      expect(resAfter.ok).toBe(true);
      if (!resAfter.ok) throw new Error(resAfter.error);
      expect(resAfter.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(resAfter.value.currentState.since).toBeNull();
    });

    it('two calls on one date', () => {
      // Two calls on the same date with the same position keep their input order,
      // and calls with position "before" and "after" on the same date bracket that date's round.
      const rounds = makeRounds(['low', 'low', 'low']);
      const secondDate = rounds[1].localDate;

      // Call 1 before round 2: resets prevRound (round 1 low) to null.
      // Round 2 (low) becomes first low round of a new run (small dip).
      // Call 2 after round 2: resets prevRound (round 2 low) to null.
      // Round 3 (low) is again the first low round (small dip, NOT a warning!).
      const res = evaluateHistory({
        rounds,
        calls: [
          { date: secondDate, position: 'before' },
          { date: secondDate, position: 'after' },
        ],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);
      expect(res.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);
      expect(res.value.effects.filter((e) => e.type === 'small_dip')).toHaveLength(3);
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);

      // Two calls with the same position on the same date keep input order
      const roundsWarn = makeRounds(['low', 'low']);
      const resTwoAfter = evaluateHistory({
        rounds: roundsWarn,
        calls: [
          { date: roundsWarn[1].localDate, position: 'after' },
          { date: roundsWarn[1].localDate, position: 'after' },
        ],
      });
      expect(resTwoAfter.ok).toBe(true);
      if (!resTwoAfter.ok) throw new Error(resTwoAfter.error);
      expect(resTwoAfter.value.currentState.isWarningWaitingForCall).toBe(false);
    });
  });

  describe('Baseline formation timing', () => {
    it('baseline completes in round 8: rounds 1-8 classified without baseline, round 9 classified with baseline', () => {
      // 9 answered rounds: first 8 have mood 4, interest 4. Round 9 has mood 2, interest 4.
      // With baseline of 4, drop of 2 is 'low'. Without baseline, mood 2 is not bottom option, so 'normal'.
      const specs: RoundInputSpec[] = [
        ...Array(8).fill('normal'),
        { kind: 'normal', mood: 2, interest: 4 }, // round 9
      ];
      const rounds = makeRounds(specs);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.tapBaseline.hasBaseline).toBe(true);
      expect(res.value.tapBaseline.mood).toBe(4);
      expect(res.value.tapBaseline.interest).toBe(4);

      // Round 8 was normal. Round 9 is evaluated WITH baseline (mood 4 - 2 = 2 drop -> low!)
      expect(res.value.rounds[7].kind).toBe('normal');
      expect(res.value.rounds[8].kind).toBe('low');
    });

    it('baseline completes in round 11 because three rounds were missed: rounds 1-11 classified without baseline', () => {
      // Rounds 1, 2, 3 answered (3 answered)
      // Round 4 missed
      // Rounds 5, 6, 7 answered (6 answered)
      // Rounds 8, 9 missed
      // Round 10 answered (7 answered)
      // Round 11 answered (8 answered -> completes baseline!)
      // Round 12 answered with mood 2, interest 4 (evaluated WITH baseline!)
      const specs: RoundInputSpec[] = [
        'normal', 'normal', 'normal',
        'missed',
        'normal', 'normal', 'normal',
        'missed', 'missed',
        'normal', // round 10: 7th answered
        { kind: 'normal', mood: 2, interest: 4 }, // round 11: 8th answered (must be classified WITHOUT baseline -> normal)
        { kind: 'normal', mood: 2, interest: 4 }, // round 12: classified WITH baseline -> low!
      ];
      const rounds = makeRounds(specs);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.tapBaseline.hasBaseline).toBe(true);
      // Round 11 is the 8th answered round: classified without baseline, so mood 2 is 'normal'
      expect(res.value.rounds[10].roundNumber).toBe(11);
      expect(res.value.rounds[10].kind).toBe('normal');

      // Round 12 has 8 prior answered rounds: classified WITH baseline, so drop of 2 is 'low'
      expect(res.value.rounds[11].roundNumber).toBe(12);
      expect(res.value.rounds[11].kind).toBe('low');
    });

    it('a person whose first eight answers are all at the bottom of the scale', () => {
      // All 8 rounds have mood 0, interest 0
      const rounds = makeRounds(
        Array(9).fill({ status: 'answered', mood: 0, interest: 0 }) as RoundInputSpec[]
      );
      // Round 9 has mood 1, interest 1
      rounds[8] = {
        ...rounds[8],
        mood: 1,
        interest: 1,
      };

      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.tapBaseline.hasBaseline).toBe(true);
      expect(res.value.tapBaseline.mood).toBe(0);
      expect(res.value.tapBaseline.interest).toBe(0);

      // Rounds 1-8 are low because bottom option 0 is low with or without baseline
      for (let i = 0; i < 8; i++) {
        expect(res.value.rounds[i].kind).toBe('low');
      }

      // Round 9 has mood 1, interest 1. Baseline is 0. Diff is 0 - 1 = -1 (not a drop).
      // Bottom option is 0, so 1 is not bottom option -> normal!
      expect(res.value.rounds[8].kind).toBe('normal');
    });

    it('fewer than eight answered rounds reports how many are still needed', () => {
      const rounds = makeRounds(['normal', 'missed', 'normal', 'normal']);
      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.tapBaseline.hasBaseline).toBe(false);
      expect(res.value.tapBaseline.mood).toBeNull();
      expect(res.value.tapBaseline.interest).toBeNull();
      expect(res.value.tapBaseline.answeredRoundsCount).toBe(3);
      expect(res.value.tapBaseline.roundsNeeded).toBe(5);
    });
  });

  describe('Validation and bad input refusal', () => {
    it('refuses null, non-object or non-array rounds', () => {
      expect(evaluateHistory(null).ok).toBe(false);
      expect(evaluateHistory({}).ok).toBe(false);
      expect(evaluateHistory({ rounds: 'invalid' }).ok).toBe(false);
    });

    it('refuses rounds out of order or with duplicate round numbers', () => {
      const rounds = makeRounds(['normal', 'normal']);
      // Duplicate round numbers
      const dupRounds = [rounds[0], { ...rounds[1], roundNumber: 1 }];
      expect(evaluateHistory({ rounds: dupRounds }).ok).toBe(false);

      // Round numbers out of order
      const outOfOrderRounds = [rounds[1], rounds[0]];
      expect(evaluateHistory({ rounds: outOfOrderRounds }).ok).toBe(false);
    });

    it('refuses duplicate round dates or dates out of order', () => {
      const rounds = makeRounds(['normal', 'normal']);
      // Duplicate date
      const dupDateRounds = [rounds[0], { ...rounds[1], localDate: rounds[0].localDate }];
      expect(evaluateHistory({ rounds: dupDateRounds }).ok).toBe(false);

      // Dates out of order
      const outOfOrderDates = [
        { ...rounds[0], localDate: '2026-02-01' },
        { ...rounds[1], localDate: '2026-01-01' },
      ];
      expect(evaluateHistory({ rounds: outOfOrderDates }).ok).toBe(false);
    });

    it('refuses invalid calendar date strings', () => {
      const rounds = [{ roundNumber: 1, localDate: '2026-02-31', status: 'answered' as const, mood: 2, interest: 2 }];
      expect(evaluateHistory({ rounds }).ok).toBe(false);
    });

    it('refuses invalid round status', () => {
      const rounds = [{ roundNumber: 1, localDate: '2026-01-01', status: 'completed' as unknown as RoundStatus }];
      expect(evaluateHistory({ rounds }).ok).toBe(false);
    });

    it('refuses answered round without mood or interest, or with non-integers or out-of-range values', () => {
      // missing mood
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'answered', interest: 4 }] }).ok).toBe(false);
      // mood out of range
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'answered', mood: 5, interest: 4 }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'answered', mood: -1, interest: 4 }] }).ok).toBe(false);
      // mood non-integer
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'answered', mood: 2.5, interest: 4 }] }).ok).toBe(false);
    });

    it('refuses missed or not_today round with scores present', () => {
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'missed', mood: 2 }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds: [{ roundNumber: 1, localDate: '2026-01-01', status: 'not_today', interest: 2 }] }).ok).toBe(false);
    });

    it('refuses invalid PHQ-9s: out of range total, invalid date, or out of order', () => {
      const rounds = makeRounds(['normal']);
      // total < 0 or > 27 or NaN
      expect(evaluateHistory({ rounds, phq9s: [{ date: '2026-01-01', total: -1 }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, phq9s: [{ date: '2026-01-01', total: 28 }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, phq9s: [{ date: '2026-01-01', total: NaN }] }).ok).toBe(false);
      // PHQ-9 dates out of order
      expect(evaluateHistory({
        rounds,
        phq9s: [
          { date: '2026-01-10', total: 5 },
          { date: '2026-01-05', total: 5 },
        ],
      }).ok).toBe(false);
    });

    it('refuses invalid calls: invalid date, invalid position, or old orderKey', () => {
      const rounds = makeRounds(['normal']);
      expect(evaluateHistory({ rounds, calls: [{ date: 'not-a-date', position: 'after' }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, calls: [{ date: '2026-01-05', position: 'invalid' as unknown as HistoryCall['position'] }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, calls: [{ date: '2026-01-05', position: 'between' as unknown as HistoryCall['position'] }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, calls: [{ date: '2026-01-05', position: 123 as unknown as HistoryCall['position'] }] }).ok).toBe(false);
      expect(evaluateHistory({ rounds, calls: [{ date: '2026-01-05', orderKey: 'after' } as unknown as HistoryCall] }).ok).toBe(false);
    });

    it('refuses a PHQ-9 or a call dated before the first round date, but accepts PHQ-9 on the first round date', () => {
      // First round is on '2026-01-05'
      const rounds = makeRounds(['normal', 'normal']);
      expect(rounds[0].localDate).toBe('2026-01-05');

      // PHQ-9 dated before first round
      const phq9Before = evaluateHistory({
        rounds,
        phq9s: [{ date: '2026-01-01', total: 5 }],
      });
      expect(phq9Before.ok).toBe(false);
      if (!phq9Before.ok) {
        expect(phq9Before.error).toMatch(/first round/i);
      }

      // Call dated before first round
      const callBefore = evaluateHistory({
        rounds,
        calls: [{ date: '2026-01-01', position: 'after' }],
      });
      expect(callBefore.ok).toBe(false);
      if (!callBefore.ok) {
        expect(callBefore.error).toMatch(/first round/i);
      }

      // PHQ-9 on the first round date is valid
      const phq9OnFirst = evaluateHistory({
        rounds,
        phq9s: [{ date: '2026-01-05', total: 5 }],
      });
      expect(phq9OnFirst.ok).toBe(true);
    });
  });

  describe('Changed config', () => {
    it('evaluates history under a custom config with different thresholds and reflects config version', () => {
      // Tap baseline: mood 4, interest 4.
      // Round 9: mood 2, interest 4 (diff 2).
      // Under default config (tapDropOne: 2), diff 2 is 'low'.
      // Under custom config (tapDropOne: 3, tapDropBoth: 2, version: 2), diff 2 is 'normal'!
      const rounds = makeRounds([
        ...Array(8).fill('normal'),
        { kind: 'normal', mood: 2, interest: 4 },
      ]);

      const resDefault = evaluateHistory({ rounds }, DEFAULT_RULE_CONFIG);
      expect(resDefault.ok).toBe(true);
      if (!resDefault.ok) throw new Error(resDefault.error);
      expect(resDefault.value.configVersion).toBe(1);
      expect(resDefault.value.rounds[8].kind).toBe('low');
      expect(resDefault.value.effects).toHaveLength(1);
      expect(resDefault.value.effects[0].type).toBe('small_dip');
      expect(resDefault.value.effects[0].version).toBe(1);

      const customConfig: RuleConfig = {
        ...DEFAULT_RULE_CONFIG,
        version: 2,
        tapDropOne: 3,
        tapDropBoth: 2,
      };

      const resCustom = evaluateHistory({ rounds }, customConfig);
      expect(resCustom.ok).toBe(true);
      if (!resCustom.ok) throw new Error(resCustom.error);
      expect(resCustom.value.configVersion).toBe(2);
      expect(resCustom.value.rounds[8].kind).toBe('normal');
      expect(resCustom.value.effects).toHaveLength(0);
    });
  });

  describe('Simulator demo story pin', () => {
    it('pins the simulator demo story: 4 weeks well, one low round followed by normal (small dip), then two rounds unanswered (silence warning with right since date and exactly one flag)', () => {
      // 4 weeks well = 8 normal rounds (rounds 1-8)
      // Round 9: one low round
      // Round 10: normal round (ends dip run, small dip was shown)
      // Round 11: unanswered (missed)
      // Round 12: unanswered (missed) -> raises silence warning with since = round 11 date!
      const specs: RoundInputSpec[] = [
        ...Array(8).fill('normal'),
        'low',
        'normal',
        'missed',
        'missed',
      ];
      const rounds = makeRounds(specs);

      const res = evaluateHistory({ rounds });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      const evalData = res.value;

      // 12 rounds total
      expect(evalData.rounds).toHaveLength(12);

      // Verify individual round kinds
      for (let i = 0; i < 8; i++) {
        expect(evalData.rounds[i].kind).toBe('normal');
      }
      expect(evalData.rounds[8].kind).toBe('low');
      expect(evalData.rounds[9].kind).toBe('normal');
      expect(evalData.rounds[10].kind).toBe('no_answer');
      expect(evalData.rounds[11].kind).toBe('no_answer');

      // Tap baseline established at round 8
      expect(evalData.tapBaseline.hasBaseline).toBe(true);
      expect(evalData.tapBaseline.mood).toBe(4);
      expect(evalData.tapBaseline.interest).toBe(4);

      // Effects: exactly 2 effects:
      // 1. small_dip caused by round 9
      // 2. warning (silence) caused by round 12 with since = round 11 date
      expect(evalData.effects).toHaveLength(2);

      expect(evalData.effects[0].type).toBe('small_dip');
      expect(evalData.effects[0].version).toBe(DEFAULT_RULE_CONFIG.version);
      expect(evalData.effects[0].causedBy).toEqual({
        type: 'round',
        roundNumber: 9,
        date: rounds[8].localDate,
      });

      expect(evalData.effects[1].type).toBe('warning');
      expect(evalData.effects[1].kind).toBe('silence');
      expect(evalData.effects[1].since).toBe(rounds[10].localDate); // round 11 date
      expect(evalData.effects[1].version).toBe(DEFAULT_RULE_CONFIG.version);
      expect(evalData.effects[1].causedBy).toEqual({
        type: 'round',
        roundNumber: 12,
        date: rounds[11].localDate,
      });

      // Current state: warning is waiting for a call since round 11 date
      expect(evalData.currentState.isWarningWaitingForCall).toBe(true);
      expect(evalData.currentState.waitingForCall).toBe(true);
      expect(evalData.currentState.since).toBe(rounds[10].localDate);

      // Exactly one clinic flag with area 'check_in' and since = round 11 date
      expect(evalData.flags).toEqual([
        {
          area: 'check_in',
          since: rounds[10].localDate,
        },
      ]);
    });
  });

  describe('Additional warning and clearing interactions', () => {
    it('a PHQ-9 warning cleared by a call and then a second PHQ-9 warning', () => {
      const rounds = makeRounds(['normal', 'normal', 'normal', 'normal', 'normal']);
      // Round 1 (normal) date: rounds[0].localDate
      // Round 3 (normal) date: rounds[2].localDate -> PHQ-9 of 10 raises first warning
      // Call after round 3 -> clears the warning
      // Round 5 (normal) date: rounds[4].localDate -> PHQ-9 of 11 raises second warning
      const phq9s: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 3 }, // baseline = 3
        { date: rounds[2].localDate, total: 10 }, // warning 1 (>= 10)
        { date: rounds[4].localDate, total: 11 }, // warning 2 (>= 10)
      ];
      const calls: HistoryCall[] = [
        { date: rounds[2].localDate, position: 'after' },
      ];

      const res = evaluateHistory({ rounds, phq9s, calls });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Two PHQ-9 warnings
      const warnings = res.value.effects.filter((e) => e.type === 'warning');
      expect(warnings).toHaveLength(2);
      expect(warnings[0].kind).toBe('phq9');
      expect(warnings[0].since).toBe(rounds[2].localDate);
      expect(warnings[1].kind).toBe('phq9');
      expect(warnings[1].since).toBe(rounds[4].localDate);

      // Warning is currently waiting for a call following the second PHQ-9
      expect(res.value.currentState.isWarningWaitingForCall).toBe(true);
      expect(res.value.currentState.since).toBe(rounds[4].localDate);
      expect(res.value.flags).toHaveLength(2);
    });

    it('a PHQ-9 warning while a run of one low round is open, then a call, then one low round (a small dip, not a warning)', () => {
      // Round 1 normal
      // Round 2 low -> raises small_dip, prevRound is low
      // On Round 2 date, PHQ-9 completes with 10 -> raises PHQ-9 warning, resets prevRound
      // Call on Round 2 date (after) -> clears active warning
      // Round 3 low -> fresh run: raises small dip, NOT a warning
      const rounds = makeRounds(['normal', 'low', 'low']);
      const phq9s: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 3 }, // baseline = 3
        { date: rounds[1].localDate, total: 10 }, // raises PHQ-9 warning
      ];
      const calls: HistoryCall[] = [
        { date: rounds[1].localDate, position: 'after' },
      ];

      const res = evaluateHistory({ rounds, phq9s, calls });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Effects: small_dip from round 2, warning (phq9) from round 2 PHQ-9, small_dip from round 3
      expect(res.value.effects).toHaveLength(3);
      expect(res.value.effects[0].type).toBe('small_dip');
      expect(res.value.effects[0].causedBy).toEqual({
        type: 'round',
        roundNumber: 2,
        date: rounds[1].localDate,
      });

      expect(res.value.effects[1].type).toBe('warning');
      expect(res.value.effects[1].kind).toBe('phq9');
      expect(res.value.effects[1].since).toBe(rounds[1].localDate);

      expect(res.value.effects[2].type).toBe('small_dip');
      expect(res.value.effects[2].causedBy).toEqual({
        type: 'round',
        roundNumber: 3,
        date: rounds[2].localDate,
      });

      // No warning waiting for call after round 3
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.currentState.since).toBeNull();
    });

    it('two PHQ-9s on different dates with a round between them', () => {
      // Round 1: normal, first PHQ-9 total 4
      // Round 2: normal (round between them)
      // Round 3: normal, second PHQ-9 total 5
      const rounds = makeRounds(['normal', 'normal', 'normal']);
      const phq9s: HistoryPhq9[] = [
        { date: rounds[0].localDate, total: 4 },
        { date: rounds[2].localDate, total: 5 },
      ];

      const res = evaluateHistory({ rounds, phq9s });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      expect(res.value.phq9Baseline).toEqual({ type: 'baseline', value: 4 });
      expect(res.value.effects).toEqual([]);
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.flags).toEqual([]);
    });

    it('rounds and a PHQ-9 while a warning waits (no effects), then a call', () => {
      // Rounds 1 & 2 missed -> silence warning raised at round 2
      // Round 3 low while warning waits -> no effect
      // Round 4 normal with PHQ-9 total 5 while warning waits -> no effect (establishes baseline, no warning)
      // Round 5 low while warning waits -> no effect
      // Call on round 5 date -> clears warning
      const rounds = makeRounds(['missed', 'missed', 'low', 'normal', 'low']);
      const phq9s: HistoryPhq9[] = [
        { date: rounds[3].localDate, total: 5 },
      ];
      const calls: HistoryCall[] = [
        { date: rounds[4].localDate, position: 'after' },
      ];

      const res = evaluateHistory({ rounds, phq9s, calls });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error(res.error);

      // Only 1 effect: the initial warning from round 2 (silence)
      expect(res.value.effects).toHaveLength(1);
      expect(res.value.effects[0].type).toBe('warning');
      expect(res.value.effects[0].kind).toBe('silence');
      expect(res.value.effects[0].since).toBe(rounds[0].localDate);

      // PHQ-9 established baseline
      expect(res.value.phq9Baseline).toEqual({ type: 'baseline', value: 5 });

      // Warning was cleared by call on round 5 date
      expect(res.value.currentState.isWarningWaitingForCall).toBe(false);
      expect(res.value.currentState.since).toBeNull();
      expect(res.value.flags).toHaveLength(1);
    });
  });
});
