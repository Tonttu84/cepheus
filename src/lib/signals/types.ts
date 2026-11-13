import type { BroadAreaKey } from "../constants";

export interface PersonalBaselineStats {
  metricName: string;
  windowStartDate: string;
  windowEndDate: string;
  sampleCount: number;
  mean: number;
  sd: number;
  median?: number | null;
  iqr?: number | null;
}

export interface CircadianMetrics {
  m10: number;
  l5: number;
  relativeAmplitude: number;
  interdailyStability: number;
  intradailyVariability: number;
  sri: number | null;
  sleepMidpointSdMin: number | null;
}

export type RoutingRoute =
  | "none"
  | "patient_suggestion"
  | "clinic_flag"
  | "crisis_immediate";

export interface RoutingEvaluation {
  route: RoutingRoute;
  broadAreas: BroadAreaKey[];
  reason: string;
  triggerKind?: "sustained_dip" | "silence" | "crisis_self_harm" | "small_dip";
  ringActiveDuringSilence?: boolean | null;
}
