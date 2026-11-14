export type TaskKey =
  | "short_walk"
  | "breathing_space"
  | "bright_light"
  | "social_contact"
  | "pleasant_activity";

export type EffortTier = "none" | "low";

export interface SmallTask {
  readonly key: TaskKey;
  readonly title: string;
  readonly detail: string;
  readonly effortTier: EffortTier;
  readonly researchPointer: string;
}

export type TaskStatus = "offered" | "completed" | "not_today";

export type TaskSource = "self_report";

export interface TaskRecord {
  readonly id: string;
  readonly patientId: string;
  readonly localDate: string; // YYYY-MM-DD in patient's time zone
  readonly taskKey: TaskKey;
  readonly status: TaskStatus;
  readonly source: TaskSource;
  readonly completedAt?: string | null;
  readonly respondedAt?: string | null;
  readonly isSimulated: true;
}

export interface UserPreferences {
  readonly patientId: string;
  readonly preferredTaskKeys: readonly TaskKey[];
  readonly updatedAt: string;
}
