import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let participantCount = 0;
  try {
    const prisma = getPrisma();
    participantCount = await prisma.participant.count();
  } catch {
    participantCount = 0;
  }

  return NextResponse.json({
    ok: true,
    database: "postgresql",
    participantCount,
    isSimulated: true,
  });
}
