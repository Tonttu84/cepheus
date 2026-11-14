/**
 * Domain types for experimental extra check-in items.
 *
 * NOTE: These items are experimental, modular additions using the team's own wording.
 * They are not a validated clinical instrument, and they never enter the clinical
 * warning rule or baseline calculations.
 */

export interface ExtraItem {
  readonly id: string;
  readonly topicKey: string;
  readonly topic: string;
  readonly question: string;
  readonly min: number;
  readonly max: number;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly isExperimental: boolean;
  readonly validatedInstrument: boolean;
  readonly wording: 'team';
  readonly isSelfHarm: boolean;
}

export interface ExtraItemsConfig {
  readonly version: number;
  readonly enabled: boolean;
  readonly items: readonly ExtraItem[];
}

export interface ExtraAnswer {
  readonly itemId: string;
  readonly value: number;
}
