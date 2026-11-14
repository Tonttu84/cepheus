import { describe, expect, it } from 'vitest';
import { buildPhq9DueHistory, getExistingSubmission } from '../shared';
import type { StoredPhq9, StoredRound } from '../ports';

describe('Shared Usecase Helpers (Point 4)', () => {
  it('getExistingSubmission returns answer submission when answered', () => {
    const round: StoredRound = {
      patientId: 'p1',
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'answered',
      mood: 3,
      interest: 2,
    };
    expect(getExistingSubmission(round)).toEqual({
      kind: 'answer',
      mood: 3,
      interest: 2,
    });
  });

  it('getExistingSubmission returns not_today submission when not_today', () => {
    const round: StoredRound = {
      patientId: 'p1',
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'not_today',
    };
    expect(getExistingSubmission(round)).toEqual({
      kind: 'not_today',
    });
  });

  it('getExistingSubmission returns null when round is null or missed/open', () => {
    expect(getExistingSubmission(null)).toBeNull();
    const missedRound: StoredRound = {
      patientId: 'p1',
      roundNumber: 1,
      localDate: '2026-11-16',
      status: 'missed',
    };
    expect(getExistingSubmission(missedRound)).toBeNull();
  });

  it('buildPhq9DueHistory builds outcomes for all rounds before maxRoundNumber', () => {
    const storedRounds: StoredRound[] = [
      { patientId: 'p1', roundNumber: 1, localDate: '2026-11-16', status: 'answered' },
      { patientId: 'p1', roundNumber: 2, localDate: '2026-11-19', status: 'missed' },
    ];
    const storedPhq9s: StoredPhq9[] = [
      {
        patientId: 'p1',
        roundNumber: 1,
        progress: 'completed',
        answers: [],
        completedInRoundNumber: 1,
      },
    ];

    const outcomes = buildPhq9DueHistory(3, storedRounds, storedPhq9s);
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]).toEqual({
      roundNumber: 1,
      status: 'answered',
      phq9Completed: true,
      phq9Progress: 'completed',
    });
    expect(outcomes[1]).toEqual({
      roundNumber: 2,
      status: 'missed',
      phq9Completed: false,
      phq9Progress: undefined,
    });
  });
});
