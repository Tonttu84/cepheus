import { describe, expect, it, vi } from "vitest";
import { processQuestionAnswer } from "../question-input";

describe("QuestionInput answer processing (question-input.ts)", () => {
  it("processes a valid numeric tap answer and sends only the parsed score", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "3",
      mode: "tap",
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).toHaveBeenCalledWith(3);
    expect(onUnclearHint).not.toHaveBeenCalled();
  });

  it("processes a natural text phrase for PHQ-9 and sends only the parsed score", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "several days",
      mode: "phq9",
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).toHaveBeenCalledWith(1);
    expect(onUnclearHint).not.toHaveBeenCalled();
  });

  it("processes a natural text phrase for GAD-7 and sends only the parsed score", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "more than half the days",
      mode: "gad7",
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).toHaveBeenCalledWith(2);
    expect(onUnclearHint).not.toHaveBeenCalled();
  });

  it("asks again with a neutral hint when answer cannot be parsed (unclear)", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "maybe two or three",
      mode: "tap",
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(onUnclearHint).toHaveBeenCalledWith(
      expect.stringContaining("Could not understand answer. Please enter a number from 0 to 4")
    );
  });

  it("asks again with neutral hint when out of range value is provided", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "4",
      mode: "phq9", // PHQ-9 max is 3
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(onUnclearHint).toHaveBeenCalledWith(
      expect.stringContaining("Could not understand answer. Please enter a number from 0 to 3")
    );
  });

  it("immediately triggers crisis path when PHQ-9 item 9 is answered > 0 by text or voice", () => {
    const onSelectScore = vi.fn();
    const onCrisisHelp = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "1",
      mode: "phq9",
      itemId: "9",
      callbacks: {
        onSelectScore,
        onCrisisHelp,
        onUnclearHint,
      },
    });

    expect(onCrisisHelp).toHaveBeenCalled();
    expect(onSelectScore).toHaveBeenCalledWith(1);
  });

  it("does not trigger crisis path when PHQ-9 item 9 is answered 0", () => {
    const onSelectScore = vi.fn();
    const onCrisisHelp = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "0",
      mode: "phq9",
      itemId: "9",
      callbacks: {
        onSelectScore,
        onCrisisHelp,
        onUnclearHint,
      },
    });

    expect(onCrisisHelp).not.toHaveBeenCalled();
    expect(onSelectScore).toHaveBeenCalledWith(0);
  });

  it("triggers crisis path immediately on explicit crisis keywords during any question", () => {
    const onSelectScore = vi.fn();
    const onCrisisHelp = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "call 112",
      mode: "tap",
      callbacks: {
        onSelectScore,
        onCrisisHelp,
        onUnclearHint,
      },
    });

    expect(onCrisisHelp).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
  });

  it("triggers not today on skip phrases during tap question", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "not today please",
      mode: "tap",
      callbacks: {
        onSelectScore,
        onNotToday,
        onUnclearHint,
      },
    });

    expect(onNotToday).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
  });

  it("triggers not today on skip phrases during PHQ-9 question", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "skip",
      mode: "phq9",
      itemId: "3",
      callbacks: {
        onSelectScore,
        onNotToday,
        onUnclearHint,
      },
    });

    expect(onNotToday).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
  });

  it("triggers not today on skip phrases during GAD-7 question", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "not today",
      mode: "gad7",
      itemId: "2",
      callbacks: {
        onSelectScore,
        onNotToday,
        onUnclearHint,
      },
    });

    expect(onNotToday).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
  });

  it("safely handles skip phrase when onNotToday callback is omitted", () => {
    const onSelectScore = vi.fn();
    const onUnclearHint = vi.fn();

    processQuestionAnswer({
      rawAnswer: "skip",
      mode: "phq9",
      itemId: "1",
      callbacks: {
        onSelectScore,
        onUnclearHint,
      },
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(onUnclearHint).not.toHaveBeenCalled();
  });
});
