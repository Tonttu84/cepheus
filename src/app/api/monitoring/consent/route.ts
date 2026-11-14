import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { updateMethodConsent } from "@/server/monitoring";
import {
  checkRateLimit,
  getClientKey,
  verifySameOrigin,
} from "@/server/security";

export const dynamic = "force-dynamic";

const consentSchema = z
  .object({
    method: z.enum(["ring_rhythm", "camera_expressivity", "home_routine"]),
    enabled: z.boolean(),
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

  const limit = checkRateLimit(getClientKey(request, "consent"), 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid consent parameters." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateMethodConsent(
      parsed.data.method,
      parsed.data.enabled
    );
    return NextResponse.json({ ok: true, consent: updated });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to update consent setting." },
      { status: 500 }
    );
  }
}
