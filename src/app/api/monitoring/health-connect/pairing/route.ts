import { NextResponse } from "next/server";
import { requireApiSession } from "@/server/auth";
import {
  getHealthConnectPairingStatus,
  provisionOrRotateHealthConnectPairing,
  revokeHealthConnectPairing,
} from "@/server/monitoring";
import { checkRateLimit, getClientKey, verifySameOrigin } from "@/server/security";

export const dynamic = "force-dynamic";

function rateLimitedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { ok: false, error: "Rate limit exceeded." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

function forbiddenOriginResponse() {
  return NextResponse.json(
    { ok: false, error: "Cross-origin requests are not allowed." },
    { status: 403 }
  );
}

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "hc-pairing-get"), 60, 60_000);
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSec);
  }

  const status = await getHealthConnectPairingStatus(
    new URL(request.url).origin,
    undefined,
    auth.session
  );
  return NextResponse.json({ ok: true, status });
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "hc-pairing-post"), 20, 60_000);
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSec);
  }

  const result = await provisionOrRotateHealthConnectPairing(
    new URL(request.url).origin,
    undefined,
    auth.session
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    pairing: result.pairing,
    status: result.status,
  });
}

export async function DELETE(request: Request) {
  if (!verifySameOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "hc-pairing-delete"), 20, 60_000);
  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSec);
  }

  const status = await revokeHealthConnectPairing(
    new URL(request.url).origin,
    undefined,
    auth.session
  );
  return NextResponse.json({ ok: true, status });
}
