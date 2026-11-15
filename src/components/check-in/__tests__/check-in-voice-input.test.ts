import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckInVoiceInput,
  processVoiceOrTextInput,
  toggleCheckInVoiceRecognition,
  _resetVoiceAvailabilityForTesting,
} from "@/components/check-in-voice-input";
import {
  setOnDeviceSpeechRecognizer,
  type OnDeviceSpeechRecognizer,
  type SpeechRecognitionController,
} from "../on-device-speech";

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

describe("On-device speech availability check timing (on first voice request)", () => {
  beforeEach(() => {
    _resetVoiceAvailabilityForTesting();
    setOnDeviceSpeechRecognizer(null);
  });

  afterEach(() => {
    _resetVoiceAvailabilityForTesting();
    setOnDeviceSpeechRecognizer(null);
    vi.restoreAllMocks();
  });

  it("does not call available() on rendering or mounting the screen", () => {
    const fakeAvailable = vi.fn().mockResolvedValue(true);
    const fakeRecognizer: OnDeviceSpeechRecognizer = {
      isAvailable: fakeAvailable,
      startListening: vi.fn(),
    };
    setOnDeviceSpeechRecognizer(fakeRecognizer);

    const html = renderToString(
      React.createElement(CheckInVoiceInput, {
        activeItemLabel: "Mood",
        activeItemId: "moodScore",
        onSelectScore: vi.fn(),
        onNotToday: vi.fn(),
        onCrisisHelp: vi.fn(),
      })
    );

    // Initial render offers voice and shows speak answer button
    expect(html).toContain("Speak or type an answer");
    expect(html).toContain("Speak answer");
    expect(fakeAvailable).not.toHaveBeenCalled();
  });

  it("calls available() exactly once on tapping the voice control and keeps the result for the rest of the visit", async () => {
    const fakeAvailable = vi.fn().mockResolvedValue(true);
    const fakeStop = vi.fn();
    const fakeStart = vi.fn().mockReturnValue({ stop: fakeStop, abort: vi.fn() });
    const fakeRecognizer: OnDeviceSpeechRecognizer = {
      isAvailable: fakeAvailable,
      startListening: fakeStart,
    };
    setOnDeviceSpeechRecognizer(fakeRecognizer);

    let listeningState = false;
    let feedbackText = "";
    let voiceAvailState = true;
    let ctrl: SpeechRecognitionController | null = null;

    // First tap: calls available() once and starts listening
    await toggleCheckInVoiceRecognition({
      disabled: false,
      listening: listeningState,
      controller: ctrl,
      onListeningChange: (l) => {
        listeningState = l;
      },
      onControllerChange: (c) => {
        ctrl = c;
      },
      onFeedback: (f) => {
        feedbackText = f;
      },
      onVoiceAvailableChange: (a) => {
        voiceAvailState = a;
      },
      onTranscript: vi.fn(),
    });

    expect(fakeAvailable).toHaveBeenCalledTimes(1);
    expect(fakeStart).toHaveBeenCalledTimes(1);
    expect(listeningState).toBe(true);
    expect(feedbackText).toBe("Listening on this device...");

    // Second tap while listening: stops listening, does NOT call available() again
    await toggleCheckInVoiceRecognition({
      disabled: false,
      listening: listeningState,
      controller: ctrl,
      onListeningChange: (l) => {
        listeningState = l;
      },
      onControllerChange: (c) => {
        ctrl = c;
      },
      onFeedback: (f) => {
        feedbackText = f;
      },
      onVoiceAvailableChange: (a) => {
        voiceAvailState = a;
      },
      onTranscript: vi.fn(),
    });

    expect(fakeStop).toHaveBeenCalledTimes(1);
    expect(listeningState).toBe(false);
    expect(fakeAvailable).toHaveBeenCalledTimes(1);

    // Third tap (new answer in same visit): starts listening again, does NOT call available() again
    await toggleCheckInVoiceRecognition({
      disabled: false,
      listening: listeningState,
      controller: ctrl,
      onListeningChange: (l) => {
        listeningState = l;
      },
      onControllerChange: (c) => {
        ctrl = c;
      },
      onFeedback: (f) => {
        feedbackText = f;
      },
      onVoiceAvailableChange: (a) => {
        voiceAvailState = a;
      },
      onTranscript: vi.fn(),
    });

    expect(fakeAvailable).toHaveBeenCalledTimes(1);
    expect(fakeStart).toHaveBeenCalledTimes(2);
  });

  it("shows 'not available on this device' message, hides voice button, and keeps typing when unavailable", async () => {
    const fakeAvailable = vi.fn().mockResolvedValue(false);
    const fakeStart = vi.fn();
    const fakeRecognizer: OnDeviceSpeechRecognizer = {
      isAvailable: fakeAvailable,
      startListening: fakeStart,
    };
    setOnDeviceSpeechRecognizer(fakeRecognizer);

    let listeningState = false;
    let feedbackText = "";
    let voiceAvailState: boolean | undefined = undefined;

    await toggleCheckInVoiceRecognition({
      disabled: false,
      listening: listeningState,
      controller: null,
      onListeningChange: (l) => {
        listeningState = l;
      },
      onControllerChange: vi.fn(),
      onFeedback: (f) => {
        feedbackText = f;
      },
      onVoiceAvailableChange: (a) => {
        voiceAvailState = a;
      },
      onTranscript: vi.fn(),
    });

    expect(fakeAvailable).toHaveBeenCalledTimes(1);
    expect(fakeStart).not.toHaveBeenCalled();
    expect(listeningState).toBe(false);
    expect(voiceAvailState).toBe(false);
    expect(feedbackText).toBe("On-device speech recognition is not available on this device.");

    // Subsequent render reflects unavailable: only typing offered, voice button hidden
    const html = renderToString(
      React.createElement(CheckInVoiceInput, {
        activeItemLabel: "Mood",
        activeItemId: "moodScore",
        onSelectScore: vi.fn(),
        onNotToday: vi.fn(),
        onCrisisHelp: vi.fn(),
      })
    );
    expect(html).toContain("Type an answer");
    expect(html).not.toContain("Speak answer");
    expect(html).toContain("check-in-text-input");
  });
});

