import type { CheckInRound } from "@prisma/client";
import type { RoundStatus } from "@/domain/rounds";
import type { RoundRepository, StoredRound } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope, roundColumnsFor } from "./participant-scope";

const STATUS_FROM_COLUMN: Record<string, RoundStatus | null> = {
  completed: "answered",
  not_today: "not_today",
  missed: "missed",
  open: null,
};

function statusFromColumn(value: string): RoundStatus | null {
  if (!(value in STATUS_FROM_COLUMN)) throw new Error(`Unknown round status: ${value}`);
  return STATUS_FROM_COLUMN[value];
}

function statusToColumn(status: RoundStatus | null | undefined): string {
  if (!status) return "open";
  return status === "answered" ? "completed" : status;
}

function toStoredRound(row: CheckInRound): StoredRound {
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    localDate: row.date,
    status: statusFromColumn(row.status),
    mood: row.moodScore,
    interest: row.interestScore,
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    answeredAt: row.respondedAt?.toISOString() ?? null,
  };
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function createRoundRepository(ctx: DbContext): RoundRepository {
  return {
    async getRounds(patientId) {
      const rows = await ctx.client().checkInRound.findMany({
        where: { participantId: patientId },
        orderBy: { roundNumber: "asc" },
      });
      return rows.map(toStoredRound);
    },

    async getRound(patientId, roundNumber) {
      const row = await ctx.client().checkInRound.findUnique({
        where: { participantId_roundNumber: { participantId: patientId, roundNumber } },
      });
      return row ? toStoredRound(row) : null;
    },

    async saveRound(round) {
      const { clinicId, isSimulated, schedule } = await loadParticipantScope(ctx.client(), round.patientId);
      if (!schedule) throw new Error("Patient has no schedule");
      const columns = {
        clinicId,
        date: round.localDate,
        ...roundColumnsFor(schedule, round.localDate),
        status: statusToColumn(round.status),
        moodScore: round.mood ?? null,
        interestScore: round.interest ?? null,
        reminderSentAt: toDate(round.reminderSentAt),
        respondedAt: toDate(round.answeredAt),
      };
      await ctx.client().checkInRound.upsert({
        where: {
          participantId_roundNumber: { participantId: round.patientId, roundNumber: round.roundNumber },
        },
        create: { participantId: round.patientId, roundNumber: round.roundNumber, isSimulated, ...columns },
        update: columns,
      });
    },
  };
}
