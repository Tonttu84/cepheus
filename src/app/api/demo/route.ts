import { NextRequest, NextResponse } from "next/server";
import { DEMO_MOMENTS, type DemoMomentKey } from "@/lib/constants";
import {
  generateSimulatedPersonWeeks,
  sliceDatasetThroughDay,
} from "@/lib/simulation";
import { requireApiSession } from "@/server/auth";

export const dynamic = "force-dynamic";

function resolveMomentKey(raw: string | null): DemoMomentKey {
  if (raw === "well" || raw === "small_dip" || raw === "sustained_drift") {
    return raw;
  }
  return "sustained_drift";
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const momentKey = resolveMomentKey(searchParams.get("moment"));
  const meta = DEMO_MOMENTS[momentKey];

  const fullDataset = generateSimulatedPersonWeeks();
  const sliced = sliceDatasetThroughDay(fullDataset, meta.dayIndex);

  return NextResponse.json({
    ok: true,
    isSimulated: true,
    moment: meta,
    participant: sliced.participant,
    counts: {
      ringDays: sliced.ringDays.length,
      checkInRounds: sliced.checkInRounds.length,
      phq9Assessments: sliced.phq9Assessments.length,
      rhythmWindows: sliced.rhythmWindows.length,
      cameraReadings: sliced.cameraReadings.length,
      patientSuggestions: sliced.patientSuggestions.length,
      clinicFlags: sliced.clinicFlags.length,
    },
    latestCheckIn:
      sliced.checkInRounds[sliced.checkInRounds.length - 1] ?? null,
    activeSuggestion:
      sliced.patientSuggestions[sliced.patientSuggestions.length - 1] ?? null,
    activeClinicFlag:
      sliced.clinicFlags[sliced.clinicFlags.length - 1] ?? null,
  });
}
