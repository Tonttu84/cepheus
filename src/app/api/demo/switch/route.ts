import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getDemoClock,
  getDemoOffsetDays,
  getDemoOffsetMs,
  getSwitches,
  isDemoEnabled,
  setSwitch,
} from "@/server/api";
import { requireApiSession } from "@/server/auth";
import { checkDemoNeedsReset, getSimulatedPatientSummaries } from "@/server/db";

export const dynamic = "force-dynamic";

const SwitchInputSchema = z.object({
  key: z.enum(["rewards", "counters", "extraQuestion"]),
  enabled: z.boolean(),
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

  const parsed = SwitchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid switch input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  setSwitch(parsed.data.key, parsed.data.enabled);

  const now = getDemoClock().now();
  const offsetDays = getDemoOffsetDays();
  const offsetMs = getDemoOffsetMs();
  const switches = getSwitches();
  const patients = await getSimulatedPatientSummaries();
  const needsReset = await checkDemoNeedsReset(undefined, new Date(now));

  return NextResponse.json({
    ok: true,
    isSimulated: true,
    now,
    offsetDays,
    offsetMs,
    needsReset,
    switches,
    patients,
  });
}
