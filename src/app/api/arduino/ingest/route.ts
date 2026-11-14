import { NextResponse } from "next/server";
import { evaluateArduinoEdgePayload, type EvaluatedArduinoEdgeIngest } from "@/domain/arduino";
import { getEnv } from "@/server/env";
import { saveArduinoEdgeIngest } from "@/server/monitoring";
import {
  checkAndRecordDeviceReplay,
  checkRateLimit,
  extractBearerToken,
  getClientKey,
  verifyArduinoDeviceCredential,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const MAX_INGEST_BYTES = 16_384;

function authenticateHardwareRequest(
  request: Request,
  evaluated: EvaluatedArduinoEdgeIngest,
  rawIsSimulated: boolean
): { ok: true } | { ok: false; status: 401 | 409; error: string } {
  const env = getEnv();
  // The Origin header can be set by any script, so this shortcut for the
  // dashboard's simulated push exists only outside production.
  const sameOriginUiSimulation =
    env.NODE_ENV !== "production" && verifySameOrigin(request) && rawIsSimulated;
  if (sameOriginUiSimulation) {
    return { ok: true };
  }

  const hasAnyCredentialConfig =
    env.ARDUINO_DEVICE_KEYS_JSON.length > 0 || env.ARDUINO_INGEST_TOKEN.length > 0;

  if (!hasAnyCredentialConfig && env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 401,
      error: "Hardware device credentials must be configured in production.",
    };
  }

  if (hasAnyCredentialConfig) {
    const bearer = extractBearerToken(request);
    const credCheck = verifyArduinoDeviceCredential(evaluated.deviceId, bearer);
    if (!credCheck.ok) {
      return { ok: false, status: 401, error: credCheck.reason };
    }
    const replayCheck = checkAndRecordDeviceReplay(
      evaluated.deviceId,
      evaluated.timestampMs,
      evaluated.nonce
    );
    if (!replayCheck.ok) {
      return { ok: false, status: replayCheck.status, error: replayCheck.reason };
    }
  }

  return { ok: true };
}

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: false, error: evaluated.error }, { status: 400 });
  }

  // Before authentication the device id is unchecked, so the limit is keyed on
  // the route alone; changing the device id must not give a fresh limit.
  const rate = checkRateLimit(getClientKey(request, "arduino-ingest"), 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const rawIsSimulated = Boolean((body as { isSimulated?: unknown }).isSimulated === true);
  const auth = authenticateHardwareRequest(request, evaluated.value, rawIsSimulated);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const persisted = await saveArduinoEdgeIngest(evaluated.value);
  if (!persisted.ok) {
    return NextResponse.json(
      { ok: false, error: persisted.error },
      { status: persisted.status }
    );
  }

  return NextResponse.json({
    ok: true,
    deviceId: evaluated.value.deviceId,
    date: evaluated.value.date,
    savedCamera: persisted.savedCamera,
    savedRoutineCount: persisted.savedRoutineCount,
    skippedForConsent: persisted.skippedForConsent,
    lightCue: evaluated.value.lightCue,
  });
}
