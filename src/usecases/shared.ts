import type { RoundOutcome, Submission } from '../domain/rounds';
import type { StoredPhq9, StoredRound } from './ports';

/**
 * Builds the round outcome history needed to check whether PHQ-9 is due in a round.
 */
export function buildPhq9DueHistory(
  maxRoundNumber: number,
  storedRounds: readonly StoredRound[],
  storedPhq9s: readonly StoredPhq9[]
): RoundOutcome[] {
  const history: RoundOutcome[] = [];
  for (let r = 1; r < maxRoundNumber; r++) {
    const prev = storedRounds.find((sr) => sr.roundNumber === r);
    const phq9InRound = storedPhq9s.find(
      (p) => p.completedInRoundNumber === r || (p.roundNumber === r && p.progress === 'completed')
    );
    history.push({
      roundNumber: r,
      status: prev?.status ?? 'missed',
      phq9Completed: phq9InRound?.progress === 'completed',
      phq9Progress: phq9InRound ? phq9InRound.progress : undefined,
    });
  }
  return history;
}

/**
 * Finds an existing submission from a stored round record for tap/not-today operations.
 */
export function getExistingSubmission(round: StoredRound | null): Submission | null {
  if (round?.status === 'answered') {
    return { kind: 'answer', mood: round.mood ?? 0, interest: round.interest ?? 0 };
  }
  if (round?.status === 'not_today') {
    return { kind: 'not_today' };
  }
  return null;
}
