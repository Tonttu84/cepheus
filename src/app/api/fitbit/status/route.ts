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

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const configured = isFitbitConfigured();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(FITBIT_TOKEN_COOKIE)?.value;
  const session = unsealJson<FitbitSealedSession>(rawToken);
  const connected = Boolean(
    session &&
      (!session.participantCode ||
        session.participantCode === auth.session.participantCode)
  );

  return NextResponse.json({
    ok: true,
    configured,
    connected,
    scope: connected ? (session?.scope ?? null) : null,
    expiresAtMs: connected ? (session?.expiresAtMs ?? null) : null,
  });
}
