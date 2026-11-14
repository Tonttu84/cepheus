import { DEFAULT_ROUNDS_CONFIG } from "./config";
import type { RoundOutcome, RoundsConfig } from "./types";

/**
 * Ruling (a): Round 1 is a PHQ-9 round, and after that every fourth round
 * (two rounds a week, so every second week): rounds 1, 5, 9 and so on.
 * This schedule never shifts.
 */
export function isScheduledPhq9Round(
  roundNumber: number,
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): boolean {
  const initial = config.initialPhq9RoundNumber ?? DEFAULT_ROUNDS_CONFIG.initialPhq9RoundNumber;
  const interval = config.phq9IntervalRounds ?? DEFAULT_ROUNDS_CONFIG.phq9IntervalRounds;
  if (roundNumber < initial) {
    return false;
  }
  return (roundNumber - initial) % interval === 0;
}

function wasPhq9CompletedInRound(
  roundNumber: number,
  history: readonly RoundOutcome[]
): boolean {
  const outcome = history.find((h) => h.roundNumber === roundNumber);
  if (!outcome) {
    return false;
  }
  if (outcome.status !== "answered") {
    return false;
  }
  if (outcome.phq9Progress !== undefined) {
    return outcome.phq9Progress === "completed";
  }
  return outcome.phq9Completed === true;
}

/**
 * Requirement 3 & Ruling (b):
 * A PHQ-9 that was due and was not completed (unfinished, skipped with "Not today",
 * or missed) is due again in the next round, and again until it is completed.
 * If that lands on a scheduled PHQ-9 round, one PHQ-9 is due, not two.
 */
export function isPhq9Due(
  roundNumber: number,
  history: readonly RoundOutcome[],
  config: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): boolean {
  const initial = config.initialPhq9RoundNumber ?? DEFAULT_ROUNDS_CONFIG.initialPhq9RoundNumber;
  let carryOver = false;

  for (let k = initial; k < roundNumber; k++) {
    const isDueInRound = isScheduledPhq9Round(k, config) || carryOver;
    if (isDueInRound) {
      const completed = wasPhq9CompletedInRound(k, history);
      carryOver = !completed;
    }
  }

  return isScheduledPhq9Round(roundNumber, config) || carryOver;
}
