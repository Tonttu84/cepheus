import type { SmallTask, TaskKey } from "./types";

export const DEFAULT_TASK_KEY: TaskKey = "short_walk";

export const TASK_CATALOGUE: Readonly<Record<TaskKey, SmallTask>> = Object.freeze({
  short_walk: {
    key: "short_walk",
    title: "Take a 10-minute walk outside",
    detail: "Step outside for a ten-minute walk at an easy pace.",
    effortTier: "low",
    researchPointer:
      "docs/research/3-state-shifters.md Table A, row 1 (Single bout of exercise / walk)",
  },
  breathing_space: {
    key: "breathing_space",
    title: "Take a 3-minute slow breathing pause",
    detail: "Sit comfortably and follow your natural breath for three minutes.",
    effortTier: "low",
    researchPointer:
      "docs/research/3-state-shifters.md Table A, row 4 (Brief mindful self-focus, incl. MBCT-style breathing space)",
  },
  bright_light: {
    key: "bright_light",
    title: "Sit by daylight or a bright window for 10 minutes",
    detail: "Spend ten quiet minutes near natural daylight or next to a bright window.",
    effortTier: "none",
    researchPointer:
      "docs/research/3-state-shifters.md Table A, row 8 (Bright light, single session)",
  },
  social_contact: {
    key: "social_contact",
    title: "Send one short message to someone you know",
    detail: "Send a brief hello or check-in message to a friend, family member, or trusted contact.",
    effortTier: "low",
    researchPointer:
      "docs/research/3-state-shifters.md Table A, row 12 (Brief social contact)",
  },
  pleasant_activity: {
    key: "pleasant_activity",
    title: "Spend a few minutes on a pleasant activity of your choice",
    detail: "Spend a few minutes on a small activity that you enjoy, chosen entirely by you.",
    effortTier: "low",
    researchPointer:
      "docs/research/3-state-shifters.md Table A, row 13 (Pleasant activity, as it happens in daily life)",
  },
});

export const TASK_LIST: readonly SmallTask[] = Object.freeze([
  TASK_CATALOGUE.short_walk,
  TASK_CATALOGUE.breathing_space,
  TASK_CATALOGUE.bright_light,
  TASK_CATALOGUE.social_contact,
  TASK_CATALOGUE.pleasant_activity,
]);

export function isValidTaskKey(key: string): key is TaskKey {
  return Object.prototype.hasOwnProperty.call(TASK_CATALOGUE, key);
}

export function getTaskByKey(key: TaskKey): SmallTask {
  const task = TASK_CATALOGUE[key];
  if (!task) {
    throw new Error(`Unknown task key: ${key}`);
  }
  return task;
}

/**
 * Resolves user preference keys into a list of tasks.
 * Rule 7: With no choice made, the short walk is offered.
 */
export function resolvePreferredTasks(
  preferredKeys?: readonly string[] | null
): readonly SmallTask[] {
  if (!preferredKeys || preferredKeys.length === 0) {
    return [TASK_CATALOGUE[DEFAULT_TASK_KEY]];
  }

  const validKeys: TaskKey[] = [];
  for (const k of preferredKeys) {
    if (isValidTaskKey(k) && !validKeys.includes(k)) {
      validKeys.push(k);
    }
  }

  if (validKeys.length === 0) {
    return [TASK_CATALOGUE[DEFAULT_TASK_KEY]];
  }

  // Preserve stable catalogue order for consistency
  return TASK_LIST.filter((t) => validKeys.includes(t.key));
}
