import type { RewardLedgerEntry as DbRewardLedgerEntry } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { RewardLedgerEntry, RewardLedgerEntryKind } from "@/domain/rewards/types";
import { DuplicateLedgerEntryError, type RewardLedgerRepository } from "@/usecases/rewards/ports";
import type { DbContext } from "./context";
import { StoredDataError } from "./errors";
import { loadParticipantScope } from "./participant-scope";
import { lockParticipant } from "./participant-lock";

function toLedgerEntryKind(value: string): RewardLedgerEntryKind {
  if (value === "answered_round" || value === "small_task" || value === "payout") {
    return value;
  }
  throw new StoredDataError(`Unknown ledger entry kind: ${value}`);
}

function toRewardLedgerEntry(row: DbRewardLedgerEntry): RewardLedgerEntry {
  return {
    id: row.id,
    patientId: row.participantId,
    kind: toLedgerEntryKind(row.kind),
    amountCents: row.amountCents,
    roundNumber: row.roundNumber ?? undefined,
    taskKey: row.taskKey ?? undefined,
    localDate: row.localDate ?? undefined,
    requestId: row.requestId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    isSimulated: true,
  };
}

export function createRewardLedgerRepository(ctx: DbContext): RewardLedgerRepository {
  return {
    async getEntries(patientId) {
      await lockParticipant(ctx, patientId);
      const rows = await ctx.client().rewardLedgerEntry.findMany({
        where: { participantId: patientId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return rows.map(toRewardLedgerEntry);
    },

    async appendEntry(entry) {
      await lockParticipant(ctx, entry.patientId);
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), entry.patientId);
      try {
        await ctx.client().rewardLedgerEntry.create({
          data: {
            id: entry.id,
            participantId: entry.patientId,
            clinicId,
            kind: entry.kind,
            amountCents: entry.amountCents,
            roundNumber: entry.roundNumber ?? null,
            taskKey: entry.taskKey ?? null,
            localDate: entry.localDate ?? null,
            requestId: entry.requestId ?? null,
            createdAt: new Date(entry.createdAt),
            isSimulated,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new DuplicateLedgerEntryError(entry.id);
        }
        throw err;
      }
    },

    async getEntryByRound(patientId, roundNumber) {
      await lockParticipant(ctx, patientId);
      const row = await ctx.client().rewardLedgerEntry.findFirst({
        where: { participantId: patientId, kind: "answered_round", roundNumber },
      });
      return row ? toRewardLedgerEntry(row) : null;
    },

    async getEntryByTaskDate(patientId, localDate) {
      await lockParticipant(ctx, patientId);
      const row = await ctx.client().rewardLedgerEntry.findFirst({
        where: { participantId: patientId, kind: "small_task", localDate },
      });
      return row ? toRewardLedgerEntry(row) : null;
    },

    async getEntryByRequestId(patientId, requestId) {
      await lockParticipant(ctx, patientId);
      const row = await ctx.client().rewardLedgerEntry.findFirst({
        where: { participantId: patientId, kind: "payout", requestId },
      });
      return row ? toRewardLedgerEntry(row) : null;
    },
  };
}
