import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { verifySameOrigin } from "@/server/security";
import { getRouteDeps } from "@/server/api";
import { getPatientConsent } from "@/usecases";
import { updateMethodConsent, type MonitoredMethodKey } from "@/server/monitoring/store";

export const dynamic = "force-dynamic";

const ConsentUpdateRequestSchema = z
  .object({
    method: z.enum([
      "ring",
      "camera",
      "ring_rhythm",
      "camera_expressivity",
      "facial_movement_usual_range",
    ]),
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

  const mappedMethod: MonitoredMethodKey = 
    parsed.data.method === "ring" ? "ring_rhythm" :
    parsed.data.method === "camera" ? "camera_expressivity" :
    parsed.data.method as MonitoredMethodKey;

  try {
    const result = await updateMethodConsent(
      mappedMethod,
      parsed.data.enabled,
      undefined,
      auth.session
    );
    return NextResponse.json({
      ok: true,
      method: result.method === "ring_rhythm" ? "ring" : result.method === "camera_expressivity" ? "camera" : result.method,
      enabled: result.enabled,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const status = errorMsg.includes("Access denied") ? 403 : 400;
    return NextResponse.json({ ok: false, error: errorMsg }, { status });
  }
}
