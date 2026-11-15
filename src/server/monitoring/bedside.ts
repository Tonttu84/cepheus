import { isCrisis } from "@/domain/crisis";
import { CRISIS_RESOURCES } from "@/lib/constants";

export type BedsideCheckInInput =
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "taps";
      readonly mood: number;
      readonly interest: number;
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "not_today";
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "phq9_item";
      readonly itemId: string;
      readonly value: number;
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "crisis_button";
    };

export interface BedsideCheckInOutcome {
  readonly ok: true;
  readonly kind: BedsideCheckInInput["kind"];
  readonly showCrisisPath: boolean;
  readonly crisisResources: typeof CRISIS_RESOURCES | null;
  readonly roundNumber: number | null;
  readonly source: string;
}

/**
 * True when the bedside input triggers the immediate crisis path:
 * physical crisis button or self-harm item 9 > 0.
 */
export function isCrisisBedsideInput(input: BedsideCheckInInput): boolean {
  if (input.kind === "crisis_button") return true;
  if (input.kind !== "phq9_item") return false;
  const res = isCrisis({ id: input.itemId, value: input.value });
  return res.ok && res.value === true;
}
