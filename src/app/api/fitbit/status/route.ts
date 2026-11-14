import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FITBIT_TOKEN_COOKIE,
  isFitbitConfigured,
  type FitbitSealedSession,
} from "@/server/fitbit/client";
import { unsealJson } from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isFitbitConfigured();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(FITBIT_TOKEN_COOKIE)?.value;
  const session = unsealJson<FitbitSealedSession>(rawToken);

  return NextResponse.json({
    ok: true,
    configured,
    connected: Boolean(session),
    scope: session?.scope ?? null,
    expiresAtMs: session?.expiresAtMs ?? null,
  });
}
