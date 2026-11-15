import { z } from "zod";
import type { CallRepository, StoredCall, StoredNurseCallRecord } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";
import { parseStoredEnum } from "./stored-data";

const STORED_CALL_POSITION: z.ZodType<NonNullable<StoredCall["position"]>> = z.enum(["before", "after"]);

export function createCallRepository(ctx: DbContext): CallRepository {
  return {
    async saveCall(call) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, call.patientId);
      await db.nurseCallRecord.create({
        data: {
          participantId: call.patientId,
          clinicId: scope.clinicId,
          isSimulated: scope.isSimulated,
          status: "completed",
          date: call.date,
          position: call.position ?? null,
        },
      });
    },

    async saveNurseCallRecord(record) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, record.patientId);
      const row = await db.nurseCallRecord.create({
        data: {
          participantId: record.patientId,
          clinicId: scope.clinicId,
          flagId: record.flagId ?? null,
          staffUserId: record.staffUserId ?? null,
          requestedAt: record.requestedAt ? new Date(record.requestedAt) : undefined,
          completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
          status: record.status,
          outcomeTier: record.outcomeTier ?? null,
          actionTaken: record.actionTaken ?? null,
          medicationChecked: record.medicationChecked ?? false,
          watchNextRounds: record.watchNextRounds ?? 0,
          boosterSessionsPlanned: record.boosterSessionsPlanned ?? null,
          isSimulated: scope.isSimulated,
          date: record.date ?? null,
          position: record.position ?? null,
        },
      });
      return {
        id: row.id,
        patientId: row.participantId,
        clinicId: row.clinicId,
        flagId: row.flagId,
        staffUserId: row.staffUserId,
        requestedAt: row.requestedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        status: row.status as StoredNurseCallRecord["status"],
        outcomeTier: (row.outcomeTier as StoredNurseCallRecord["outcomeTier"]) ?? null,
        actionTaken: (row.actionTaken as StoredNurseCallRecord["actionTaken"]) ?? null,
        medicationChecked: row.medicationChecked,
        watchNextRounds: row.watchNextRounds,
        boosterSessionsPlanned: row.boosterSessionsPlanned,
        isSimulated: row.isSimulated,
        date: row.date,
        position: (row.position as StoredNurseCallRecord["position"]) ?? null,
      };
    },

    async getNurseCallRecords(patientId) {
      const rows = await ctx.client().nurseCallRecord.findMany({
        where: { participantId: patientId },
        orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
      });
      return rows.map((row) => ({
        id: row.id,
        patientId: row.participantId,
        clinicId: row.clinicId,
        flagId: row.flagId,
        staffUserId: row.staffUserId,
        requestedAt: row.requestedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        status: row.status as StoredNurseCallRecord["status"],
        outcomeTier: (row.outcomeTier as StoredNurseCallRecord["outcomeTier"]) ?? null,
        actionTaken: (row.actionTaken as StoredNurseCallRecord["actionTaken"]) ?? null,
        medicationChecked: row.medicationChecked,
        watchNextRounds: row.watchNextRounds,
        boosterSessionsPlanned: row.boosterSessionsPlanned,
        isSimulated: row.isSimulated,
        date: row.date,
        position: (row.position as StoredNurseCallRecord["position"]) ?? null,
      }));
    },

    async getCalls(patientId) {
      const rows = await ctx.client().nurseCallRecord.findMany({
        where: { participantId: patientId, date: { not: null } },
        orderBy: [{ date: "asc" }, { requestedAt: "asc" }],
      });
      return rows.map(
        (row): StoredCall => ({
          patientId,
          date: row.date as string,
          ...(row.position ? { position: parseStoredEnum(row.position, STORED_CALL_POSITION, "position") } : {}),
        })
      );
    },
  };
}
