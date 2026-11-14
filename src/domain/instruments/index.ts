export interface Phq9Item {
  id: string;
  topic: string;
  min: number;
  max: number;
  isSelfHarm: boolean;
}

export const PHQ9_ITEMS: Phq9Item[] = [
  { id: '1', topic: 'interest', min: 0, max: 3, isSelfHarm: false },
  { id: '2', topic: 'mood', min: 0, max: 3, isSelfHarm: false },
  { id: '3', topic: 'sleep', min: 0, max: 3, isSelfHarm: false },
  { id: '4', topic: 'energy', min: 0, max: 3, isSelfHarm: false },
  { id: '5', topic: 'appetite', min: 0, max: 3, isSelfHarm: false },
  { id: '6', topic: 'self_worth', min: 0, max: 3, isSelfHarm: false },
  { id: '7', topic: 'concentration', min: 0, max: 3, isSelfHarm: false },
  { id: '8', topic: 'psychomotor', min: 0, max: 3, isSelfHarm: false },
  { id: '9', topic: 'self_harm', min: 0, max: 3, isSelfHarm: true },
];

export interface TapItem {
  id: string;
  kind: 'mood' | 'interest';
  question: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

export const TAP_ITEMS: TapItem[] = [
  { id: 'tap_mood', kind: 'mood', question: 'How is your mood right now?', min: 0, max: 4, minLabel: 'very low', maxLabel: 'very good' },
  { id: 'tap_interest', kind: 'interest', question: 'How much do you feel like doing things right now?', min: 0, max: 4, minLabel: 'not at all', maxLabel: 'very much' },
];

export interface Phq9Answer {
  id: string;
  value: number;
}

export type TapKind = 'mood' | 'interest';

export interface TapAnswer {
  kind: TapKind;
  value: number;
}

export function scorePhq9(answers: Phq9Answer[]): number | null {
  if (!Array.isArray(answers)) return null;
  const validation = validatePhq9Answers(answers);
  if (!validation.ok) return null;
  if (validation.value.length !== 9) return null;
  return validation.value.reduce((sum, a) => sum + a.value, 0);
}

export function validatePhq9Answers(answers: unknown): { ok: true; value: Phq9Answer[] } | { ok: false; error: string } {
  if (!Array.isArray(answers)) return { ok: false, error: 'not an array' };
  const seenIds = new Set<string>();
  
  const validatedAnswers: Phq9Answer[] = [];

  for (const item of answers) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'invalid answer object' };
    const answer = item as Record<string, unknown>;
    if (typeof answer.id !== 'string') return { ok: false, error: 'invalid id' };
    
    const phq9Item = PHQ9_ITEMS.find((i) => i.id === answer.id);
    if (!phq9Item) return { ok: false, error: 'unknown item id' };

    if (seenIds.has(answer.id)) return { ok: false, error: 'duplicated item' };
    seenIds.add(answer.id);

    if (typeof answer.value !== 'number' || !Number.isInteger(answer.value)) return { ok: false, error: 'value is not an integer' };
    if (answer.value < phq9Item.min || answer.value > phq9Item.max) return { ok: false, error: 'value out of range' };

    validatedAnswers.push({ id: answer.id, value: answer.value });
  }
  
  return { ok: true, value: validatedAnswers };
}

export function validateTapAnswer(item: unknown): { ok: true; value: TapAnswer } | { ok: false; error: string } {
  if (!item || typeof item !== 'object') return { ok: false, error: 'invalid answer object' };
  const answer = item as Record<string, unknown>;
  
  const tapItem = TAP_ITEMS.find((i) => i.kind === answer.kind);
  if (!tapItem) return { ok: false, error: 'unknown kind' };

  if (typeof answer.value !== 'number' || !Number.isInteger(answer.value)) return { ok: false, error: 'value is not an integer' };
  if (answer.value < tapItem.min || answer.value > tapItem.max) return { ok: false, error: 'value out of range' };
  
  return { ok: true, value: { kind: tapItem.kind, value: answer.value } };
}
