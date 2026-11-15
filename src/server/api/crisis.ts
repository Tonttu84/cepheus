import { z } from "zod";
import { PHQ9_ITEMS } from "@/domain/instruments";

const SELF_HARM_ITEM_ID = PHQ9_ITEMS.find((item) => item.isSelfHarm)!.id;

const LooseAnswer = z.object({ itemId: z.union([z.string(), z.number()]), value: z.number() });

/**
 * True for a self-harm answer above 0, read from the raw body before it is
 * checked, so that the crisis path is shown even when the request is then
 * refused or invalid. Showing help to someone who did not need it costs
 * nothing; missing it does.
 */
export function isCrisisAnswer(raw: unknown): boolean {
  const answer = LooseAnswer.safeParse(raw);
  return answer.success && String(answer.data.itemId) === SELF_HARM_ITEM_ID && answer.data.value > 0;
}
