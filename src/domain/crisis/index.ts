import { PHQ9_ITEMS } from '../instruments';

export type CrisisResult = { ok: true; value: boolean } | { ok: false; error: string };

export function isCrisis(answer: { id: string; value: number }): CrisisResult {
  if (!answer || typeof answer !== 'object') {
    return { ok: false, error: 'invalid answer object' };
  }
  if (typeof answer.id !== 'string') {
    return { ok: false, error: 'invalid id' };
  }
  const item = PHQ9_ITEMS.find((i) => i.id === answer.id);
  if (!item) {
    return { ok: false, error: 'unknown item id' };
  }
  if (typeof answer.value !== 'number' || !Number.isInteger(answer.value)) {
    return { ok: false, error: 'value is not an integer' };
  }
  if (answer.value < item.min || answer.value > item.max) {
    return { ok: false, error: 'value out of range' };
  }
  return { ok: true, value: item.isSelfHarm && answer.value !== 0 };
}
