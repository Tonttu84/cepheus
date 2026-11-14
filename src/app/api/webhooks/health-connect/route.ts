import { NextResponse } from "next/server";
import { z } from "zod";
import { mapHealthConnectPayloadToRingDays } from "@/domain/health-connect";
import { getEnv } from "@/server/env";
import { saveWearableDaysAndComputeRhythm } from "@/server/monitoring";
import {
  recordHealthConnectWebhookDelivery,
  verifyAndResolveHealthConnectWebhook,
} from "@/server/monitoring/health-connect-pairing";
import {
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 2_000_000;

const recordMetadataSchema = z
  .object({
    zone_offset_seconds: z.number().optional(),
    start_zone_offset_seconds: z.number().optional(),
    end_zone_offset_seconds: z.number().optional(),
  })
  .optional();

const sleepStageSchema = z.object({
  stage: z.string().min(1).max(64),
  start_time: z.string().min(1).max(64),
  end_time: z.string().min(1).max(64),
  duration_seconds: z.number().nonnegative().optional(),
});

const sleepRecordSchema = z.object({
  session_end_time: z.string().min(1).max(64),
  duration_seconds: z.number().nonnegative().max(172_800),
  start_time: z.string().min(1).max(64).optional(),
  stages: z.array(sleepStageSchema).max(1000).optional(),
  metadata: recordMetadataSchema,
});

const stepRecordSchema = z.object({
  count: z.number().nonnegative().optional(),
  start_time: z.string().max(64).optional(),
  end_time: z.string().max(64).optional(),
  bucket_start: z.string().max(64).optional(),
  bucket_end: z.string().max(64).optional(),
  total: z.number().nonnegative().optional(),
  start_zone_offset: z.string().max(16).optional(),
  metadata: recordMetadataSchema,
});

const calorieRecordSchema = z.object({
  energy_kcal: z.number().nonnegative().optional(),
  kcal: z.number().nonnegative().optional(),
  calories: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  start_time: z.string().max(64).optional(),
  end_time: z.string().max(64).optional(),
  bucket_start: z.string().max(64).optional(),
  bucket_end: z.string().max(64).optional(),
  metadata: recordMetadataSchema,
});

const hrRecordSchema = z.object({
  bpm: z.number().positive().optional(),
  time: z.string().max(64).optional(),
  start_time: z.string().max(64).optional(),
  avg: z.number().positive().optional(),
  min: z.number().positive().optional(),
  max: z.number().positive().optional(),
  metadata: recordMetadataSchema,
});

const restingHrRecordSchema = z.object({
  bpm: z.number().positive().optional(),
  time: z.string().max(64).optional(),
  start_time: z.string().max(64).optional(),
  metadata: recordMetadataSchema,
});

const hrvRecordSchema = z.object({
  rmssd_millis: z.number().positive().optional(),
  heart_rate_variability_millis: z.number().positive().optional(),
  rmssd: z.number().positive().optional(),
  avg: z.number().positive().optional(),
  time: z.string().max(64).optional(),
  start_time: z.string().max(64).optional(),
  metadata: recordMetadataSchema,
});

const dailyTotalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().nonnegative().optional(),
  active_calories_kcal: z.number().nonnegative().optional(),
  active_calories: z.number().nonnegative().optional(),
});

const HealthConnectWebhookSchema = z.object({
  test: z.boolean().optional(),
  sequence: z.number().int().nonnegative().optional(),
  source: z.string().max(64).optional(),
  timezone: z.string().max(64).optional(),
  isSimulated: z.boolean().optional(),
  sleep: z.array(sleepRecordSchema).max(200).optional(),
  steps: z.array(stepRecordSchema).max(5000).optional(),
  active_calories: z.array(calorieRecordSchema).max(5000).optional(),
  heart_rate: z.array(hrRecordSchema).max(10_000).optional(),
  resting_heart_rate: z.array(restingHrRecordSchema).max(1000).optional(),
  heart_rate_variability: z.array(hrvRecordSchema).max(5000).optional(),
  daily_totals: z.array(dailyTotalSchema).max(90).optional(),
});

function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Invalid or missing Health Connect webhook signature/token.",
    },
    { status: 401 }
  );
}

async function processAuthorizedWebhook(
  data: z.infer<typeof HealthConnectWebhookSchema>,
  auth: { ok: true; credentialId: string | null; lastSequence: number | null } | { ok: false }
) {
  if (data.test === true) {
    await recordHealthConnectWebhookDelivery({
      credentialId: auth.ok ? auth.credentialId : null,
      isTestPing: true,
    });
    return new NextResponse(null, { status: 204 });
  }

  if (data.source === "screen_time") {
    return NextResponse.json({ ok: true, savedDays: 0, rhythmComputed: false });
  }

  if (
    auth.ok &&
    typeof data.sequence === "number" &&
    auth.lastSequence === data.sequence
  ) {
    return NextResponse.json({
      ok: true,
      duplicateSequence: true,
      savedDays: 0,
      rhythmComputed: false,
    });
  }

  const mappedDays = mapHealthConnectPayloadToRingDays(data);
  if (mappedDays.length === 0) {
    return NextResponse.json({ ok: true, savedDays: 0, rhythmComputed: false });
  }

  const isSimulated = Boolean(data.isSimulated);
  const sourceLabel = isSimulated
    ? "simulated_health_connect"
    : data.source === "healthkit_ios"
      ? "healthkit_ios"
      : "health_connect";

  const saved = await saveWearableDaysAndComputeRhythm(mappedDays, {
    isSimulated,
    sourceLabel,
  });

  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: saved.status });
  }

  await recordHealthConnectWebhookDelivery({
    credentialId: auth.ok ? auth.credentialId : null,
    isTestPing: false,
    sequence: data.sequence,
  });

  return NextResponse.json({
    ok: true,
    source: sourceLabel,
    isSimulated,
    savedDays: saved.savedDays,
    rhythmComputed: saved.rhythmComputed,
    rhythmError: saved.rhythmError,
  });
}

async function authenticateWebhookRequest(request: Request, rawText: string) {
  const tokenParam = new URL(request.url).searchParams.get("token")?.trim() || null;
  const auth = await verifyAndResolveHealthConnectWebhook({
    rawBody: rawText,
    tokenParam,
    sigHeader: request.headers.get("x-signature"),
    bearerToken: extractBearerToken(request),
    webhookTokenHeader: request.headers.get("x-webhook-token")?.trim() || null,
    apiKeyHeader: request.headers.get("x-api-key")?.trim() || null,
  });

  const devSameOriginFallback =
    !auth.ok && getEnv().NODE_ENV !== "production" && verifySameOrigin(request);

  return { auth, devSameOriginFallback };
}

export async function POST(request: Request) {
  const limit = checkRateLimit(getClientKey(request, "hc-webhook"), 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to read webhook body." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, "utf8") > MAX_WEBHOOK_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Webhook payload exceeds 2 MB limit." },
      { status: 413 }
    );
  }

  const { auth, devSameOriginFallback } = await authenticateWebhookRequest(request, rawText);
  if (!auth.ok && !devSameOriginFallback) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = HealthConnectWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid Health Connect webhook payload." },
      { status: 400 }
    );
  }

  if (!auth.ok && parsed.data.isSimulated !== true) {
    return unauthorizedResponse();
  }

  return processAuthorizedWebhook(parsed.data, auth);
}
