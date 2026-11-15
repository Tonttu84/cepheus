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
    expect(parseSpokenChoice("   ", "tap")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("", "phq9")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("   ", "phq9")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("", "gad7")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("   ", "gad7")).toEqual({ kind: "unclear" });
    expect(parseSpokenChoice("maybe tomorrow morning", "tap")).toEqual({
      kind: "unclear",
    });
  });

  describe("scale parsing across tap, phq9, and gad7 (clear, unclear, out of range, empty)", () => {
    describe("tap scale (0..4)", () => {
      it("parses clear answers", () => {
        expect(parseSpokenChoice("0", "tap")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("zero", "tap")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("very low", "tap")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("1", "tap")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("one", "tap")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("low", "tap")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("2", "tap")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("two", "tap")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("okay", "tap")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("moderate", "tap")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("3", "tap")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("three", "tap")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("good", "tap")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("4", "tap")).toEqual({ kind: "score", value: 4 });
        expect(parseSpokenChoice("four", "tap")).toEqual({ kind: "score", value: 4 });
        expect(parseSpokenChoice("very good", "tap")).toEqual({ kind: "score", value: 4 });
      });

      it("returns unclear for ambiguous or negated answers", () => {
        expect(parseSpokenChoice("not good", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("2 or 3", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("maybe 4", "tap")).toEqual({ kind: "score", value: 4 });
      });

      it("returns unclear for out of range answers", () => {
        expect(parseSpokenChoice("5", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("five", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("10", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("-1", "tap")).toEqual({ kind: "unclear" });
      });

      it("returns unclear for empty input", () => {
        expect(parseSpokenChoice("", "tap")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("   ", "tap")).toEqual({ kind: "unclear" });
      });
    });

    describe("phq9 scale (0..3)", () => {
      it("parses clear answers", () => {
        expect(parseSpokenChoice("0", "phq9")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("zero", "phq9")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("not at all", "phq9")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("1", "phq9")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("one", "phq9")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("several days", "phq9")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("2", "phq9")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("two", "phq9")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("more than half the days", "phq9")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("3", "phq9")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("three", "phq9")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("nearly every day", "phq9")).toEqual({ kind: "score", value: 3 });
      });

      it("returns unclear for ambiguous or negated answers", () => {
        expect(parseSpokenChoice("not several days", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("1 or 2", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("sometimes", "phq9")).toEqual({ kind: "unclear" });
      });

      it("returns unclear for out of range answers (4 or higher)", () => {
        expect(parseSpokenChoice("4", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("four", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("5", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("ten", "phq9")).toEqual({ kind: "unclear" });
      });

      it("returns unclear for empty input", () => {
        expect(parseSpokenChoice("", "phq9")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("   ", "phq9")).toEqual({ kind: "unclear" });
      });
    });

    describe("gad7 scale (0..3)", () => {
      it("parses clear answers", () => {
        expect(parseSpokenChoice("0", "gad7")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("zero", "gad7")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("not at all", "gad7")).toEqual({ kind: "score", value: 0 });
        expect(parseSpokenChoice("1", "gad7")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("one", "gad7")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("several days", "gad7")).toEqual({ kind: "score", value: 1 });
        expect(parseSpokenChoice("2", "gad7")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("two", "gad7")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("more than half the days", "gad7")).toEqual({ kind: "score", value: 2 });
        expect(parseSpokenChoice("3", "gad7")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("three", "gad7")).toEqual({ kind: "score", value: 3 });
        expect(parseSpokenChoice("nearly every day", "gad7")).toEqual({ kind: "score", value: 3 });
      });

      it("returns unclear for ambiguous or negated answers", () => {
        expect(parseSpokenChoice("not several days", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("1 or 2", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("unclear feeling", "gad7")).toEqual({ kind: "unclear" });
      });

      it("returns unclear for out of range answers (4 or higher)", () => {
        expect(parseSpokenChoice("4", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("four", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("5", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("nine", "gad7")).toEqual({ kind: "unclear" });
      });

      it("returns unclear for empty input", () => {
        expect(parseSpokenChoice("", "gad7")).toEqual({ kind: "unclear" });
        expect(parseSpokenChoice("   ", "gad7")).toEqual({ kind: "unclear" });
      });
    });
  });
});
