import { afterEach, describe, expect, it } from "vitest";
import { _resetEnv } from "@/server/env";
import {
  generateNursePreCallBrief,
  generateTailoredPatientStep,
} from "../client";

describe("Verda EU Gemma Client & Safety Fallback (src/server/verda)", () => {
  const savedDb = process.env.DATABASE_URL;
  const savedUrl = process.env.VERDA_INFERENCE_URL;
  const savedKey = process.env.VERDA_API_KEY;
  const savedModel = process.env.VERDA_GEMMA_MODEL;

  afterEach(() => {
    if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
    if (savedUrl !== undefined) process.env.VERDA_INFERENCE_URL = savedUrl;
    else delete process.env.VERDA_INFERENCE_URL;
    if (savedKey !== undefined) process.env.VERDA_API_KEY = savedKey;
    else delete process.env.VERDA_API_KEY;
    if (savedModel !== undefined) process.env.VERDA_GEMMA_MODEL = savedModel;
    else delete process.env.VERDA_GEMMA_MODEL;
    _resetEnv();
  });

  it("falls back deterministically when Verda is not configured", async () => {
    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    delete process.env.VERDA_INFERENCE_URL;
    delete process.env.VERDA_API_KEY;
    _resetEnv();

    const stepRes = await generateTailoredPatientStep({
      participantCode: "sim-01",
      dayIndex: 29,
      broadAreasShifted: ["daily_routine"],
      lowDaylight: true,
      highStationaryBout: true,
      pastActionOutcomes: [],
      isSimulated: true,
    });
    expect(stepRes.provider).toBe("deterministic-fallback");
    expect(stepRes.fallbackUsed).toBe(true);
    expect(stepRes.result.actionKey).toBe("bright_light");
  });

  it("uses EU Verda Gemma output when valid and rejects hallucinated numbers or clinical claims", async () => {
    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.VERDA_INFERENCE_URL = "https://inference.verda.example/v1/chat/completions";
    process.env.VERDA_API_KEY = "verda-test-key";
    process.env.VERDA_GEMMA_MODEL = "google/gemma-3-27b-it";
    _resetEnv();

    const validFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary:
                    "Participant P-042 had 2 missed check-in rounds since 2026-11-05 while wearable contact remained active.",
                  conversationOpeners: [
                    "Ask gently how their sleep timing has felt lately.",
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as unknown as typeof fetch;

    const okBrief = await generateNursePreCallBrief(
      {
        participantCode: "P-042",
        sinceDate: "2026-11-05",
        triggerKind: "silence",
        broadAreas: ["check_in", "sleep"],
        ringActiveDuringSilence: true,
        metrics: [{ label: "Missed rounds", valueText: "2" }],
        isSimulated: true,
      },
      validFetch
    );
    expect(okBrief.provider).toBe("verda-gemma");
    expect(okBrief.fallbackUsed).toBe(false);
    expect(okBrief.faithfulnessVerified).toBe(true);

    const hallucinatingFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary:
                    "Participant P-042 is depressed with a 95% relapse risk and 9 missed rounds.",
                  conversationOpeners: ["Schedule emergency review."],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as unknown as typeof fetch;

    const blockedBrief = await generateNursePreCallBrief(
      {
        participantCode: "P-042",
        sinceDate: "2026-11-05",
        triggerKind: "silence",
        broadAreas: ["check_in"],
        ringActiveDuringSilence: true,
        metrics: [{ label: "Missed rounds", valueText: "2" }],
        isSimulated: true,
      },
      hallucinatingFetch
    );
    expect(blockedBrief.provider).toBe("deterministic-fallback");
    expect(blockedBrief.fallbackUsed).toBe(true);
    expect(blockedBrief.faithfulnessVerified).toBe(false);
  });
});
