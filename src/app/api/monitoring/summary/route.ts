import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import {
  buildSimulatedHealthConnectPayload,
  getMonitoringSummary,
} from "@/server/monitoring";
import { verifySameOrigin } from "@/server/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getEnv();
    const summary = await getMonitoringSummary();
    return NextResponse.json({
      ok: true,
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
    payload: buildSimulatedHealthConnectPayload(),
  });
}
