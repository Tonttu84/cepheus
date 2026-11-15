import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export interface SimulatedPatientDemoSummary {
  readonly id: string;
  readonly participantCode: string;
  readonly label: string;
  readonly missedRoundsCount: number;
  readonly openWarnings: readonly string[];
}

export async function getSimulatedPatientSummaries(
  prisma: PrismaClient = getPrisma()
): Promise<readonly SimulatedPatientDemoSummary[]> {
  const participants = await prisma.participant.findMany({
    where: { isSimulated: true },
    select: {
      id: true,
      participantCode: true,
      label: true,
    },
    orderBy: { participantCode: "asc" },
  });

  const results: SimulatedPatientDemoSummary[] = [];

  for (const p of participants) {
    const missedRoundsCount = await prisma.checkInRound.count({
      where: {
        participantId: p.id,
        status: "missed",
      },
    });

    const flags = await prisma.clinicFlag.findMany({
      where: {
        participantId: p.id,
        causeType: { not: null },
      },
      select: {
        triggerKind: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    results.push({
      id: p.id,
      participantCode: p.participantCode ?? p.id,
      label: p.label ?? "Simulated participant",
      missedRoundsCount,
      openWarnings: flags.filter((f) => f.status === "open").map((f) => f.triggerKind),
    });
  }

  return results;
}

export async function getSimulatedPatientIds(
  prisma: PrismaClient = getPrisma()
): Promise<readonly string[]> {
  const participants = await prisma.participant.findMany({
    where: { isSimulated: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return participants.map((p) => p.id);
}
