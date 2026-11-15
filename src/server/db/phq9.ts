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

async function shouldStoreItemAnswers(ctx: DbContext, patientId: string): Promise<boolean> {
  const latest = await ctx.client().consentEvent.findFirst({
    where: { participantId: patientId, layer: "detailed_answers" },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    select: { enabled: true },
  });
  if (latest !== null) {
    return latest.enabled;
  }
  return ctx.storeItemAnswers;
}

/**
 * With item answers off, an unfinished questionnaire's answers come from
 * memory (none after a restart) and a completed one keeps its total only.
 */
function answersOf(ctx: DbContext, row: Phq9Assessment, progress: Phq9Progress, storeItems: boolean) {
  if (storeItems) return answersFromColumns(row);
  if (progress !== "unfinished") return [];
  return ctx.answers().get(row.participantId, "phq9", row.roundNumber) ?? [];
}

function toStoredPhq9(ctx: DbContext, row: Phq9Assessment, storeItems: boolean): StoredPhq9 {
  const progress = progressFromColumn(row.status);
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    progress,
    answers: answersOf(ctx, row, progress, storeItems),
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

function rememberAnswers(ctx: DbContext, assessment: StoredPhq9, storeItems: boolean): void {
  if (storeItems) return;
  const { patientId, roundNumber } = assessment;
  if (assessment.progress === "completed") ctx.answers().delete(patientId, "phq9", roundNumber);
  else ctx.answers().set(patientId, "phq9", roundNumber, assessment.answers);
}

export function createPhq9Repository(ctx: DbContext): Phq9Repository {
  async function getPhq9s(patientId: string) {
    const storeItems = await shouldStoreItemAnswers(ctx, patientId);
    const rows = await ctx.client().phq9Assessment.findMany({
      where: { participantId: patientId },
      orderBy: { roundNumber: "asc" },
    });
    return rows.map((row) => toStoredPhq9(ctx, row, storeItems));
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
      const storeItems = await shouldStoreItemAnswers(ctx, assessment.patientId);
      const columns = {
        clinicId,
        ...roundColumnsFor(schedule, round.localDate),
        date: assessment.date ?? round.localDate,
        status: assessment.progress === "completed" ? "completed" : "in_progress",
        totalScore: assessment.total ?? null,
        completedAt: assessment.completedAt ? new Date(assessment.completedAt) : null,
        completedInRoundNumber: assessment.completedInRoundNumber ?? null,
        ...itemColumns(storeItems ? assessment.answers : []),
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
      rememberAnswers(ctx, assessment, storeItems);
    },
  };
}
