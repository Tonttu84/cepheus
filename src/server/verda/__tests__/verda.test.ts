import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetEnv } from "@/server/env";
import {
  generateNursePreCallBrief,
  generateTailoredPatientStep,
} from "../client";

describe("Verda EU Gemma Client & Safety Fallback (src/server/verda)", () => {
  const savedDb = process.env.DATABASE_URL;
  const savedEnabled = process.env.VERDA_AI_ENABLED;
  const savedUrl = process.env.VERDA_INFERENCE_URL;
  const savedKey = process.env.VERDA_API_KEY;
  const savedModel = process.env.VERDA_GEMMA_MODEL;

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
    if (savedEnabled !== undefined) process.env.VERDA_AI_ENABLED = savedEnabled;
    else delete process.env.VERDA_AI_ENABLED;
    if (savedUrl !== undefined) process.env.VERDA_INFERENCE_URL = savedUrl;
    else delete process.env.VERDA_INFERENCE_URL;
    if (savedKey !== undefined) process.env.VERDA_API_KEY = savedKey;
    else delete process.env.VERDA_API_KEY;
    if (savedModel !== undefined) process.env.VERDA_GEMMA_MODEL = savedModel;
    else delete process.env.VERDA_GEMMA_MODEL;
    _resetEnv();
  });

  function enableVerdaEnv(): void {
    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    process.env.VERDA_AI_ENABLED = "true";
    process.env.VERDA_INFERENCE_URL = "https://inference.verda.example/v1/chat/completions";
    process.env.VERDA_API_KEY = "verda-test-key";
    process.env.VERDA_GEMMA_MODEL = "google/gemma-3-27b-it";
    _resetEnv();
  }

  it("stays off by default when VERDA_AI_ENABLED is false even if URL/key exist, and falls back deterministically", async () => {
    process.env.DATABASE_URL =
      "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
    delete process.env.VERDA_AI_ENABLED;
    process.env.VERDA_INFERENCE_URL = "https://inference.verda.example/v1/chat/completions";
    process.env.VERDA_API_KEY = "verda-test-key";
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

  it("strips participantCode before sending to Verda, prepends it locally, and rejects hallucinated numbers", async () => {
    enableVerdaEnv();

    let capturedBodyText = "";
    const validFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBodyText = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary:
                    "2 missed check-in rounds appeared since 2026-11-05 while wearable contact remained active.",
                  conversationOpeners: [
                    "Ask gently how their sleep timing has felt lately.",
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const okBrief = await generateNursePreCallBrief(
      {
        participantCode: "P-SECRET-042",
        sinceDate: "2026-11-05",
        triggerKind: "silence",
        broadAreas: ["check_in", "sleep"],
        ringActiveDuringSilence: true,
        metrics: [{ label: "Missed rounds", valueText: "2" }],
        isSimulated: true,
      },
      validFetch
    );
    expect(capturedBodyText).not.toContain("P-SECRET-042");
    expect(okBrief.provider).toBe("verda-gemma");
    expect(okBrief.fallbackUsed).toBe(false);
    expect(okBrief.faithfulnessVerified).toBe(true);
    expect(okBrief.result.summary).toContain("Participant P-SECRET-042:");

    const hallucinatingFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "95% relapse severity risk with 9 missed rounds.",
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
        participantCode: "P-SECRET-042",
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

  it("rejects any digits in patient-step messages and strips participantCode from the Verda request", async () => {
    enableVerdaEnv();

    let capturedBodyText = "";
    const digitFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBodyText = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  actionKey: "short_walk",
                  message: "Your score is 3, try walking 10 minutes.",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await generateTailoredPatientStep(
      {
        participantCode: "P-SECRET-099",
        dayIndex: 29,
        broadAreasShifted: ["daily_routine"],
        lowDaylight: false,
        highStationaryBout: false,
        pastActionOutcomes: [],
        isSimulated: true,
      },
      digitFetch
    );

    expect(capturedBodyText).not.toContain("P-SECRET-099");
    expect(res.provider).toBe("deterministic-fallback");
    expect(res.faithfulnessVerified).toBe(false);
  });

  it("logs failure without patient data and falls back deterministically on 429, 500, and timeout", async () => {
    enableVerdaEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const briefInput = {
      participantCode: "P-PRIVATE-777",
      sinceDate: "2026-11-05",
      triggerKind: "silence" as const,
      broadAreas: ["check_in"],
      ringActiveDuringSilence: true,
      metrics: [{ label: "Missed rounds", valueText: "2" }],
      isSimulated: true,
    };

    const fetch429 = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const res429 = await generateNursePreCallBrief(briefInput, fetch429);
    expect(res429.provider).toBe("deterministic-fallback");
    expect(res429.fallbackUsed).toBe(true);

    const fetch500 = (async () =>
      new Response("server error", { status: 500 })) as unknown as typeof fetch;
    const res500 = await generateNursePreCallBrief(briefInput, fetch500);
    expect(res500.provider).toBe("deterministic-fallback");
    expect(res500.fallbackUsed).toBe(true);

    const fetchTimeout = (async () => {
      const err = new Error("Request aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;
    const resTimeout = await generateNursePreCallBrief(briefInput, fetchTimeout);
    expect(resTimeout.provider).toBe("deterministic-fallback");
    expect(resTimeout.fallbackUsed).toBe(true);

    expect(warnSpy).toHaveBeenCalledTimes(3);
    const allLogged = JSON.stringify(warnSpy.mock.calls);
    expect(allLogged).toContain("429");
    expect(allLogged).toContain("500");
    expect(allLogged).toContain("timeout");
    expect(allLogged).not.toContain("P-PRIVATE-777");
  });
});
