import { DEFAULT_ROUNDS_CONFIG } from '../rounds/config';
import { isScheduledPhq9Round } from '../rounds/phq9';
import type { RoundsConfig } from '../rounds/types';
import { DEFAULT_EXTRA_ITEMS_CONFIG } from './config';
import type { ExtraItem, ExtraItemsConfig } from './types';

/**
 * Determines which extra item, if any, a given round offers.
 *
 * Rules:
 * - None when disabled (`config.enabled === false`).
 * - None on a PHQ-9 round (rounds 1, 5, 9, 13, ...) so those rounds stay short.
 * - None for roundNumber < 1.
 * - Otherwise rotates through items in a fixed sequence by round number,
 *   so every patient gets the same item on the same round number and the
 *   choice is 100% deterministic and reproducible.
 */
export function getOfferedExtraItem(
  roundNumber: number,
  config: ExtraItemsConfig = DEFAULT_EXTRA_ITEMS_CONFIG,
  roundsConfig: Partial<RoundsConfig> = DEFAULT_ROUNDS_CONFIG
): ExtraItem | null {
  if (!config.enabled) {
    return null;
  }
  if (roundNumber < 1) {
    return null;
  }
  if (isScheduledPhq9Round(roundNumber, roundsConfig)) {
    return null;
  }
  if (!config.items || config.items.length === 0) {
    return null;
  }

  // Count non-PHQ-9 rounds prior to roundNumber
  let nonPhq9PriorRounds = 0;
  for (let r = 1; r < roundNumber; r++) {
    if (!isScheduledPhq9Round(r, roundsConfig)) {
      nonPhq9PriorRounds++;
    }
  }

  const index = nonPhq9PriorRounds % config.items.length;
  return config.items[index];
}
