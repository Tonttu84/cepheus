export function getRewardsSettings() {
  const rewards = process.env.REWARDS_ENABLED;
  const counters = process.env.REWARDS_COUNTERS_ENABLED;
  return {
    rewardsEnabled: rewards ? rewards.toLowerCase() !== "false" : true,
    countersEnabled: counters ? counters.toLowerCase() !== "false" : true,
  };
}
