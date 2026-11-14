import type { Actor } from "../../domain/access/types";
import { decideRewardsAccess } from "../../domain/rewards/access";
import { DEFAULT_REWARDS_CONFIG, validateRewardsConfig } from "../../domain/rewards/config";
import type { RewardsConfig } from "../../domain/rewards/types";
import { isValidTaskKey, resolvePreferredTasks } from "../../domain/small-tasks/catalogue";
import type { TaskKey } from "../../domain/small-tasks/types";
import type { PreferencesResult, RewardsPorts, UseCaseResult } from "./ports";

export interface ReadPreferencesInput {
  readonly patientId: string;
}

export interface SetPreferencesInput {
  readonly patientId: string;
  readonly preferredTaskKeys: readonly TaskKey[];
}

export async function readPreferences(
  actor: Actor,
  input: ReadPreferencesInput,
  ports: RewardsPorts
): Promise<UseCaseResult<PreferencesResult>> {
  const config: RewardsConfig = {
    ...DEFAULT_REWARDS_CONFIG,
    ...ports.config,
  };
  validateRewardsConfig(config);

  if (!config.enabled) {
    return { ok: false, error: "not enabled" };
  }

  if (!input || !input.patientId || typeof input.patientId !== "string") {
    return { ok: false, error: "Invalid patientId" };
  }

  const access = decideRewardsAccess(actor, input.patientId);
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  const stored = await ports.preferences.getPreferences(input.patientId);
  const preferredTaskKeys = stored ?? [];
  const effectiveTasks = resolvePreferredTasks(preferredTaskKeys);

  return {
    ok: true,
    value: {
      patientId: input.patientId,
      preferredTaskKeys,
      effectiveTasks,
    },
  };
}

export async function setPreferences(
  actor: Actor,
  input: SetPreferencesInput,
  ports: RewardsPorts
): Promise<UseCaseResult<PreferencesResult>> {
  const config: RewardsConfig = {
    ...DEFAULT_REWARDS_CONFIG,
    ...ports.config,
  };
  validateRewardsConfig(config);

  if (!config.enabled) {
    return { ok: false, error: "not enabled" };
  }

  if (!input || !input.patientId || typeof input.patientId !== "string") {
    return { ok: false, error: "Invalid patientId" };
  }

  if (!Array.isArray(input.preferredTaskKeys)) {
    return { ok: false, error: "preferredTaskKeys must be an array" };
  }

  for (const k of input.preferredTaskKeys) {
    if (!isValidTaskKey(k)) {
      return { ok: false, error: `Invalid task key: ${String(k)}` };
    }
  }

  const access = decideRewardsAccess(actor, input.patientId);
  if (!access.allowed) {
    return { ok: false, error: access.reason };
  }

  // Deduplicate keys preserving order
  const uniqueKeys: TaskKey[] = [];
  for (const k of input.preferredTaskKeys) {
    if (!uniqueKeys.includes(k)) {
      uniqueKeys.push(k);
    }
  }

  await ports.unitOfWork.execute(async () => {
    await ports.preferences.savePreferences(input.patientId, uniqueKeys);
  });

  const effectiveTasks = resolvePreferredTasks(uniqueKeys);

  return {
    ok: true,
    value: {
      patientId: input.patientId,
      preferredTaskKeys: uniqueKeys,
      effectiveTasks,
    },
  };
}
