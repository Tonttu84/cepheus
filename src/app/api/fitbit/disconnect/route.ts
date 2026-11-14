import { NextResponse } from "next/server";
import { FITBIT_STATE_COOKIE, FITBIT_TOKEN_COOKIE } from "@/server/fitbit/client";
import { verifySameOrigin } from "@/server/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ ok: true, disconnected: true });
  response.cookies.delete(FITBIT_TOKEN_COOKIE);
  response.cookies.delete(FITBIT_STATE_COOKIE);
  return response;
}
