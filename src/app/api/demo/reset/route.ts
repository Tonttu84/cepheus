import { NextRequest, NextResponse } from "next/server";
import {
  getDemoClock,
  getDemoOffsetDays,
  getDemoOffsetMs,
  getSwitches,
  isDemoEnabled,
} from "@/server/api";
import { requireApiSession } from "@/server/auth";
import { getSimulatedPatientSummaries, resetSimulatedData } from "@/server/db";

export const dynamic = "force-dynamic";

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

  await resetSimulatedData();

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
