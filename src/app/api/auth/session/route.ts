import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { readSessionFromRequest } from "@/server/auth";

export async function GET(request: Request): Promise<NextResponse> {
  const session = readSessionFromRequest(request);
  return NextResponse.json(
    {
      ok: true,
      session,
      demoMode: getEnv().NODE_ENV !== "production",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
