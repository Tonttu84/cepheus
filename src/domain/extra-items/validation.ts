import type { ExtraAnswer, ExtraItem } from './types';

export function validateExtraAnswer(
  answer: unknown,
  offeredItem: ExtraItem | null
): { ok: true; value: ExtraAnswer } | { ok: false; error: string } {
  if (!offeredItem) {
    return { ok: false, error: 'No extra item offered for this round' };
  }
  if (!answer || typeof answer !== 'object') {
    return { ok: false, error: 'Invalid answer object' };
  }

  const ans = answer as Record<string, unknown>;
  if (typeof ans.itemId !== 'string' || ans.itemId !== offeredItem.id) {
    return { ok: false, error: 'Item not offered for this round' };
  }

  if (typeof ans.value !== 'number' || !Number.isInteger(ans.value)) {
    return { ok: false, error: 'Answer value must be an integer' };
  }

  if (ans.value < offeredItem.min || ans.value > offeredItem.max) {
    return { ok: false, error: 'Answer value out of range' };
  }

  return { ok: true, value: { itemId: offeredItem.id, value: ans.value } };
}
