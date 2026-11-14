import { NextResponse } from "next/server";
import { requireApiSession } from "@/server/auth";
import { getEnv } from "@/server/env";
import {
  buildFitbitAuthorizeUrl,
  FITBIT_STATE_COOKIE,
  isFitbitConfigured,
  resolveFitbitRedirectUri,
} from "@/server/fitbit/client";
import {
  checkRateLimit,
  generatePkcePair,
  generateStateToken,
  getClientKey,
  sealJson,
} from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "fitbit-auth"), 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many authorization attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  if (!isFitbitConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Fitbit OAuth is not configured (set FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, and FITBIT_REDIRECT_URI in .env).",
      },
      { status: 503 }
    );
  }

  const state = generateStateToken();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const redirectUri = resolveFitbitRedirectUri();

  const sealedState = sealJson(
    {
      state,
      codeVerifier,
      redirectUri,
      participantCode: auth.session.participantCode,
    },
    10 * 60_000
  );

  const authorizeUrl = buildFitbitAuthorizeUrl({
    state,
    codeChallenge,
    redirectUri,
  });

  const env = getEnv();
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(FITBIT_STATE_COOKIE, sealedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/api/fitbit",
    maxAge: 600,
  });
  return response;
}
