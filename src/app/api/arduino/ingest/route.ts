import { NextResponse } from "next/server";
import { evaluateArduinoEdgePayload } from "@/domain/arduino";
import { getEnv } from "@/server/env";
import { saveArduinoEdgeIngest } from "@/server/monitoring";
import {
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  timingSafeEqualString,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const MAX_INGEST_BYTES = 16_384;

export async function POST(request: Request) {
  const limit = checkRateLimit(getClientKey(request, "arduino-ingest"), 60, 60_000);
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
      { ok: false, error: "Unable to read request body." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, "utf8") > MAX_INGEST_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Payload exceeds 16 KB limit. Only derived numeric summaries may be sent (never raw frames or audio).",
      },
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

  const evaluated = evaluateArduinoEdgePayload(body);
  if (!evaluated.ok) {
    return NextResponse.json(
      { ok: false, error: evaluated.error },
      { status: 400 }
    );
  }

  const env = getEnv();
  const bearer = extractBearerToken(request);
  const sameOriginUiSimulation =
    verifySameOrigin(request) &&
    Boolean(
      (body as { isSimulated?: unknown }).isSimulated === true
    );

  if (env.ARDUINO_INGEST_TOKEN.length > 0) {
    const validToken =
      bearer !== null && timingSafeEqualString(bearer, env.ARDUINO_INGEST_TOKEN);
    if (!validToken && !sameOriginUiSimulation) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized hardware ingest token." },
        { status: 401 }
      );
    }
  } else if (env.NODE_ENV === "production" && !sameOriginUiSimulation) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ARDUINO_INGEST_TOKEN must be configured in production for hardware ingestion.",
      },
      { status: 401 }
    );
  }

  const persisted = await saveArduinoEdgeIngest(evaluated.value);

  return NextResponse.json({
    ok: true,
    deviceId: evaluated.value.deviceId,
    date: evaluated.value.date,
    ...persisted,
    lightCue: evaluated.value.lightCue,
  });
}
