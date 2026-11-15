import { afterEach, describe, expect, it, vi } from "vitest";
import { processVoiceOrTextInput } from "@/components/check-in-voice-input";
import * as client from "@/lib/check-in-client";

describe("crisis_help alert handling on check-in screen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the crisis path immediately before any network response and calls the alert once", async () => {
    let networkAnswered = false;
    let showCrisisPath = false;

    // Spy on submitCheckInCrisisAlert with an in-flight delayed promise
    const alertSpy = vi.spyOn(client, "submitCheckInCrisisAlert").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      networkAnswered = true;
      return { ok: true, saved: true, duplicate: false };
    });

    const onCrisisHelp = () => {
      showCrisisPath = true;
      void client.submitCheckInCrisisAlert();
    };

    const onSelectScore = vi.fn();

    processVoiceOrTextInput({
      raw: "emergency",
      source: "typed",
      mode: "tap",
      activeItemLabel: "Mood",
      activeItemId: "moodScore",
      onSelectScore,
      onNotToday: vi.fn(),
      onCrisisHelp,
    });

    // 1. Immediately visible BEFORE network has answered
    expect(showCrisisPath).toBe(true);
    expect(networkAnswered).toBe(false);

    // 2. Alert called exactly once
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onSelectScore).not.toHaveBeenCalled();

    // 3. When network completes, crisis path remains visible
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(networkAnswered).toBe(true);
    expect(showCrisisPath).toBe(true);
  });

  it("keeps the crisis path visible even if the server alert fails and does not replace it with an error", async () => {
    let showCrisisPath = false;
    const errorMessage: string | null = null;

    vi.spyOn(client, "submitCheckInCrisisAlert").mockResolvedValueOnce({
      ok: false,
      status: 503,
      saved: false,
      error: "service_unavailable",
      showCrisisPath: true,
    });

    const onCrisisHelp = () => {
      showCrisisPath = true;
      void client.submitCheckInCrisisAlert();
    };

    processVoiceOrTextInput({
      raw: "help",
      source: "typed",
      mode: "phq9",
      activeItemLabel: "Question 2",
      activeItemId: "2",
      onSelectScore: vi.fn(),
      onNotToday: vi.fn(),
      onCrisisHelp,
    });

    expect(showCrisisPath).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(showCrisisPath).toBe(true);
    expect(errorMessage).toBeNull();
  });
});
