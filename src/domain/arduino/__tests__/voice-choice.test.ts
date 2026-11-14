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
  });

  it("maps not today / skip phrases without penalty", () => {
    expect(parseSpokenChoice("Not today, thanks.", "tap")).toEqual({
      kind: "not_today",
    });
    expect(parseSpokenChoice("skip", "phq9")).toEqual({ kind: "not_today" });
  });

  it("maps tap choices 0..4 from phrases or numbers and rejects out-of-range PHQ-9 numbers", () => {
    expect(parseSpokenChoice("very good", "tap")).toEqual({
      kind: "score",
      value: 4,
    });
    expect(parseSpokenChoice("okay", "tap")).toEqual({
      kind: "score",
      value: 2,
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

  it("returns unclear for empty or unrelated speech without guessing", () => {
    expect(parseSpokenChoice("", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("maybe tomorrow morning", "tap")).toEqual({
      kind: "unclear",
    });
  });
});
