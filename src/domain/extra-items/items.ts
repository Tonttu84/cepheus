import type { ExtraItem } from './types';

/**
 * Experimental extra check-in items.
 *
 * NOTE: These items use the team's own wording and are NOT a validated clinical
 * instrument (unlike PHQ-9). They are experimental, optional, modular, and not
 * load-bearing for the clinical warning rule.
 * None of these items asks about mood or self-harm.
 * Higher scores always represent the better state, consistent with the core taps.
 */
export const EXTRA_ITEMS: readonly ExtraItem[] = Object.freeze([
  {
    id: 'extra_sleep',
    topicKey: 'sleep',
    topic: 'sleep',
    question: 'How well did you sleep last night?',
    min: 0,
    max: 4,
    minLabel: 'very badly',
    maxLabel: 'very well',
    isExperimental: true,
    validatedInstrument: false,
    wording: 'team',
    isSelfHarm: false,
  },
  {
    id: 'extra_energy',
    topicKey: 'energy',
    topic: 'energy',
    question: 'How much energy do you have right now?',
    min: 0,
    max: 4,
    minLabel: 'none',
    maxLabel: 'a lot',
    isExperimental: true,
    validatedInstrument: false,
    wording: 'team',
    isSelfHarm: false,
  },
  {
    id: 'extra_getting_out',
    topicKey: 'getting_out',
    topic: 'getting_out',
    question: 'Have you been outside your home today?',
    min: 0,
    max: 4,
    minLabel: 'not at all',
    maxLabel: 'a lot',
    isExperimental: true,
    validatedInstrument: false,
    wording: 'team',
    isSelfHarm: false,
  },
]);

export function getExtraItemById(
  id: string,
  items: readonly ExtraItem[] = EXTRA_ITEMS
): ExtraItem | null {
  return items.find((item) => item.id === id) ?? null;
}
