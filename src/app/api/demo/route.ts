import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MOMENTS, type DemoMomentKey } from "@/lib/constants";
import {
  generateSimulatedPersonWeeks,
  sliceDatasetThroughDay,
} from "@/lib/simulation";
import {
  advanceDemoAndRunSystemWork,
  getDemoClock,
  getDemoOffsetDays,
  getDemoOffsetMs,
  getSwitches,
  isDemoEnabled,
  setSwitch,
} from "@/server/api";
import { requireApiSession } from "@/server/auth";
import {
  checkDemoNeedsReset,
  getSimulatedPatientSummaries,
  resetSimulatedData,
} from "@/server/db";

export const dynamic = "force-dynamic";

function resolveMomentKey(raw: string | null): DemoMomentKey {
  if (raw === "well" || raw === "small_dip" || raw === "sustained_drift") {
    return raw;
  }
  return "sustained_drift";
}

const PostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("advance"),
    days: z.number().int().min(1).max(60),
  }),
  z.object({
    action: z.literal("reset"),
  }),
  z.object({
    action: z.literal("switch"),
    key: z.enum(["rewards", "counters", "extraQuestion"]),
    enabled: z.boolean(),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);

  // Preserve foundation test behavior if ?moment= is requested
  if (searchParams.has("moment")) {
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

  if (!isDemoEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Demo mode is not enabled" },
      { status: 404 }
    );
  }

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

  const parsed = PostActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body", details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.action === "advance") {
    const isResetRequired = await checkDemoNeedsReset(undefined, new Date(getDemoClock().now()));
    if (isResetRequired) {
      return NextResponse.json(
        { ok: false, error: "Reset required: stored demo data is ahead of current time" },
        { status: 400 }
      );
    }
    const adv = await advanceDemoAndRunSystemWork(parsed.data.days);
    if (!adv.ok) {
      return NextResponse.json({ ok: false, error: adv.error }, { status: 400 });
    }
  } else if (parsed.data.action === "reset") {
    await resetSimulatedData();
  } else if (parsed.data.action === "switch") {
    setSwitch(parsed.data.key, parsed.data.enabled);
  }

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
