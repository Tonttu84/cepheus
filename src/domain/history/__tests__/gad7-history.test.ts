import { describe, it, expect } from 'vitest';
import { evaluateHistory } from '../evaluate';
import type { PatientHistory, HistoryRound } from '../types';

describe('GAD-7 in Patient History Evaluation', () => {
  const normalRounds: HistoryRound[] = [
    { roundNumber: 1, localDate: '2026-01-01', status: 'answered', mood: 3, interest: 3 },
    { roundNumber: 2, localDate: '2026-01-04', status: 'answered', mood: 3, interest: 3 },
    { roundNumber: 3, localDate: '2026-01-08', status: 'answered', mood: 3, interest: 3 },
    { roundNumber: 4, localDate: '2026-01-11', status: 'answered', mood: 3, interest: 3 },
  ];

  it('switch off: a GAD-7 total of 10 or more is ignored by the rule when switch is off', () => {
    // questionnaires not specified -> default: PHQ-9 only, GAD-7 off
    const historyNoSwitch: PatientHistory = {
      rounds: normalRounds,
      phq9s: [{ date: '2026-01-01', total: 3 }],
      gad7s: [{ date: '2026-01-01', total: 15 }], // high anxiety total
    };
    const resNoSwitch = evaluateHistory(historyNoSwitch);
    expect(resNoSwitch.ok).toBe(true);
    if (!resNoSwitch.ok) return;
    expect(resNoSwitch.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);

    // explicit questionnaires without gad7
    const historyExplicitOff: PatientHistory = {
      rounds: normalRounds,
      phq9s: [{ date: '2026-01-01', total: 3 }],
      gad7s: [{ date: '2026-01-01', total: 15 }],
      questionnaires: ['phq9'],
    };
    const resExplicitOff = evaluateHistory(historyExplicitOff);
    expect(resExplicitOff.ok).toBe(true);
    if (!resExplicitOff.ok) return;
    expect(resExplicitOff.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);
  });

  it('switch on: GAD-7 threshold edge (9 no warning, 10 warning) with right questionnaire named', () => {
    // 9 no warning
    const history9: PatientHistory = {
      rounds: normalRounds,
      gad7s: [{ date: '2026-01-01', total: 9 }],
      questionnaires: ['phq9', 'gad7'],
    };
    const res9 = evaluateHistory(history9);
    expect(res9.ok).toBe(true);
    if (!res9.ok) return;
    expect(res9.value.effects.filter((e) => e.type === 'warning')).toHaveLength(0);

    // 10 raises warning with right questionnaire named
    const history10: PatientHistory = {
      rounds: normalRounds,
      gad7s: [{ date: '2026-01-01', total: 10 }],
      questionnaires: ['phq9', 'gad7'],
    };
    const res10 = evaluateHistory(history10);
    expect(res10.ok).toBe(true);
    if (!res10.ok) return;
    const warnings = res10.value.effects.filter((e) => e.type === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('gad7');
    expect(warnings[0].since).toBe('2026-01-01');
    expect(warnings[0].causedBy).toEqual({
      type: 'gad7',
      date: '2026-01-01',
      total: 10,
    });
    expect(warnings[0].gad7Date).toBe('2026-01-01');
    expect(warnings[0].gad7Total).toBe(10);
  });

  it('lifecycle and repeats: GAD-7 behaves exactly like PHQ-9 on repeats and calls', () => {
    // Two high GAD-7 totals without call in between: only 1 warning raised
    const historyRepeats: PatientHistory = {
      rounds: normalRounds,
      gad7s: [
        { date: '2026-01-01', total: 11 },
        { date: '2026-01-08', total: 14 },
      ],
      questionnaires: ['phq9', 'gad7'],
    };
    const resRepeats = evaluateHistory(historyRepeats);
    expect(resRepeats.ok).toBe(true);
    if (!resRepeats.ok) return;
    expect(resRepeats.value.effects.filter((e) => e.type === 'warning')).toHaveLength(1);

    // Call recorded in between clears warning and allows second warning
    const historyWithCall: PatientHistory = {
      rounds: normalRounds,
      gad7s: [
        { date: '2026-01-01', total: 11 },
        { date: '2026-01-08', total: 14 },
      ],
      calls: [{ date: '2026-01-04', position: 'after' }],
      questionnaires: ['phq9', 'gad7'],
    };
    const resWithCall = evaluateHistory(historyWithCall);
    expect(resWithCall.ok).toBe(true);
    if (!resWithCall.ok) return;
    const warnings = resWithCall.value.effects.filter((e) => e.type === 'warning');
    expect(warnings).toHaveLength(2);
    expect(warnings[0].kind).toBe('gad7');
    expect(warnings[0].since).toBe('2026-01-01');
    expect(warnings[1].kind).toBe('gad7');
    expect(warnings[1].since).toBe('2026-01-08');
  });

  it('pure functions: evaluateHistory is pure and does not mutate its input', () => {
    const history: PatientHistory = {
      rounds: [
        { roundNumber: 1, localDate: '2026-01-01', status: 'answered', mood: 3, interest: 3 },
      ],
      gad7s: [{ date: '2026-01-01', total: 10 }],
      questionnaires: ['phq9', 'gad7'],
    };
    const inputCopy = JSON.parse(JSON.stringify(history));

    const res1 = evaluateHistory(history);
    const res2 = evaluateHistory(history);

    expect(res1).toEqual(res2);
    expect(history).toEqual(inputCopy);
  });
});
