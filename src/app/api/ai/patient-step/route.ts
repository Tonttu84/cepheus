import { NextResponse } from "next/server";
import { z } from "zod";
import { SAFE_ACTION_KEYS } from "@/domain/ai-support";
import { getEnv } from "@/server/env";
import { generateTailoredPatientStep } from "@/server/verda/client";

export const dynamic = "force-dynamic";

const buckets = new Map<string, number[]>();

function isRateLimited(): boolean {
  const now = Date.now();
  const prev = (buckets.get("patient-step") ?? []).filter((t) => t > now - 60_000);
  if (prev.length >= 30) {
    buckets.set("patient-step", prev);
    return true;
  }
  prev.push(now);
  buckets.set("patient-step", prev);
  return false;
}

function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const candidate = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !candidate) return false;
  try {
    return new URL(candidate).host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

const patientStepBodySchema = z
  .object({
    participantCode: z.string().min(2).max(64),
    dayIndex: z.number().int().min(1).max(3650),
    broadAreasShifted: z.array(z.string().min(1).max(40)).max(5),
    lowDaylight: z.boolean(),
    highStationaryBout: z.boolean(),
    pastActionOutcomes: z
      .array(
        z.object({
          actionKey: z.enum(SAFE_ACTION_KEYS),
          completedCount: z.number().int().min(0).max(500),
          averageNextDelta: z.number().min(-5).max(5).nullable(),
        })
      )
      .max(10),
    isSimulated: z.boolean().default(true),
  })
  .strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }
  if (isRateLimited()) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429 }
    );
  }

  if (!getEnv().VERDA_PATIENT_STEP_ENABLED) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Patient-facing AI step tailoring is disabled (pending team approval; off by default).",
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patientStepBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid patient-step parameters." },
      { status: 400 }
    );
  }

  const response = await generateTailoredPatientStep(parsed.data);
  return NextResponse.json({
    ok: true,
    isSimulated: parsed.data.isSimulated,
    ...response,
  });
}
