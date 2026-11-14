import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/server/auth";
import {
  FITBIT_TOKEN_COOKIE,
  isFitbitConfigured,
  type FitbitSealedSession,
} from "@/server/fitbit/client";
import { unsealJson } from "@/server/security";

export const dynamic = "force-dynamic";

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

  const url = new URL(request.url);
  const requestedId =
    url.searchParams.get("patientId") ?? url.searchParams.get("participantCode");
  if (
    requestedId &&
    requestedId !== auth.session.actor.patientId &&
    requestedId !== auth.session.participantCode
  ) {
    return NextResponse.json(
      { ok: false, code: "forbidden", error: "Access denied." },
      { status: 403 }
    );
  }

  const configured = isFitbitConfigured();
  let rawToken = readCookie(request, FITBIT_TOKEN_COOKIE);
  if (!rawToken) {
    const cookieStore = await cookies().catch(() => null);
    rawToken = cookieStore?.get(FITBIT_TOKEN_COOKIE)?.value;
  }
  const session = unsealJson<FitbitSealedSession>(rawToken);

  if (
    session &&
    session.patientId &&
    session.patientId !== auth.session.actor.patientId
  ) {
    return NextResponse.json(
      { ok: false, code: "forbidden", error: "Access denied." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    configured,
    connected: Boolean(session),
    scope: session?.scope ?? null,
    expiresAtMs: session?.expiresAtMs ?? null,
  });
}
