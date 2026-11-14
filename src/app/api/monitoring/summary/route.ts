import { NextResponse } from "next/server";
import { getMonitoringSummary } from "@/server/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getMonitoringSummary();
    return NextResponse.json({ ok: true, summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to load monitoring summary." },
      { status: 500 }
    );
  }
}
