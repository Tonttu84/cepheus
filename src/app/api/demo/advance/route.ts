import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  advanceDemoAndRunSystemWork,
  getDemoClock,
  getDemoOffsetDays,
  getDemoOffsetMs,
  getSwitches,
  isDemoEnabled,
} from "@/server/api";
import { requireApiSession } from "@/server/auth";
import { getSimulatedPatientSummaries } from "@/server/db";

export const dynamic = "force-dynamic";

const AdvanceInputSchema = z.object({
  days: z.number().int().min(1).max(60),
});

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isDemoEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Demo mode is not enabled" },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdvanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Days must be an integer between 1 and 60", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const adv = await advanceDemoAndRunSystemWork(parsed.data.days);
  if (!adv.ok) {
    return NextResponse.json({ ok: false, error: adv.error }, { status: 400 });
  }

  const now = getDemoClock().now();
  const offsetDays = getDemoOffsetDays();
  const offsetMs = getDemoOffsetMs();
  const switches = getSwitches();
  const patients = await getSimulatedPatientSummaries();

  return NextResponse.json({
    ok: true,
    isSimulated: true,
    now,
    offsetDays,
    offsetMs,
    switches,
    patients,
  });
}
