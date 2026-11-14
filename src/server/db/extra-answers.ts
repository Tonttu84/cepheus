import type { ExtraAnswer } from "@prisma/client";
import type { ExtraAnswerRepository, StoredExtraAnswer } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";

function toStoredExtraAnswer(row: ExtraAnswer): StoredExtraAnswer {
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    itemId: row.itemId,
    value: row.value,
    answeredAt: row.answeredAt.toISOString(),
  };
}

export function createExtraAnswerRepository(ctx: DbContext): ExtraAnswerRepository {
  return {
    async getExtraAnswers(patientId) {
      const rows = await ctx.client().extraAnswer.findMany({
        where: { participantId: patientId },
        orderBy: { roundNumber: "asc" },
      });
      return rows.map(toStoredExtraAnswer);
    },

    async getExtraAnswer(patientId, roundNumber) {
      const row = await ctx.client().extraAnswer.findUnique({
        where: { participantId_roundNumber: { participantId: patientId, roundNumber } },
      });
      return row ? toStoredExtraAnswer(row) : null;
    },

    async saveExtraAnswer(answer) {
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), answer.patientId);
      const columns = {
        clinicId,
        itemId: answer.itemId,
        value: answer.value,
        answeredAt: new Date(answer.answeredAt),
      };
      await ctx.client().extraAnswer.upsert({
        where: {
          participantId_roundNumber: { participantId: answer.patientId, roundNumber: answer.roundNumber },
        },
        create: { participantId: answer.patientId, roundNumber: answer.roundNumber, isSimulated, ...columns },
        update: columns,
      });
    },
  };
}
