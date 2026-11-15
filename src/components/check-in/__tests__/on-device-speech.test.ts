import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOnDeviceSpeechRecognizer,
  setOnDeviceSpeechRecognizer,
  WebSpeechOnDeviceRecognizer,
  type OnDeviceSpeechRecognizer,
} from "../on-device-speech";
import { parseSpokenChoice } from "@/domain/arduino/voice";

describe("On-Device Speech Recognition Detection and Adapter (on-device-speech.ts)", () => {
  beforeEach(() => {
    setOnDeviceSpeechRecognizer(null);
  });

  afterEach(() => {
    setOnDeviceSpeechRecognizer(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports unavailable when SpeechRecognition API is completely absent", async () => {
    vi.stubGlobal("window", {});
    const recognizer = new WebSpeechOnDeviceRecognizer();
    const available = await recognizer.isAvailable();
    expect(available).toBe(false);
  });

  it("reports unavailable when SpeechRecognition exists but lacks static available() method", async () => {
    class FakeSpeechRecognition {
      processLocally = true;
    }
    vi.stubGlobal("window", {
      SpeechRecognition: FakeSpeechRecognition,
    });
    const recognizer = new WebSpeechOnDeviceRecognizer();
    const available = await recognizer.isAvailable();
    expect(available).toBe(false);
  });

  it("reports unavailable when SpeechRecognition.available() rejects or reports not available", async () => {
    class FakeSpeechRecognition {
      static available = vi.fn().mockResolvedValue(false);
    }
    vi.stubGlobal("window", {
      SpeechRecognition: FakeSpeechRecognition,
    });
    const recognizer = new WebSpeechOnDeviceRecognizer();
    const available = await recognizer.isAvailable();
    expect(available).toBe(false);
    expect(FakeSpeechRecognition.available).toHaveBeenCalledWith({
      langs: ["en-US", "en"],
      processLocally: true,
    });
  });

  it("reports available when SpeechRecognition.available() confirms on-device readiness", async () => {
    class FakeSpeechRecognition {
      static available = vi.fn().mockResolvedValue(true);
    }
    vi.stubGlobal("window", {
      SpeechRecognition: FakeSpeechRecognition,
    });
    const recognizer = new WebSpeechOnDeviceRecognizer();
    const available = await recognizer.isAvailable();
    expect(available).toBe(true);
  });

  it("supports swapping with a fake recognizer for unit and component testing", async () => {
    const fakeRecognizer: OnDeviceSpeechRecognizer = {
      isAvailable: vi.fn().mockResolvedValue(true),
      startListening: vi.fn().mockImplementation((callbacks) => {
        callbacks.onResult("several days");
        return { stop: vi.fn(), abort: vi.fn() };
      }),
    };

    setOnDeviceSpeechRecognizer(fakeRecognizer);
    const recognizer = getOnDeviceSpeechRecognizer();
    expect(await recognizer.isAvailable()).toBe(true);

    let resultTranscript = "";
    recognizer.startListening({
      onResult: (t) => {
        resultTranscript = t;
      },
    });

    expect(resultTranscript).toBe("several days");
    const parsed = parseSpokenChoice(resultTranscript, "phq9");
    expect(parsed).toEqual({ kind: "score", value: 1 });
  });

  it("handles unclear speech result by asking again without guessing", async () => {
    const fakeRecognizer: OnDeviceSpeechRecognizer = {
      isAvailable: vi.fn().mockResolvedValue(true),
      startListening: vi.fn().mockImplementation((callbacks) => {
        callbacks.onResult("not sure maybe");
        return { stop: vi.fn(), abort: vi.fn() };
      }),
    };

    setOnDeviceSpeechRecognizer(fakeRecognizer);
    const recognizer = getOnDeviceSpeechRecognizer();

    let capturedParsedKind = "";
    recognizer.startListening({
      onResult: (t) => {
        const parsed = parseSpokenChoice(t, "tap");
        capturedParsedKind = parsed.kind;
      },
    });

    expect(capturedParsedKind).toBe("unclear");
  });
});
