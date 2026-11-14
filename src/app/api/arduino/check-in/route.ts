import { NextResponse } from "next/server";
import { z } from "zod";
import { containsRawMediaFields } from "@/domain/arduino";
import { getEnv } from "@/server/env";
import { saveArduinoBedsideCheckIn } from "@/server/monitoring";
import {
  checkAndRecordDeviceReplay,
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  verifyArduinoDeviceCredential,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8_192;

const baseFields = {
  deviceId: z.string().min(2).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestampMs: z.number().finite().optional(),
  nonce: z.string().min(8).max(128).optional(),
  isSimulated: z.boolean().default(false),
};

const bedsideCheckInSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseFields,
    kind: z.literal("taps"),
    mood: z.number().int().min(0).max(4),
    interest: z.number().int().min(0).max(4),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("not_today"),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("phq9_item"),
    itemId: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    value: z.number().int().min(0).max(3),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("crisis_button"),
  }),
]);

function authenticateDevice(
  request: Request,
  deviceId: string,
  timestampMs: number | undefined,
  nonce: string | undefined,
  isSimulated: boolean
): { ok: true } | { ok: false; status: 401 | 409; error: string } {
  const env = getEnv();
  const sameOriginUiSim =
    env.NODE_ENV !== "production" && verifySameOrigin(request) && isSimulated;
  if (sameOriginUiSim) {
    return { ok: true };
  }

  const hasCreds =
    env.ARDUINO_DEVICE_KEYS_JSON.length > 0 || env.ARDUINO_INGEST_TOKEN.length > 0;
  if (!hasCreds && env.NODE_ENV === "production") {
    return { ok: false, status: 401, error: "Hardware credentials required in production." };
  }
  if (hasCreds) {
    const cred = verifyArduinoDeviceCredential(deviceId, extractBearerToken(request));
    if (!cred.ok) return { ok: false, status: 401, error: cred.reason };
    const replay = checkAndRecordDeviceReplay(deviceId, timestampMs, nonce);
    if (!replay.ok) return { ok: false, status: replay.status, error: replay.reason };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to read body." }, { status: 400 });
  }
  if (Buffer.byteLength(rawText, "utf8") > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload exceeds 8 KB limit." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const rawMediaKey = containsRawMediaFields(body);
  if (rawMediaKey) {
    return NextResponse.json(
      { ok: false, error: `Refused raw media field "${rawMediaKey}".` },
      { status: 400 }
    );
  }

  const parsed = bedsideCheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid bedside check-in payload." },
      { status: 400 }
    );
  }

  const rate = checkRateLimit(getClientKey(request, "arduino-checkin"), 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const auth = authenticateDevice(
    request,
    parsed.data.deviceId,
    parsed.data.timestampMs,
    parsed.data.nonce,
    parsed.data.isSimulated
  );
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

    const outcome = await saveArduinoBedsideCheckIn(parsed.data);
  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: outcome.error,
        showCrisisPath: outcome.showCrisisPath,
        crisisResources: outcome.crisisResources,
      },
      { status: outcome.status }
    );
  }

  return NextResponse.json(outcome);
}
