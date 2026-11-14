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

function answersFromColumns(row: Phq9Assessment) {
  return ITEM_IDS.flatMap((id) => {
    const value = row[PHQ9_COLUMN_BY_ID[id]];
    return value === null ? [] : [{ id, value }];
  });
}

/**
 * With item answers off, an unfinished questionnaire's answers come from
 * memory (none after a restart) and a completed one keeps its total only.
 */
function answersOf(ctx: DbContext, row: Phq9Assessment, progress: Phq9Progress) {
  if (ctx.storeItemAnswers) return answersFromColumns(row);
  if (progress !== "unfinished") return [];
  return ctx.answers().get(row.participantId, "phq9", row.roundNumber) ?? [];
}

function toStoredPhq9(ctx: DbContext, row: Phq9Assessment): StoredPhq9 {
  const progress = progressFromColumn(row.status);
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    progress,
    answers: answersOf(ctx, row, progress),
    total: row.totalScore,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedInRoundNumber: row.completedInRoundNumber,
    date: progress === "completed" ? row.date : null,
  };
}

function itemColumns(answers: StoredPhq9["answers"]) {
  return Object.fromEntries(
    ITEM_IDS.map((id) => [PHQ9_COLUMN_BY_ID[id], answers.find((answer) => answer.id === id)?.value ?? null])
  );
}

function rememberAnswers(ctx: DbContext, assessment: StoredPhq9): void {
  if (ctx.storeItemAnswers) return;
  const { patientId, roundNumber } = assessment;
  if (assessment.progress === "completed") ctx.answers().delete(patientId, "phq9", roundNumber);
  else ctx.answers().set(patientId, "phq9", roundNumber, assessment.answers);
}

export function createPhq9Repository(ctx: DbContext): Phq9Repository {
  async function getPhq9s(patientId: string) {
    const rows = await ctx.client().phq9Assessment.findMany({
      where: { participantId: patientId },
      orderBy: { roundNumber: "asc" },
    });
    return rows.map((row) => toStoredPhq9(ctx, row));
  }

  return {
    getPhq9s,

    async getCurrentPhq9(patientId) {
      const all = await getPhq9s(patientId);
      return all.find((p) => p.progress === "unfinished") ?? all.at(-1) ?? null;
    },

    async savePhq9(assessment) {
      const { clinicId, isSimulated, schedule } = await loadParticipantScope(ctx.client(), assessment.patientId);
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
        ...itemColumns(ctx.storeItemAnswers ? assessment.answers : []),
      };
      await ctx.client().phq9Assessment.upsert({
        where: {
          participantId_roundNumber: {
            participantId: assessment.patientId,
            roundNumber: assessment.roundNumber,
          },
        },
        create: {
          participantId: assessment.patientId,
          roundNumber: assessment.roundNumber,
          isSimulated,
          ...columns,
        },
        update: columns,
      });
      rememberAnswers(ctx, assessment);
    },
  };
}
