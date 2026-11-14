import { NextResponse } from "next/server";
import { SignInRequestSchema } from "@/lib/auth-types";
import {
  applySessionCookie,
  authenticateStaffCredentials,
  getStaffSecondFactorKind,
  simulatedFinnishEidProvider,
} from "@/server/auth";
import {
  checkRateLimit,
  getClientKey,
  verifySameOrigin,
} from "@/server/security";

async function handlePatientSignIn(
  participantCode: string
): Promise<NextResponse> {
  const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset(
    participantCode
  );
  if (!session) {
    return NextResponse.json(
      { ok: false, code: "invalid_credentials", message: "Invalid credentials." },
      { status: 401 }
    );
  }
  const response = NextResponse.json(
    { ok: true, session, secondFactor: getStaffSecondFactorKind() },
    { headers: { "Cache-Control": "no-store" } }
  );
  applySessionCookie(response, session);
  return response;
}

async function handleStaffSignIn(input: {
  email: string;
  password: string;
  totpCode: string;
}): Promise<NextResponse> {
  const staffResult = await authenticateStaffCredentials(input);
  if (!staffResult.ok) {
    return NextResponse.json(
      { ok: false, code: staffResult.code, message: staffResult.message },
      { status: staffResult.status }
    );
  }
  const response = NextResponse.json(
    {
      ok: true,
      session: staffResult.session,
      secondFactor: getStaffSecondFactorKind(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  applySessionCookie(response, staffResult.session);
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, code: "forbidden_origin", message: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const rateLimit = checkRateLimit(
    getClientKey(request, "auth-signin"),
    10,
    60_000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many sign-in attempts." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = SignInRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "invalid_request", message: "Invalid sign-in payload." },
      { status: 400 }
    );
  }

  if (parsed.data.mode === "patient_eid") {
    return handlePatientSignIn(parsed.data.participantCode);
  }

  return handleStaffSignIn({
    email: parsed.data.email,
    password: parsed.data.password,
    totpCode: parsed.data.totpCode,
  });
}
