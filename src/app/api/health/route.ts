import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let participantCount = 0;
  try {
    participantCount = await prisma.participant.count();
  } catch {
    participantCount = 0;
  }

  return NextResponse.json({
    ok: true,
    database: "sqlite",
    participantCount,
    isSimulated: true,
  });
}
