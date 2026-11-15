import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { checkRateLimit, getClientKey, verifySameOrigin } from "@/server/security";
import { getRouteDeps } from "@/server/api";
import { updateMethodConsent } from "@/server/monitoring";

export const dynamic = "force-dynamic";

const ConsentFormSchema = z
  .object({
    takingPart: z.literal(true),
    methods: z
      .object({
        ring_rhythm: z.boolean().default(false),
        camera_expressivity: z.boolean().default(false),
        home_routine: z.boolean().default(false),
        facial_movement_usual_range: z.boolean().default(false),
      })
      .default({
        ring_rhythm: false,
        camera_expressivity: false,
        home_routine: false,
        facial_movement_usual_range: false,
      }),
    detailedAnswers: z.boolean().default(false),
  })
  .strict();

type ConsentFormData = z.infer<typeof ConsentFormSchema>;

async function saveConsentChoices(data: ConsentFormData, session: Parameters<typeof updateMethodConsent>[3]) {
  if (!session) throw new Error("No session");
  const { actor } = session;
  const { ports } = getRouteDeps();
  const patient = await ports.patients.getPatient(actor.patientId);
  if (!patient) return null;

  const { methods, detailedAnswers } = data;
  const updated = {
    ...patient,
    consent: {
      ...patient.consent,
      taking_part: true,
      methods: {
        ring: methods.ring_rhythm,
        camera: methods.camera_expressivity,
      },
      detailed_answers: detailedAnswers,
      facial_movement_usual_range: methods.facial_movement_usual_range,
    },
  };

  await ports.patients.savePatient(updated);

  if (methods.home_routine) {
    await updateMethodConsent("home_routine", true, undefined, session);
  }
  return true;
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }

  const auth = requireApiSession(request, "patient");
  if (!auth.ok) return auth.response;

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
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ConsentFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid consent choices." }, { status: 400 });
  }

  try {
    const saved = await saveConsentChoices(parsed.data, auth.session);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "Patient record not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, redirectUrl: "/check-in" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message || "Failed to record consent." },
      { status: 500 }
    );
  }
}
