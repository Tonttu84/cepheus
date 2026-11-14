import { describe, expect, it } from "vitest";
import { InMemoryAnswerStore } from "../answer-store";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("In-memory answer store", () => {
  it("keeps answers apart by patient, questionnaire kind and round", () => {
    const store = new InMemoryAnswerStore();
    store.set("p1", "phq9", 1, [{ id: "1", value: 1 }]);
    store.set("p1", "phq9", 2, [{ id: "1", value: 2 }]);
    store.set("p1", "gad7", 1, [{ id: "1", value: 3 }]);
    store.set("p2", "phq9", 1, [{ id: "1", value: 0 }]);

    expect(store.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 1 }]);
    expect(store.get("p1", "phq9", 2)).toEqual([{ id: "1", value: 2 }]);
    expect(store.get("p1", "gad7", 1)).toEqual([{ id: "1", value: 3 }]);
    expect(store.get("p2", "phq9", 1)).toEqual([{ id: "1", value: 0 }]);
    expect(store.get("p3", "phq9", 1)).toBeUndefined();
  });

  it("does not mix up patients whose identifiers contain the separator of another key", () => {
    const store = new InMemoryAnswerStore();
    store.set("a:phq9", "phq9", 1, [{ id: "1", value: 1 }]);
    expect(store.get("a", "phq9", 1)).toBeUndefined();
  });

  it("forgets an entry once it is deleted", () => {
    const store = new InMemoryAnswerStore();
    store.set("p1", "phq9", 1, [{ id: "1", value: 3 }]);
    store.delete("p1", "phq9", 1);
    expect(store.get("p1", "phq9", 1)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("drops an entry older than 14 days when read", () => {
    let now = 1_000_000_000_000;
    const store = new InMemoryAnswerStore(() => now);
    store.set("p1", "phq9", 1, [{ id: "1", value: 2 }]);
    now += 14 * DAY_MS;
    expect(store.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 2 }]);
    now += 1;
    expect(store.get("p1", "phq9", 1)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("drops entries older than 14 days when another entry is written", () => {
    let now = 1_000_000_000_000;
    const store = new InMemoryAnswerStore(() => now);
    store.set("old", "phq9", 1, [{ id: "1", value: 1 }]);
    now += 15 * DAY_MS;
    store.set("new", "gad7", 2, [{ id: "2", value: 3 }]);
    expect(store.size()).toBe(1);
    expect(store.get("new", "gad7", 2)).toEqual([{ id: "2", value: 3 }]);
  });

  it("counts the 14 days from the last write of an entry", () => {
    let now = 1_000_000_000_000;
    const store = new InMemoryAnswerStore(() => now);
    store.set("p1", "phq9", 1, [{ id: "1", value: 1 }]);
    now += 10 * DAY_MS;
    store.set("p1", "phq9", 1, [{ id: "1", value: 1 }, { id: "2", value: 2 }]);
    now += 10 * DAY_MS;
    expect(store.get("p1", "phq9", 1)).toHaveLength(2);
  });

  it("keeps its own copy, so changing the caller's array or the returned one changes nothing", () => {
    const store = new InMemoryAnswerStore();
    const answers = [{ id: "1", value: 2 }];
    store.set("p1", "phq9", 1, answers);
    answers.push({ id: "2", value: 3 });
    expect(store.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 2 }]);
  });
});

describe("Staged answer changes (one unit of work)", () => {
  it("shows a staged write to its own reads and to the shared store only after commit", () => {
    const store = new InMemoryAnswerStore();
    const staged = store.stage();
    staged.set("p1", "phq9", 1, [{ id: "1", value: 2 }]);

    expect(staged.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 2 }]);
    expect(store.get("p1", "phq9", 1)).toBeUndefined();

    staged.commit();
    expect(store.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 2 }]);
  });

  it("hides a staged delete from its own reads and deletes from the shared store only after commit", () => {
    const store = new InMemoryAnswerStore();
    store.set("p1", "phq9", 1, [{ id: "1", value: 2 }]);
    const staged = store.stage();
    staged.delete("p1", "phq9", 1);

    expect(staged.get("p1", "phq9", 1)).toBeUndefined();
    expect(store.get("p1", "phq9", 1)).toEqual([{ id: "1", value: 2 }]);

    staged.commit();
    expect(store.get("p1", "phq9", 1)).toBeUndefined();
  });

  it("leaves the shared store untouched when the staged changes are never committed", () => {
    const store = new InMemoryAnswerStore();
    store.set("p1", "gad7", 2, [{ id: "1", value: 1 }]);
    const staged = store.stage();
    staged.set("p1", "gad7", 2, [{ id: "1", value: 1 }, { id: "2", value: 3 }]);
    staged.delete("p1", "gad7", 2);
    staged.set("p2", "phq9", 1, [{ id: "1", value: 0 }]);

    expect(store.get("p1", "gad7", 2)).toEqual([{ id: "1", value: 1 }]);
    expect(store.size()).toBe(1);
  });

  it("reads through to the shared store for keys it has not changed", () => {
    const store = new InMemoryAnswerStore();
    store.set("p1", "phq9", 1, [{ id: "1", value: 1 }]);
    expect(store.stage().get("p1", "phq9", 1)).toEqual([{ id: "1", value: 1 }]);
  });
});
