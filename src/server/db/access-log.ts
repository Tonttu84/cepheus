import type { Prisma } from "@prisma/client";
import type { Actor } from "@/domain/access/types";
import type { AccessLogRepository, StoredAccessLogEntry } from "@/usecases/ports";
import type { DbContext } from "./context";

type AccessLogRow = Prisma.AccessLogGetPayload<Record<string, never>>;

function actorColumns(actor: Actor) {
  if (actor.kind === "patient") {
    return { actorId: actor.patientId, actorClinicId: actor.clinicId, actorRole: null };
  }
  if (actor.kind === "staff") {
    return { actorId: actor.staffId, actorClinicId: actor.clinicId, actorRole: actor.role };
  }
  return { actorId: null, actorClinicId: null, actorRole: null };
}

function actorOf(row: AccessLogRow): Actor {
  if (row.actorKind === "patient") {
    return { kind: "patient", patientId: row.actorId!, clinicId: row.actorClinicId! };
  }
  if (row.actorKind === "staff") {
    return {
      kind: "staff",
      staffId: row.actorId!,
      clinicId: row.actorClinicId!,
      role: row.actorRole as "nurse" | "admin",
    };
  }
  return { kind: "system" };
}

function toEntry(row: AccessLogRow): StoredAccessLogEntry {
  return {
    actor: actorOf(row),
    action: row.action as StoredAccessLogEntry["action"],
    target: {
      kind: row.targetKind as StoredAccessLogEntry["target"]["kind"],
      ...(row.targetPatientId !== null && { patientId: row.targetPatientId }),
      ...(row.clinicId !== null && { clinicId: row.clinicId }),
      ...(row.targetMethod !== null && { method: row.targetMethod }),
    },
    purpose: row.purpose,
    allowed: row.allowed,
    reason: row.reason as StoredAccessLogEntry["reason"],
    timestamp: row.timestamp.toISOString(),
  };
}

export function createAccessLogRepository(ctx: DbContext): AccessLogRepository {
  async function patientCodeFor(patientId: string | undefined): Promise<string | null> {
    if (!patientId) return null;
    const participant = await ctx.client().participant.findUnique({
      where: { id: patientId },
      select: { participantCode: true },
    });
    return participant?.participantCode ?? null;
  }

  return {
    async appendLog(entry) {
      await ctx.client().accessLog.create({
        data: {
          ...actorColumns(entry.actor),
          actorKind: entry.actor.kind,
          action: entry.action,
          purpose: entry.purpose,
          allowed: entry.allowed,
          reason: entry.reason,
          timestamp: new Date(entry.timestamp),
          targetKind: entry.target.kind,
          clinicId: entry.target.clinicId ?? null,
          targetPatientId: entry.target.patientId ?? null,
          targetMethod: entry.target.method ?? null,
          patientCode: await patientCodeFor(entry.target.patientId),
        },
      });
    },

    async getLogs(patientId) {
      const rows = await ctx.client().accessLog.findMany({
        where: patientId === undefined ? {} : { targetPatientId: patientId },
        orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      });
      return rows.map(toEntry);
    },
  };
}
