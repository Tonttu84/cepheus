import { z } from "zod";
import {
  buildDeterministicNurseBrief,
  SAFE_ACTION_DEFAULTS,
  SAFE_ACTION_KEYS,
  selectDeterministicPatientStep,
  verifyOutputFaithfulness,
  type NurseBriefInput,
  type NurseBriefOutput,
  type PatientStepInput,
  type PatientStepOutput,
} from "@/domain/ai-support";
import { getEnv } from "@/server/env";

const VERDA_TIMEOUT_MS = 8_000;

export type AiProviderKind = "verda-gemma" | "deterministic-fallback";

export interface VerdaStepResponse {
  provider: AiProviderKind;
  model: string | null;
  fallbackUsed: boolean;
  fallbackReason?: string;
  faithfulnessVerified: boolean;
  result: PatientStepOutput;
}

export interface VerdaBriefResponse {
  provider: AiProviderKind;
  model: string | null;
  fallbackUsed: boolean;
  fallbackReason?: string;
  faithfulnessVerified: boolean;
  result: NurseBriefOutput;
}

const gemmaStepSchema = z.object({
  actionKey: z.enum(SAFE_ACTION_KEYS),
  message: z.string().min(8).max(240),
});

const gemmaBriefSchema = z.object({
  summary: z.string().min(20).max(500),
  conversationOpeners: z.array(z.string().min(8).max(180)).min(1).max(3),
});

export function isVerdaConfigured(): boolean {
  const env = getEnv();
  return env.VERDA_INFERENCE_URL.length > 0 && env.VERDA_API_KEY.length > 0;
}

function extractJsonObject(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callVerdaGemmaJson(
  systemPrompt: string,
  userJson: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<unknown> {
  const env = getEnv();
  const res = await fetchImpl(env.VERDA_INFERENCE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VERDA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.VERDA_GEMMA_MODEL,
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userJson) },
      ],
    }),
    signal: AbortSignal.timeout(VERDA_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Verda Inference API returned status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Verda response contained empty message content.");
  }
  return extractJsonObject(content);
}

const PATIENT_STEP_SYSTEM_PROMPT = [
  "You are supporting a calm post-TMS wellbeing check-in.",
  "Select ONE actionKey from: short_walk, breathing_space, bright_light, social_contact.",
  "Return strict JSON: {\"actionKey\": \"...\", \"message\": \"...\"}.",
  "Rules: never mention scores, streaks, diagnosis, relapse, depression labels, happy memories, sad music, or cold water.",
  "Keep message under 220 characters, warm, low-effort, and zero-guilt.",
].join(" ");

const NURSE_BRIEF_SYSTEM_PROMPT = [
  "You turn pseudonymous wellbeing summary numbers into a plain-English nurse pre-call brief.",
  "Return strict JSON: {\"summary\": \"...\", \"conversationOpeners\": [\"...\", \"...\"]}.",
  "Rules: quote ONLY numbers present in the input JSON; never invent numbers; never diagnose, predict relapse, or recommend medication doses.",
  "Keep summary <= 3 sentences and openers gentle and practical.",
].join(" ");

function makeFallback<T>(
  result: T,
  reason: string,
  model: string | null = null,
  faithfulnessVerified = true
): {
  provider: AiProviderKind;
  model: string | null;
  fallbackUsed: boolean;
  fallbackReason: string;
  faithfulnessVerified: boolean;
  result: T;
} {
  return {
    provider: "deterministic-fallback",
    model,
    fallbackUsed: true,
    fallbackReason: reason,
    faithfulnessVerified,
    result,
  };
}

/**
 * Generates a tailored, low-effort patient step via EU-hosted Gemma on Verda,
 * falling back deterministically if Verda is unconfigured, fails, or fails safety checks.
 */
export async function generateTailoredPatientStep(
  input: PatientStepInput,
  fetchImpl: typeof fetch = fetch
): Promise<VerdaStepResponse> {
  const fallback = selectDeterministicPatientStep(input);
  if (!isVerdaConfigured()) {
    return makeFallback(fallback, "VERDA_INFERENCE_URL / VERDA_API_KEY not configured.");
  }

  const env = getEnv();
  try {
    const rawJson = await callVerdaGemmaJson(PATIENT_STEP_SYSTEM_PROMPT, input, fetchImpl);
    const parsed = gemmaStepSchema.safeParse(rawJson);
    if (!parsed.success) {
      return makeFallback(
        fallback,
        "Gemma output failed schema validation.",
        env.VERDA_GEMMA_MODEL,
        false
      );
    }

    const faith = verifyOutputFaithfulness(parsed.data.message, [JSON.stringify(input)]);
    if (!faith.ok) {
      return makeFallback(
        fallback,
        faith.reason ?? "Faithfulness check failed.",
        env.VERDA_GEMMA_MODEL,
        false
      );
    }

    return {
      provider: "verda-gemma",
      model: env.VERDA_GEMMA_MODEL,
      fallbackUsed: false,
      faithfulnessVerified: true,
      result: {
        actionKey: parsed.data.actionKey,
        actionTitle: SAFE_ACTION_DEFAULTS[parsed.data.actionKey].title,
        message: parsed.data.message.trim(),
      },
    };
  } catch {
    return makeFallback(
      fallback,
      "Verda Inference API request failed or timed out.",
      env.VERDA_GEMMA_MODEL
    );
  }
}

/**
 * Generates a non-diagnostic nurse pre-call brief via EU-hosted Gemma on Verda,
 * strictly enforcing grounded numbers and falling back deterministically on any issue.
 */
export async function generateNursePreCallBrief(
  input: NurseBriefInput,
  fetchImpl: typeof fetch = fetch
): Promise<VerdaBriefResponse> {
  const fallback = buildDeterministicNurseBrief(input);
  if (!isVerdaConfigured()) {
    return makeFallback(fallback, "VERDA_INFERENCE_URL / VERDA_API_KEY not configured.");
  }

  const env = getEnv();
  const allowedSources = [
    input.participantCode,
    input.sinceDate,
    ...input.broadAreas,
    ...input.metrics.map((m) => `${m.label} ${m.valueText}`),
  ];

  try {
    const rawJson = await callVerdaGemmaJson(NURSE_BRIEF_SYSTEM_PROMPT, input, fetchImpl);
    const parsed = gemmaBriefSchema.safeParse(rawJson);
    if (!parsed.success) {
      return makeFallback(
        fallback,
        "Gemma output failed schema validation.",
        env.VERDA_GEMMA_MODEL,
        false
      );
    }

    const summaryFaith = verifyOutputFaithfulness(parsed.data.summary, allowedSources, {
      enforceStrictNumberGrounding: true,
    });
    const openersFaith = verifyOutputFaithfulness(
      parsed.data.conversationOpeners.join(" "),
      allowedSources
    );
    if (!summaryFaith.ok || !openersFaith.ok) {
      return makeFallback(
        fallback,
        summaryFaith.reason ?? openersFaith.reason ?? "Faithfulness check failed.",
        env.VERDA_GEMMA_MODEL,
        false
      );
    }

    return {
      provider: "verda-gemma",
      model: env.VERDA_GEMMA_MODEL,
      fallbackUsed: false,
      faithfulnessVerified: true,
      result: {
        summary: parsed.data.summary.trim(),
        conversationOpeners: parsed.data.conversationOpeners.map((s) => s.trim()),
      },
    };
  } catch {
    return makeFallback(
      fallback,
      "Verda Inference API request failed or timed out.",
      env.VERDA_GEMMA_MODEL
    );
  }
}
