import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { getRouteDeps } from "@/server/api";
import { getPatientConsent, updateMethodConsent } from "@/usecases";

export const dynamic = "force-dynamic";

const ConsentUpdateRequestSchema = z
  .object({
    method: z.enum(["ring", "camera", "ring_rhythm", "camera_expressivity"]),
    enabled: z.boolean(),
  })
  .strict();

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const { actor } = auth.session;
  const { ports } = getRouteDeps();
  const result = await getPatientConsent(actor, { patientId: actor.patientId }, ports);
  if (!result.ok) {
    const status = result.error === "not_own_data" ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, consent: result.value.consent });
}

export async function POST(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ConsentUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request payload" }, { status: 400 });
  }

  const { actor } = auth.session;
  const { ports } = getRouteDeps();
  const result = await updateMethodConsent(
    actor,
    {
      patientId: actor.patientId,
      method: parsed.data.method,
      enabled: parsed.data.enabled,
    },
    ports
  );

  if (!result.ok) {
    const status = result.error === "not_own_data" ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    method: result.value.method,
    enabled: result.value.enabled,
  });
}
