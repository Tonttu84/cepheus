import { NextResponse } from "next/server";
import { requireApiSession } from "@/server/auth";
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
 * participant (`demo-home-node-01`). Requires session authentication and
 * enforces role-based D8 redaction for clinic staff.
 */
export async function GET(request: Request) {
  const auth = requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const env = getEnv();
    const viewer = auth.session.kind === "staff" ? "staff" : "patient";
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
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }
  return NextResponse.json({
    ok: true,
    demoOnly: true,
    payload: buildSimulatedHealthConnectPayload(),
  });
}
