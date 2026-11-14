import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/server/auth";
import { getEnv } from "@/server/env";
import {
  exchangeFitbitCode,
  FITBIT_STATE_COOKIE,
  FITBIT_TOKEN_COOKIE,
  isFitbitConfigured,
  type FitbitSealedSession,
} from "@/server/fitbit/client";
import {
  checkRateLimit,
  getClientKey,
  sealJson,
  timingSafeEqualString,
  unsealJson,
} from "@/server/security";

export const dynamic = "force-dynamic";

interface SealedOAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  patientId?: string;
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookieHeader);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "fitbit-cb"), 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const env = getEnv();
  const reqUrl = new URL(request.url);
  const monitoringUrl = new URL("/monitoring", reqUrl.origin);

  const queryPatientId =
    reqUrl.searchParams.get("patientId") ??
    reqUrl.searchParams.get("participantCode");
  if (
    queryPatientId &&
    queryPatientId !== auth.session.actor.patientId &&
    queryPatientId !== auth.session.participantCode
  ) {
    return NextResponse.json(
      { ok: false, code: "forbidden", error: "Access denied." },
      { status: 403 }
    );
  }

  if (!isFitbitConfigured()) {
    monitoringUrl.searchParams.set("fitbit", "not_configured");
    return NextResponse.redirect(monitoringUrl);
  }

  const oauthError = reqUrl.searchParams.get("error");
  if (oauthError) {
    monitoringUrl.searchParams.set("fitbit", "denied");
    const deniedResp = NextResponse.redirect(monitoringUrl);
    deniedResp.cookies.delete(FITBIT_STATE_COOKIE);
    return deniedResp;
  }

  const code = reqUrl.searchParams.get("code") ?? "";
  const returnedState = reqUrl.searchParams.get("state") ?? "";

  let rawStateCookie = readCookie(request, FITBIT_STATE_COOKIE);
  if (!rawStateCookie) {
    const cookieStore = await cookies().catch(() => null);
    rawStateCookie = cookieStore?.get(FITBIT_STATE_COOKIE)?.value;
  }
  const sealedState = unsealJson<SealedOAuthState>(rawStateCookie);

  if (
    !sealedState ||
    !code ||
    !returnedState ||
    !timingSafeEqualString(returnedState, sealedState.state)
  ) {
    monitoringUrl.searchParams.set("fitbit", "state_error");
    const badResp = NextResponse.redirect(monitoringUrl);
    badResp.cookies.delete(FITBIT_STATE_COOKIE);
    return badResp;
  }

  if (
    sealedState.patientId &&
    sealedState.patientId !== auth.session.actor.patientId
  ) {
    return NextResponse.json(
      { ok: false, code: "forbidden", error: "Access denied." },
      { status: 403 }
    );
  }

  try {
    const session = await exchangeFitbitCode({
      code,
      codeVerifier: sealedState.codeVerifier,
      redirectUri: sealedState.redirectUri,
    });

    const sessionWithPatient: FitbitSealedSession = {
      ...session,
      patientId: auth.session.actor.patientId,
    };
    const sealedSession = sealJson(sessionWithPatient, 30 * 24 * 60 * 60_000);
    monitoringUrl.searchParams.set("fitbit", "connected");
    const okResp = NextResponse.redirect(monitoringUrl);
    okResp.cookies.delete(FITBIT_STATE_COOKIE);
    okResp.cookies.set(FITBIT_TOKEN_COOKIE, sealedSession, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return okResp;
  } catch {
    monitoringUrl.searchParams.set("fitbit", "exchange_failed");
    const errResp = NextResponse.redirect(monitoringUrl);
    errResp.cookies.delete(FITBIT_STATE_COOKIE);
    return errResp;
  }
}
