import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";
import { verifySameOrigin } from "@/server/security";

export async function POST(request: Request): Promise<NextResponse> {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, code: "forbidden_origin", message: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(response);
  return response;
}
