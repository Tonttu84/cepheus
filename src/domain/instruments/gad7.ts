/**
 * Pure domain definitions and validation for the GAD-7 anxiety questionnaire.
 *
 * Unlike the PHQ-9, the GAD-7 has no self-harm item, so nothing here raises
 * the crisis path.
 */

export interface Gad7Item {
  id: string;
  topic: string;
  min: number;
  max: number;
  isSelfHarm: false;
}

export const GAD7_ITEMS: readonly Gad7Item[] = [
  { id: '1', topic: 'nervous', min: 0, max: 3, isSelfHarm: false },
  { id: '2', topic: 'control_worry', min: 0, max: 3, isSelfHarm: false },
  { id: '3', topic: 'excessive_worry', min: 0, max: 3, isSelfHarm: false },
  { id: '4', topic: 'relaxing', min: 0, max: 3, isSelfHarm: false },
  { id: '5', topic: 'restless', min: 0, max: 3, isSelfHarm: false },
  { id: '6', topic: 'irritable', min: 0, max: 3, isSelfHarm: false },
  { id: '7', topic: 'afraid', min: 0, max: 3, isSelfHarm: false },
];

export interface Gad7Answer {
  id: string;
  value: number;
}

export type Gad7ValidationResult =
  | { ok: true; value: Gad7Answer[] }
  | { ok: false; error: string };

function validateSingleAnswer(
  item: unknown,
  seenIds: Set<string>
): { ok: true; value: Gad7Answer } | { ok: false; error: string } {
  if (!item || typeof item !== 'object') {
    return { ok: false, error: 'invalid answer object' };
  }
  const answer = item as Record<string, unknown>;
  if (typeof answer.id !== 'string') {
    return { ok: false, error: 'invalid id' };
  }
  const gad7Item = GAD7_ITEMS.find((i) => i.id === answer.id);
  if (!gad7Item) {
    return { ok: false, error: 'unknown item id' };
  }
  if (seenIds.has(answer.id)) {
    return { ok: false, error: 'duplicated item' };
  }
  if (answer.value === undefined || answer.value === null) {
    return { ok: false, error: 'missing value' };
  }
  if (typeof answer.value !== 'number' || !Number.isInteger(answer.value)) {
    return { ok: false, error: 'value is not an integer' };
  }
  if (answer.value < gad7Item.min || answer.value > gad7Item.max) {
    return { ok: false, error: 'value out of range' };
  }
  return { ok: true, value: { id: answer.id, value: answer.value } };
}

export function validateGad7Answers(answers: unknown): Gad7ValidationResult {
  if (!Array.isArray(answers)) {
    return { ok: false, error: 'not an array' };
  }
  if (answers.length < 7) {
    return { ok: false, error: 'missing answers: expected exactly 7' };
  }
  if (answers.length > 7) {
    return { ok: false, error: 'extra answers: expected exactly 7' };
  }

  const seenIds = new Set<string>();
  const validatedAnswers: Gad7Answer[] = [];

  for (const item of answers) {
    const res = validateSingleAnswer(item, seenIds);
    if (!res.ok) {
      return res;
    }
    seenIds.add(res.value.id);
    validatedAnswers.push(res.value);
  }

  if (seenIds.size !== 7) {
    return { ok: false, error: 'missing items: expected all 7 GAD-7 items' };
  }

  return { ok: true, value: validatedAnswers };
}

export function scoreGad7(answers: unknown): number | null {
  if (!Array.isArray(answers)) return null;
  const validation = validateGad7Answers(answers);
  if (!validation.ok) return null;
  return validation.value.reduce((sum, a) => sum + a.value, 0);
}

export const computeGad7Total = scoreGad7;
export const calculateGad7Total = scoreGad7;
