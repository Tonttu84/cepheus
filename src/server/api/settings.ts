import { DEFAULT_EXTRA_ITEMS_CONFIG } from "@/domain/extra-items";
import { DEFAULT_REWARDS_CONFIG } from "@/domain/rewards/config";

export type DemoSwitchKey =
  | "rewards"
  | "counters"
  | "extraQuestion"
  | "expressivityShowcase";

export interface DemoSwitches {
  readonly rewards: boolean;
  readonly counters: boolean;
  readonly extraQuestion: boolean;
  readonly expressivityShowcase: boolean;
}

function parseBooleanEnv(key: string, defaultValue: boolean): boolean {
  const val = process.env[key]?.trim();
  if (val === undefined || val === "") return defaultValue;
  return val.toLowerCase() === "true";
}

function computeDefaultDemoEnabled(): boolean {
  if (process.env.DEMO_SESSION_ENABLED !== undefined && process.env.DEMO_SESSION_ENABLED.trim() !== "") {
    return process.env.DEMO_SESSION_ENABLED.trim().toLowerCase() === "true";
  }
  return process.env.NODE_ENV !== "production";
}

function computeDefaultSwitches(): DemoSwitches {
  return {
    rewards: parseBooleanEnv("REWARDS_ENABLED", DEFAULT_REWARDS_CONFIG.enabled),
    counters: parseBooleanEnv("COUNTERS_ENABLED", false),
    extraQuestion: parseBooleanEnv("EXTRA_QUESTION_ENABLED", DEFAULT_EXTRA_ITEMS_CONFIG.enabled),
    expressivityShowcase: parseBooleanEnv("EXPRESSIVITY_SHOWCASE_ENABLED", false),
  };
}

let currentDemoEnabled = computeDefaultDemoEnabled();
let currentSwitches: DemoSwitches = computeDefaultSwitches();

export function isDemoEnabled(): boolean {
  return currentDemoEnabled;
}

export function setDemoEnabled(enabled: boolean): void {
  currentDemoEnabled = enabled;
}

export function getSwitches(): DemoSwitches {
  return { ...currentSwitches };
}

export function isRewardsEnabled(): boolean {
  return currentSwitches.rewards;
}

export function isCountersEnabled(): boolean {
  return currentSwitches.counters;
}

export function isExtraQuestionEnabled(): boolean {
  return currentSwitches.extraQuestion;
}

export function isExpressivityShowcaseEnabled(): boolean {
  return currentSwitches.expressivityShowcase;
}

export function setSwitch(key: DemoSwitchKey, enabled: boolean): void {
  currentSwitches = {
    ...currentSwitches,
    [key]: enabled,
  };
}

export function resetSettings(): void {
  currentDemoEnabled = computeDefaultDemoEnabled();
  currentSwitches = computeDefaultSwitches();
}
