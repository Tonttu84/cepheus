import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { getEnv } from "@/server/env";
import {
  fetchFitbitWindowDays,
  FITBIT_TOKEN_COOKIE,
  isFitbitConfigured,
  type FitbitSealedSession,
} from "@/server/fitbit/client";
import {
  buildSimulatedFitbitWeek,
  saveWearableDaysAndComputeRhythm,
} from "@/server/monitoring";
import {
  checkRateLimit,
  getClientKey,
  sealJson,
  unsealJson,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const syncBodySchema = z
  .object({
    mode: z.enum(["live", "simulated"]).default("live"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }

  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const limit = checkRateLimit(getClientKey(request, "fitbit-sync"), 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many sync requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let bodyRaw: unknown = {};
  try {
    const text = await request.text();
    if (text.length > 4096) {
      return NextResponse.json(
        { ok: false, error: "Request body too large." },
        { status: 413 }
      );
    }
    bodyRaw = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = syncBodySchema.safeParse(bodyRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid sync request parameters." },
      { status: 400 }
    );
  }

  const endDate = parsed.data.endDate ?? new Date().toISOString().slice(0, 10);

  if (parsed.data.mode === "simulated") {
    const simDays = buildSimulatedFitbitWeek(endDate);
    const saved = await saveWearableDaysAndComputeRhythm(simDays, {
      isSimulated: true,
      sourceLabel: "simulated_fitbit",
    });

    if (!saved.ok) {
      return NextResponse.json(
        { ok: false, error: saved.error },
        { status: saved.status }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "simulated",
      isSimulated: true,
      intradayUsed: true,
      savedDays: saved.savedDays,
      rhythmComputed: saved.rhythmComputed,
      rhythmError: saved.rhythmError,
    });
  }

  if (!isFitbitConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Fitbit OAuth is not configured on this server.",
      },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(FITBIT_TOKEN_COOKIE)?.value;
  const session = unsealJson<FitbitSealedSession>(rawToken);

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Fitbit account is not connected." },
      { status: 401 }
    );
  }

  try {
    const { days, updatedSession, intradayUsed } = await fetchFitbitWindowDays(
      session,
      endDate,
      7
    );

    const saved = await saveWearableDaysAndComputeRhythm(days, {
      isSimulated: false,
      sourceLabel: "fitbit",
    });

    if (!saved.ok) {
      return NextResponse.json(
        { ok: false, error: saved.error },
        { status: saved.status }
      );
    }

    const env = getEnv();
    const response = NextResponse.json({
      ok: true,
      mode: "live",
      isSimulated: false,
      intradayUsed,
      savedDays: saved.savedDays,
      rhythmComputed: saved.rhythmComputed,
      rhythmError: saved.rhythmError,
    });

    if (updatedSession.accessToken !== session.accessToken) {
      response.cookies.set(
        FITBIT_TOKEN_COOKIE,
        sealJson(updatedSession, 30 * 24 * 60 * 60_000),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: env.NODE_ENV === "production",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        }
      );
    }

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to sync Fitbit data. Reconnect Fitbit if expired." },
      { status: 502 }
    );
  }
}
