import { NextResponse } from "next/server";
import { z } from "zod";
import { mapHealthConnectPayloadToRingDays } from "@/domain/health-connect";
import { getEnv } from "@/server/env";
import { saveWearableDaysAndComputeRhythm } from "@/server/monitoring";
import {
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  timingSafeEqualString,
  verifyHmacSha256Signature,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 512_000;

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
});

const stepRecordSchema = z.object({
  count: z.number().nonnegative().optional(),
  start_time: z.string().max(64).optional(),
  end_time: z.string().max(64).optional(),
  bucket_start: z.string().max(64).optional(),
  bucket_end: z.string().max(64).optional(),
  total: z.number().nonnegative().optional(),
  start_zone_offset: z.string().max(16).optional(),
});

const calorieRecordSchema = z.object({
  energy_kcal: z.number().nonnegative().optional(),
  kcal: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  start_time: z.string().max(64).optional(),
  end_time: z.string().max(64).optional(),
  bucket_start: z.string().max(64).optional(),
  bucket_end: z.string().max(64).optional(),
});

const hrRecordSchema = z.object({
  bpm: z.number().positive().optional(),
  time: z.string().max(64).optional(),
  start_time: z.string().max(64).optional(),
  avg: z.number().positive().optional(),
  min: z.number().positive().optional(),
  max: z.number().positive().optional(),
});

const hrvRecordSchema = z.object({
  rmssd_millis: z.number().positive().optional(),
  rmssd: z.number().positive().optional(),
  avg: z.number().positive().optional(),
  time: z.string().max(64).optional(),
  start_time: z.string().max(64).optional(),
});

const dailyTotalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().nonnegative().optional(),
  active_calories_kcal: z.number().nonnegative().optional(),
});

const HealthConnectWebhookSchema = z.object({
  test: z.boolean().optional(),
  source: z.string().max(64).optional(),
  timezone: z.string().max(64).optional(),
  isSimulated: z.boolean().optional(),
  sleep: z.array(sleepRecordSchema).max(200).optional(),
  steps: z.array(stepRecordSchema).max(5000).optional(),
  active_calories: z.array(calorieRecordSchema).max(5000).optional(),
  heart_rate: z.array(hrRecordSchema).max(10_000).optional(),
  heart_rate_variability: z.array(hrvRecordSchema).max(5000).optional(),
  daily_totals: z.array(dailyTotalSchema).max(90).optional(),
});

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
      { ok: false, error: "Webhook payload exceeds 512 KB limit." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const parsed = HealthConnectWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid Health Connect webhook payload." },
      { status: 400 }
    );
  }

  const env = getEnv();
  const secret = env.HEALTH_CONNECT_WEBHOOK_SECRET;
  const sigHeader = request.headers.get("x-signature");
  const bearer = extractBearerToken(request);
  const webhookTokenHeader = request.headers.get("x-webhook-token")?.trim() ?? null;

  // The Origin header can be set by any script, so this shortcut for the
  // dashboard's simulated push exists only outside production.
  const sameOriginUiSimulation =
    env.NODE_ENV !== "production" &&
    verifySameOrigin(request) &&
    parsed.data.isSimulated === true;

  const hmacValid =
    secret.length > 0 && verifyHmacSha256Signature(rawText, sigHeader, secret);
  const tokenValid =
    secret.length > 0 &&
    ((bearer !== null && timingSafeEqualString(bearer, secret)) ||
      (webhookTokenHeader !== null &&
        timingSafeEqualString(webhookTokenHeader, secret)));

  if (!hmacValid && !tokenValid && !sameOriginUiSimulation) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid or missing Health Connect webhook signature/token.",
      },
      { status: 401 }
    );
  }

  // Verification ping from Life Dashboard Companion / HC Webhook: 204 without writing data
  if (parsed.data.test === true) {
    return new NextResponse(null, { status: 204 });
  }

  const mappedDays = mapHealthConnectPayloadToRingDays(parsed.data);
  if (mappedDays.length === 0) {
    return NextResponse.json({
      ok: true,
      savedDays: 0,
      rhythmComputed: false,
    });
  }

  const isSimulated = Boolean(parsed.data.isSimulated);
  const sourceLabel = isSimulated
    ? "simulated_health_connect"
    : parsed.data.source === "healthkit_ios"
      ? "healthkit_ios"
      : "health_connect";

  const saved = await saveWearableDaysAndComputeRhythm(mappedDays, {
    isSimulated,
    sourceLabel,
  });

  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, error: saved.error },
      { status: saved.status }
    );
  }

  return NextResponse.json({
    ok: true,
    source: sourceLabel,
    isSimulated,
    savedDays: saved.savedDays,
    rhythmComputed: saved.rhythmComputed,
    rhythmError: saved.rhythmError,
  });
}
