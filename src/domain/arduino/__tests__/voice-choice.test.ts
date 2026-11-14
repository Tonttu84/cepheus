import { describe, expect, it } from "vitest";
import { parseSpokenChoice } from "../voice";

describe("Arduino Voice Kiosk Choice Parser (src/domain/arduino/voice)", () => {
  it("prioritizes crisis help keywords immediately", () => {
    expect(parseSpokenChoice("I need help please", "tap")).toEqual({
      kind: "crisis_help",
    });
    expect(parseSpokenChoice("call 112", "phq9")).toEqual({
      kind: "crisis_help",
    });
    expect(parseSpokenChoice("call one one two", "tap")).toEqual({
      kind: "crisis_help",
    });
  });

  it("maps not today / skip phrases without penalty", () => {
    expect(parseSpokenChoice("Not today, thanks.", "tap")).toEqual({
      kind: "not_today",
    });
    expect(parseSpokenChoice("skip", "phq9")).toEqual({ kind: "not_today" });
  });

  it("maps valid tap 0..4 and PHQ-9 0..3 labels and digits", () => {
    expect(parseSpokenChoice("very good", "tap")).toEqual({
      kind: "score",
      value: 4,
    });
    expect(parseSpokenChoice("okay", "tap")).toEqual({
      kind: "score",
      value: 2,
    });
    expect(parseSpokenChoice("not at all", "tap")).toEqual({
      kind: "score",
      value: 0,
    });
    expect(parseSpokenChoice("not at all", "phq9")).toEqual({
      kind: "score",
      value: 0,
    });
    expect(parseSpokenChoice("four", "tap")).toEqual({
      kind: "score",
      value: 4,
    });

    // PHQ-9 scale is 0..3 only; "four" is unclear
    expect(parseSpokenChoice("four", "phq9")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("More than half the days", "phq9")).toEqual({
      kind: "score",
      value: 2,
    });
    expect(parseSpokenChoice("several days", "phq9")).toEqual({
      kind: "score",
      value: 1,
    });
  });

  it("returns unclear for negated or mixed/ambiguous answers", () => {
    expect(parseSpokenChoice("not good", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("not very good", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("not three", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("no, four", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("ei hyvä", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("two or three", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("low or good", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("not at all good", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("0 or 1", "phq9")).toEqual({ kind: "unclear" });
  });

  it("does not false-trigger crisis or skip on substring collisions like helpful or passing", () => {
    expect(parseSpokenChoice("helpful", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("passing", "tap")).toEqual({ kind: "unclear" });
  });

  it("returns unclear for empty or unrelated speech without guessing", () => {
    expect(parseSpokenChoice("", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("maybe tomorrow morning", "tap")).toEqual({
      kind: "unclear",
    });
  });
});
