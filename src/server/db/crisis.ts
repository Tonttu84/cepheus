import type { CrisisEvent } from "@prisma/client";
import type { CrisisRepository, StoredCrisisEvent } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";
import { PHQ9_COLUMN_BY_ID } from "./phq9-columns";

const ITEM_ID_BY_COLUMN: Record<string, string> = Object.fromEntries(
  Object.entries(PHQ9_COLUMN_BY_ID).map(([id, column]) => [column, id])
);

function itemIdToColumn(itemId: string): string {
  return PHQ9_COLUMN_BY_ID[itemId as keyof typeof PHQ9_COLUMN_BY_ID] ?? itemId;
}

function toStoredCrisisEvent(row: CrisisEvent): StoredCrisisEvent {
  return {
    patientId: row.participantId,
    roundNumber: row.roundNumber,
    itemId: ITEM_ID_BY_COLUMN[row.itemId] ?? row.itemId,
    value: row.value,
    occurredAt: row.occurredAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  };
}

export function createCrisisRepository(ctx: DbContext): CrisisRepository {
  return {
    async getCrisisEvents(patientId) {
      const rows = await ctx.client().crisisEvent.findMany({
        where: { participantId: patientId },
        orderBy: [{ occurredAt: "asc" }, { roundNumber: "asc" }],
      });
      return rows.map(toStoredCrisisEvent);
    },

    async saveCrisisEvent(event) {
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), event.patientId);
      await ctx.client().crisisEvent.upsert({
        where: {
          participantId_roundNumber: { participantId: event.patientId, roundNumber: event.roundNumber },
        },
        update: {},
        create: {
          participantId: event.patientId,
          roundNumber: event.roundNumber,
          clinicId,
          isSimulated,
          itemId: itemIdToColumn(event.itemId),
          value: event.value,
          occurredAt: new Date(event.occurredAt),
          acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : null,
        },
      });
    },
  };
}
