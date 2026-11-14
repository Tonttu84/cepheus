import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { getStaffSecondFactorKind, readSessionFromRequest } from "@/server/auth";

export async function GET(request: Request): Promise<NextResponse> {
  const session = readSessionFromRequest(request);
  return NextResponse.json(
    {
      ok: true,
      session,
      demoMode: getEnv().NODE_ENV !== "production",
      secondFactor: getStaffSecondFactorKind(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
