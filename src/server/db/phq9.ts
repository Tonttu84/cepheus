import type { Phq9Assessment } from "@prisma/client";
import type { Phq9Progress } from "@/domain/rounds";
import { listRounds } from "@/domain/rounds";
import type { Phq9Repository, StoredPhq9 } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope, roundColumnsFor } from "./participant-scope";
import { PHQ9_COLUMN_BY_ID } from "./phq9-columns";

const ITEM_IDS = Object.keys(PHQ9_COLUMN_BY_ID) as (keyof typeof PHQ9_COLUMN_BY_ID)[];

function progressFromColumn(status: string): Phq9Progress {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "unfinished";
  if (status === "missed") return "not_started";
  throw new Error(`Unknown PHQ-9 status: ${status}`);
}

function toStoredPhq9(row: Phq9Assessment): StoredPhq9 {
  const progress = progressFromColumn(row.status);
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    progress,
    answers: ITEM_IDS.flatMap((id) => {
      const value = row[PHQ9_COLUMN_BY_ID[id]];
      return value === null ? [] : [{ id, value }];
    }),
    total: row.totalScore,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedInRoundNumber: row.completedInRoundNumber,
    date: progress === "completed" ? row.date : null,
  };
}

function itemColumns(assessment: StoredPhq9) {
  return Object.fromEntries(
    ITEM_IDS.map((id) => [
      PHQ9_COLUMN_BY_ID[id],
      assessment.answers.find((answer) => answer.id === id)?.value ?? null,
    ])
  );
}

export function createPhq9Repository(ctx: DbContext): Phq9Repository {
  async function getPhq9s(patientId: string) {
    const rows = await ctx.client().phq9Assessment.findMany({
      where: { participantId: patientId },
      orderBy: { roundNumber: "asc" },
    });
    return rows.map(toStoredPhq9);
  }

  return {
    getPhq9s,

    async getCurrentPhq9(patientId) {
      const all = await getPhq9s(patientId);
      return all.find((p) => p.progress === "unfinished") ?? all.at(-1) ?? null;
    },

    async savePhq9(assessment) {
      const { clinicId, schedule } = await loadParticipantScope(ctx.client(), assessment.patientId);
      if (!schedule) throw new Error("Patient has no schedule");
      const round = listRounds(schedule, assessment.roundNumber).at(-1)!;
      const columns = {
        clinicId,
        ...roundColumnsFor(schedule, round.localDate),
        date: assessment.date ?? round.localDate,
        status: assessment.progress === "completed" ? "completed" : "in_progress",
        totalScore: assessment.total ?? null,
        completedAt: assessment.completedAt ? new Date(assessment.completedAt) : null,
        completedInRoundNumber: assessment.completedInRoundNumber ?? null,
        ...itemColumns(assessment),
      };
      await ctx.client().phq9Assessment.upsert({
        where: {
          participantId_roundNumber: {
            participantId: assessment.patientId,
            roundNumber: assessment.roundNumber,
          },
        },
        create: { participantId: assessment.patientId, roundNumber: assessment.roundNumber, ...columns },
        update: columns,
      });
    },
  };
}
