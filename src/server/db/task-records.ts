import type { TaskRecord as DbTaskRecord } from "@prisma/client";
import { isValidTaskKey } from "@/domain/small-tasks/catalogue";
import type { TaskKey, TaskRecord, TaskSource, TaskStatus } from "@/domain/small-tasks/types";
import type { TaskRecordRepository } from "@/usecases/rewards/ports";
import type { DbContext } from "./context";
import { StoredDataError } from "./errors";
import { loadParticipantScope } from "./participant-scope";
import { lockParticipant } from "./participant-lock";

function toTaskKey(value: string): TaskKey {
  if (isValidTaskKey(value)) {
    return value;
  }
  throw new StoredDataError(`Unknown task key: ${value}`);
}

function toTaskStatus(value: string): TaskStatus {
  if (value === "offered" || value === "completed" || value === "not_today") {
    return value;
  }
  throw new StoredDataError(`Unknown task status: ${value}`);
}

function toTaskSource(value: string): TaskSource {
  if (value === "self_report") {
    return value;
  }
  throw new StoredDataError(`Unknown task source: ${value}`);
}

function toTaskRecord(row: DbTaskRecord): TaskRecord {
  return {
    id: row.id,
    patientId: row.participantId,
    localDate: row.localDate,
    taskKey: toTaskKey(row.taskKey),
    status: toTaskStatus(row.status),
    source: toTaskSource(row.source),
    completedAt: row.completedAt?.toISOString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    isSimulated: true,
  };
}

export function createTaskRecordRepository(ctx: DbContext): TaskRecordRepository {
  return {
    async getTaskRecord(patientId, localDate) {
      await lockParticipant(ctx, patientId);
      const row = await ctx.client().taskRecord.findUnique({
        where: {
          participantId_localDate: {
            participantId: patientId,
            localDate: localDate,
          },
        },
      });
      return row ? toTaskRecord(row) : null;
    },

    async getHistory(patientId) {
      await lockParticipant(ctx, patientId);
      const rows = await ctx.client().taskRecord.findMany({
        where: { participantId: patientId },
        orderBy: { localDate: "asc" },
      });
      return rows.map(toTaskRecord);
    },

    async saveTaskRecord(record) {
      await lockParticipant(ctx, record.patientId);
      const { clinicId, isSimulated } = await loadParticipantScope(ctx.client(), record.patientId);
      const columns = {
        clinicId,
        taskKey: record.taskKey,
        status: record.status,
        source: record.source,
        completedAt: record.completedAt ? new Date(record.completedAt) : null,
        respondedAt: record.respondedAt ? new Date(record.respondedAt) : null,
        isSimulated,
      };
      await ctx.client().taskRecord.upsert({
        where: {
          participantId_localDate: {
            participantId: record.patientId,
            localDate: record.localDate,
          },
        },
        create: {
          id: record.id,
          participantId: record.patientId,
          localDate: record.localDate,
          ...columns,
        },
        update: columns,
      });
    },

    async getCompletedTasksCount(patientId) {
      await lockParticipant(ctx, patientId);
      return await ctx.client().taskRecord.count({
        where: { participantId: patientId, status: "completed" },
      });
    },

    async getCompletedWalksCount(patientId) {
      await lockParticipant(ctx, patientId);
      return await ctx.client().taskRecord.count({
        where: { participantId: patientId, status: "completed", taskKey: "short_walk" },
      });
    },
  };
}
