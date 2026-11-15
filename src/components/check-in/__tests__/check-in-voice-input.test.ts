import { describe, expect, it, vi } from "vitest";
import { processVoiceOrTextInput } from "@/components/check-in-voice-input";

describe("CheckInVoiceInput answer processing (processVoiceOrTextInput)", () => {
  it("processes a valid numeric tap answer and forwards the parsed score", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "3",
      source: "typed",
      mode: "tap",
      activeItemLabel: "Mood",
      activeItemId: "moodScore",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).toHaveBeenCalledWith(3);
    expect(res.kind).toBe("score");
    expect(res.feedback).toContain("Applied 3 of 4 to Mood (typed)");
  });

  it("processes natural word label for tap answer", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "Good",
      source: "spoken",
      mode: "tap",
      activeItemLabel: "Mood",
      activeItemId: "moodScore",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).toHaveBeenCalledWith(3);
    expect(res.kind).toBe("score");
    expect(res.feedback).toContain("Applied 3 of 4 to Mood (spoken)");
  });

  it("processes natural text phrase for PHQ-9 and sends parsed score", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "several days",
      source: "typed",
      mode: "phq9",
      activeItemLabel: "Question 2",
      activeItemId: "2",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).toHaveBeenCalledWith(1);
    expect(res.kind).toBe("score");
    expect(res.feedback).toContain("Applied 1 of 3 to Question 2");
  });

  it("processes natural text phrase for GAD-7 and sends parsed score", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "more than half the days",
      source: "spoken",
      mode: "gad7",
      activeItemLabel: "GAD-7 Question 1",
      activeItemId: "1",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).toHaveBeenCalledWith(2);
    expect(res.kind).toBe("score");
    expect(res.feedback).toContain("Applied 2 of 3 to GAD-7 Question 1");
  });

  it("asks again with tap-scale hint when answer is unclear in tap mode", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "maybe two or three",
      source: "typed",
      mode: "tap",
      activeItemLabel: "Mood",
      activeItemId: "moodScore",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("unclear");
    expect(res.feedback).toContain("0–4");
    expect(res.feedback).toContain("Low, Okay, Good, Very good");
  });

  it("asks again with questionnaire-scale hint when answer is unclear in phq9 mode", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "four",
      source: "typed",
      mode: "phq9", // PHQ-9 range is 0–3
      activeItemLabel: "Question 1",
      activeItemId: "1",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("unclear");
    expect(res.feedback).toContain("0–3");
    expect(res.feedback).toContain("Not at all, Several days, Nearly every day");
  });

  it("immediately triggers crisis path when PHQ-9 item 9 is answered > 0 by text or voice", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "several days",
      source: "typed",
      mode: "phq9",
      activeItemLabel: "Question 9",
      activeItemId: "9",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onCrisisHelp).toHaveBeenCalled();
    expect(onSelectScore).toHaveBeenCalledWith(1);
    expect(res.crisisVisible).toBe(true);
  });

  it("does not trigger crisis path when PHQ-9 item 9 is answered 0", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "not at all",
      source: "typed",
      mode: "phq9",
      activeItemLabel: "Question 9",
      activeItemId: "9",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onCrisisHelp).not.toHaveBeenCalled();
    expect(onSelectScore).toHaveBeenCalledWith(0);
    expect(res.crisisVisible).toBe(false);
  });

  it("triggers crisis help on explicit crisis phrases during any question", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "help please",
      source: "typed",
      mode: "tap",
      activeItemLabel: "Mood",
      activeItemId: "moodScore",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onCrisisHelp).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("crisis_help");
    expect(res.crisisVisible).toBe(true);
  });

  it("triggers onNotToday when typed answer is 'not today'", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "not today",
      source: "typed",
      mode: "phq9",
      activeItemLabel: "Question 1",
      activeItemId: "1",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onNotToday).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("not_today");
  });

  it("triggers onNotToday when typed answer is 'skip'", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "skip",
      source: "typed",
      mode: "gad7",
      activeItemLabel: "GAD-7 Question 2",
      activeItemId: "2",
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onNotToday).toHaveBeenCalled();
    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("not_today");
  });

  it("provides helpful feedback when all prompts are already answered", () => {
    const onSelectScore = vi.fn();
    const onNotToday = vi.fn();
    const onCrisisHelp = vi.fn();

    const res = processVoiceOrTextInput({
      raw: "good",
      source: "typed",
      mode: "tap",
      activeItemLabel: null,
      onSelectScore,
      onNotToday,
      onCrisisHelp,
    });

    expect(onSelectScore).not.toHaveBeenCalled();
    expect(res.kind).toBe("unclear");
    expect(res.feedback).toContain("All prompts are already answered");
  });
});
