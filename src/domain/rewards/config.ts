import type { RewardsConfig } from "./types";

export const DEFAULT_REWARDS_CONFIG: RewardsConfig = Object.freeze({
  enabled: true,
  answeredRoundRewardCents: 100,
  smallTaskRewardCents: 100,
  payoutThresholdCents: 1000,
  maxRewardedTasksPerLocalDay: 1,
});

export function validateRewardsConfig(config: RewardsConfig): void {
  const fields: Array<{ name: keyof RewardsConfig; value: unknown }> = [
    { name: "answeredRoundRewardCents", value: config.answeredRoundRewardCents },
    { name: "smallTaskRewardCents", value: config.smallTaskRewardCents },
    { name: "payoutThresholdCents", value: config.payoutThresholdCents },
    { name: "maxRewardedTasksPerLocalDay", value: config.maxRewardedTasksPerLocalDay },
  ];

  for (const field of fields) {
    if (typeof field.value !== "number" || !Number.isInteger(field.value) || field.value <= 0) {
      throw new Error(
        `Invalid config: ${String(field.name)} must be a positive integer whole cents, received ${String(field.value)}`
      );
    }
  }

  if (typeof config.enabled !== "boolean") {
    throw new Error("Invalid config: enabled must be a boolean");
  }
}
