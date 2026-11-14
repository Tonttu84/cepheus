import type { CallRepository, StoredCall } from "@/usecases/ports";
import type { DbContext } from "./context";
import { loadParticipantScope } from "./participant-scope";

export function createCallRepository(ctx: DbContext): CallRepository {
  return {
    async saveCall(call) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, call.patientId);
      await db.nurseCallRecord.create({
        data: {
          participantId: call.patientId,
          clinicId: scope.clinicId,
          status: "completed",
          date: call.date,
          position: call.position ?? null,
        },
      });
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
          ...(row.position ? { position: row.position as StoredCall["position"] } : {}),
        })
      );
    },
  };
}
