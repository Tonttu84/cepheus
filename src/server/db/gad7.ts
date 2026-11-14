import type { Gad7Assessment } from "@prisma/client";
import { listRounds } from "@/domain/rounds";
import type { Gad7Repository, StoredGad7 } from "@/usecases/ports";
import type { DbContext } from "./context";
import { GAD7_COLUMN_BY_ID } from "./gad7-columns";
import { loadParticipantScope, roundColumnsFor } from "./participant-scope";

const ITEM_IDS = Object.keys(GAD7_COLUMN_BY_ID) as (keyof typeof GAD7_COLUMN_BY_ID)[];

/** `StoredGad7` has no progress of its own: a GAD-7 with a total is completed. */
function isCompleted(assessment: Pick<StoredGad7, "total">): boolean {
  return typeof assessment.total === "number";
}

function answersFromColumns(row: Gad7Assessment) {
  return ITEM_IDS.flatMap((id) => {
    const value = row[GAD7_COLUMN_BY_ID[id]];
    return value === null ? [] : [{ id, value }];
  });
}

/**
 * With item answers off, an unfinished questionnaire's answers come from
 * memory (none after a restart) and a completed one keeps its total only.
 */
function answersOf(ctx: DbContext, row: Gad7Assessment) {
  if (ctx.storeItemAnswers) return answersFromColumns(row);
  if (row.status === "completed") return [];
  return ctx.answers().get(row.participantId, "gad7", row.roundNumber) ?? [];
}

function toStoredGad7(ctx: DbContext, row: Gad7Assessment): StoredGad7 {
  const completed = row.status === "completed";
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    answers: answersOf(ctx, row),
    total: row.totalScore,
    completedAt: row.completedAt?.toISOString() ?? null,
    date: completed ? row.date : null,
  };
}

function itemColumns(answers: StoredGad7["answers"]) {
  return Object.fromEntries(
    ITEM_IDS.map((id) => [GAD7_COLUMN_BY_ID[id], answers.find((answer) => answer.id === id)?.value ?? null])
  );
}

function rememberAnswers(ctx: DbContext, assessment: StoredGad7): void {
  if (ctx.storeItemAnswers) return;
  const { patientId, roundNumber } = assessment;
  if (isCompleted(assessment)) ctx.answers().delete(patientId, "gad7", roundNumber);
  else ctx.answers().set(patientId, "gad7", roundNumber, assessment.answers);
}

export function createGad7Repository(ctx: DbContext): Gad7Repository {
  return {
    async getGad7s(patientId) {
      const rows = await ctx.client().gad7Assessment.findMany({
        where: { participantId: patientId },
        orderBy: { roundNumber: "asc" },
      });
      return rows.map((row) => toStoredGad7(ctx, row));
    },

    async saveGad7(assessment) {
      const { clinicId, isSimulated, schedule } = await loadParticipantScope(ctx.client(), assessment.patientId);
      if (!schedule) throw new Error("Patient has no schedule");
      const round = listRounds(schedule, assessment.roundNumber).at(-1)!;
      const columns = {
        clinicId,
        ...roundColumnsFor(schedule, round.localDate),
        date: assessment.date ?? round.localDate,
        status: isCompleted(assessment) ? "completed" : "in_progress",
        totalScore: assessment.total ?? null,
        completedAt: assessment.completedAt ? new Date(assessment.completedAt) : null,
        ...itemColumns(ctx.storeItemAnswers ? assessment.answers : []),
      };
      await ctx.client().gad7Assessment.upsert({
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
