import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import {
  buildSimulatedHealthConnectPayload,
  getMonitoringSummary,
} from "@/server/monitoring";
import { verifySameOrigin } from "@/server/security";

export const dynamic = "force-dynamic";

/**
 * DEMO-ONLY ENDPOINT:
 * Reads and simulates home-monitoring data for the single pseudonymous demo
 * participant (`demo-home-node-01`) prior to Step 6 session authentication.
 * Must not hold real patient data; checks `decideAccess` (patient vs staff D8).
 */
export async function GET(request: Request) {
  try {
    const env = getEnv();
    const url = new URL(request.url);
    const viewer = url.searchParams.get("viewer") === "staff" ? "staff" : "patient";
    const summary = await getMonitoringSummary(viewer);
    return NextResponse.json({
      ok: true,
      demoOnly: true,
      healthConnectConfigured: env.HEALTH_CONNECT_WEBHOOK_SECRET.length > 0,
      summary,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to load monitoring summary." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }
  return NextResponse.json({
    ok: true,
    demoOnly: true,
    payload: buildSimulatedHealthConnectPayload(),
  });
}
