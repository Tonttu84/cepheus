import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_KEY,
  TASK_CATALOGUE,
  TASK_LIST,
  getTaskByKey,
  isValidTaskKey,
  resolvePreferredTasks,
} from "../catalogue";
import type { TaskKey } from "../types";

describe("Small Tasks Catalogue (Rule 6)", () => {
  it("contains the required tasks from docs/research/3-state-shifters.md Table A", () => {
    const keys = TASK_LIST.map((t) => t.key);
    expect(keys).toContain("short_walk");
    expect(keys).toContain("breathing_space");
    expect(keys).toContain("bright_light");
    expect(keys).toContain("social_contact");
    expect(keys).toContain("pleasant_activity");
    expect(keys.length).toBe(5);
  });

  it("does NOT include positive memory recall, cold water, music, or unproven/risky items", () => {
    const allKeys = Object.keys(TASK_CATALOGUE);
    expect(allKeys).not.toContain("positive_memory");
    expect(allKeys).not.toContain("cold_water");
    expect(allKeys).not.toContain("music");
    expect(allKeys).not.toContain("smell");
    expect(allKeys).not.toContain("touch");
    expect(allKeys).not.toContain("cognitive_reappraisal");
  });

  it("rates every task as low or none effort", () => {
    for (const task of TASK_LIST) {
      expect(["none", "low"]).toContain(task.effortTier);
    }
  });

  it("provides a pointer to the research table row for each task", () => {
    for (const task of TASK_LIST) {
      expect(task.researchPointer).toBeDefined();
      expect(task.researchPointer).toContain("docs/research/3-state-shifters.md Table A");
    }
  });

  it("uses short plain titles and one sentence of detail without treatment claims", () => {
    const forbiddenPhrases = [
      /will cure/i,
      /treats/i,
      /fixes/i,
      /will improve your depression/i,
      /heals/i,
      /relieves your depression/i,
    ];

    for (const task of TASK_LIST) {
      expect(task.title.length).toBeLessThan(80);
      expect(task.detail.length).toBeGreaterThan(10);
      expect(task.detail.length).toBeLessThan(150);

      // Verify detail is a single sentence (ends with a period and contains no other periods)
      const trimmed = task.detail.trim();
      expect(trimmed.endsWith(".")).toBe(true);
      const internalPeriods = trimmed.slice(0, -1).includes(".");
      expect(internalPeriods).toBe(false);

      for (const pattern of forbiddenPhrases) {
        expect(task.detail).not.toMatch(pattern);
        expect(task.title).not.toMatch(pattern);
      }
    }
  });

  it("validates task keys correctly", () => {
    expect(isValidTaskKey("short_walk")).toBe(true);
    expect(isValidTaskKey("breathing_space")).toBe(true);
    expect(isValidTaskKey("cold_water")).toBe(false);
    expect(isValidTaskKey("unknown_action")).toBe(false);
  });

  it("retrieves tasks by key", () => {
    const task = getTaskByKey("short_walk");
    expect(task.key).toBe("short_walk");
    expect(task.title).toContain("walk");
  });

  it("throws error for non-existent task key", () => {
    expect(() => getTaskByKey("non_existent" as unknown as TaskKey)).toThrow(/Unknown task key/);
  });

  it("defaults to short_walk when no preference is chosen", () => {
    expect(DEFAULT_TASK_KEY).toBe("short_walk");
    const emptyResult = resolvePreferredTasks([]);
    expect(emptyResult.length).toBe(1);
    expect(emptyResult[0].key).toBe("short_walk");

    const nullResult = resolvePreferredTasks(null);
    expect(nullResult.length).toBe(1);
    expect(nullResult[0].key).toBe("short_walk");
  });

  it("resolves a user-selected subset of preferred tasks", () => {
    const selection: TaskKey[] = ["breathing_space", "bright_light"];
    const resolved = resolvePreferredTasks(selection);
    expect(resolved.map((t) => t.key)).toEqual(["breathing_space", "bright_light"]);
  });
});
