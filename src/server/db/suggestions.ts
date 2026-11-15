import type { PatientSuggestion } from "@prisma/client";
import type { SuggestionRepository, SuggestionStatus, StoredSuggestion } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";

function toStoredSuggestion(row: PatientSuggestion): StoredSuggestion {
  return {
    id: row.id,
    patientId: row.participantId,
    clinicId: row.clinicId,
    createdAt: row.createdAt.toISOString(),
    date: row.date,
    dayIndex: row.dayIndex,
    reason: row.reason,
    actionKey: row.actionKey,
    actionTitle: row.actionTitle,
    actionDetail: row.actionDetail,
    effortTier: row.effortTier,
    status: row.status as SuggestionStatus,
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    armType: row.armType,
    nextCheckInDelta: row.nextCheckInDelta,
    isSimulated: row.isSimulated,
  };
}

export function createSuggestionRepository(ctx: DbContext): SuggestionRepository {
  return {
    async getLatestSuggestion(patientId: string): Promise<StoredSuggestion | null> {
      const row = await ctx.client().patientSuggestion.findFirst({
        where: { participantId: patientId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return row ? toStoredSuggestion(row) : null;
    },

    async getSuggestion(suggestionId: string): Promise<StoredSuggestion | null> {
      const row = await ctx.client().patientSuggestion.findUnique({
        where: { id: suggestionId },
      });
      return row ? toStoredSuggestion(row) : null;
    },

    async hasUnansweredSuggestion(patientId: string): Promise<boolean> {
      const row = await ctx.client().patientSuggestion.findFirst({
        where: { participantId: patientId, status: "shown" },
        select: { id: true },
      });
      return row !== null;
    },

    async saveSuggestion(suggestion: StoredSuggestion): Promise<void> {
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), suggestion.patientId);
      const data = {
        clinicId: suggestion.clinicId ?? clinicId,
        date: suggestion.date,
        dayIndex: suggestion.dayIndex ?? null,
        reason: suggestion.reason,
        actionKey: suggestion.actionKey,
        actionTitle: suggestion.actionTitle,
        actionDetail: suggestion.actionDetail,
        effortTier: suggestion.effortTier,
        status: suggestion.status,
        respondedAt: suggestion.respondedAt ? new Date(suggestion.respondedAt) : null,
        armType: suggestion.armType ?? "intervention",
        nextCheckInDelta: suggestion.nextCheckInDelta ?? null,
        isSimulated: suggestion.isSimulated ?? isSimulated,
      };

      await ctx.client().patientSuggestion.upsert({
        where: { id: suggestion.id },
        create: {
          id: suggestion.id,
          participantId: suggestion.patientId,
          createdAt: new Date(suggestion.createdAt),
          ...data,
        },
        update: data,
      });
    },

    async updateSuggestionChoice(
      suggestionId: string,
      status: SuggestionStatus,
      respondedAt: string
    ): Promise<void> {
      await ctx.client().patientSuggestion.update({
        where: { id: suggestionId },
        data: {
          status,
          respondedAt: new Date(respondedAt),
        },
      });
    },
  };
}
