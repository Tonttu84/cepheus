/**
 * Pure domain types for Verda-hosted Gemma patient-step personalization
 * and nurse pre-call briefs.
 * Zero imports outside src/domain/.
 */

export const SAFE_ACTION_KEYS = [
  "short_walk",
  "breathing_space",
  "bright_light",
  "social_contact",
] as const;

export type SafeActionKey = (typeof SAFE_ACTION_KEYS)[number];

export interface ActionOutcomeSummary {
  readonly actionKey: SafeActionKey;
  readonly completedCount: number;
  readonly averageNextDelta: number | null;
}

export interface PatientStepInput {
  readonly participantCode: string;
  readonly dayIndex: number;
  readonly broadAreasShifted: readonly string[];
  readonly lowDaylight: boolean;
  readonly highStationaryBout: boolean;
  readonly pastActionOutcomes: readonly ActionOutcomeSummary[];
  readonly isSimulated: boolean;
}

export interface PatientStepOutput {
  readonly actionKey: SafeActionKey;
  readonly actionTitle: string;
  readonly message: string;
}

export interface NurseBriefMetric {
  readonly label: string;
  readonly valueText: string;
}

export interface NurseBriefInput {
  readonly participantCode: string;
  readonly sinceDate: string;
  readonly triggerKind: "sustained_dip" | "silence";
  readonly broadAreas: readonly string[];
  readonly ringActiveDuringSilence: boolean | null;
  readonly metrics: readonly NurseBriefMetric[];
  readonly isSimulated: boolean;
}

export interface NurseBriefOutput {
  readonly summary: string;
  readonly conversationOpeners: readonly string[];
}

export interface FaithfulnessCheckResult {
  readonly ok: boolean;
  readonly reason?: string;
}
