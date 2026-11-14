import type {
  BaselineNotWellRepository,
  SmallDipRepository,
  StoredBaselineNotWellNotice,
  StoredCause,
  StoredSmallDip,
  StoredWarning,
  WarningRepository,
} from "@/usecases/ports";
import { z } from "zod";
import type { FlagArea } from "@/domain/flags";
import type { DbContext } from "./context";
import { StoredDataError } from "./errors";
import { loadParticipantScope } from "./participant-scope";

interface CauseColumns {
  readonly causeType: StoredCause["type"];
  readonly causeRoundNumber: number | null;
  readonly causeDate: string;
}

interface StoredCauseColumns {
  readonly causeType: string | null;
  readonly causeRoundNumber: number | null;
  readonly causeDate: string | null;
}

const CHECK_IN_AREA: FlagArea = "check_in";

function causeToColumns(cause: StoredCause): CauseColumns {
  return {
    causeType: cause.type,
    causeRoundNumber: cause.type === "round" ? cause.roundNumber : null,
    causeDate: cause.date,
  };
}

const STORED_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const STORED_CAUSE = z.discriminatedUnion("causeType", [
  z.object({ causeType: z.literal("round"), causeRoundNumber: z.number().int(), causeDate: STORED_DATE }),
  z.object({ causeType: z.enum(["phq9", "gad7"]), causeDate: STORED_DATE }),
]);

function columnsToCause(row: StoredCauseColumns): StoredCause {
  const result = STORED_CAUSE.safeParse(row);
  if (!result.success) throw new StoredDataError("Stored cause does not have the expected shape");
  const cause = result.data;
  if (cause.causeType === "round") {
    return { type: "round", roundNumber: cause.causeRoundNumber, date: cause.causeDate };
  }
  return { type: cause.causeType, date: cause.causeDate };
}

export function createWarningRepository(ctx: DbContext): WarningRepository {
  return {
    async saveWarning(warning) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, warning.patientId);
      await db.clinicFlag.create({
        data: {
          participantId: warning.patientId,
          clinicId: scope.clinicId,
          isSimulated: scope.isSimulated,
          createdAt: new Date(warning.raisedAt),
          sinceDate: warning.since,
          triggerKind: warning.kind,
          ruleVersion: warning.version,
          primaryArea: CHECK_IN_AREA,
          broadAreasJson: JSON.stringify([CHECK_IN_AREA]),
          ...causeToColumns(warning.causedBy),
        },
      });
    },

    async getWarnings(patientId) {
      const rows = await ctx.client().clinicFlag.findMany({
        where: { participantId: patientId, causeType: { not: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return rows.map(
        (row): StoredWarning => ({
          patientId,
          kind: row.triggerKind as StoredWarning["kind"],
          since: row.sinceDate,
          version: row.ruleVersion,
          causedBy: columnsToCause(row),
          raisedAt: row.createdAt.toISOString(),
        })
      );
    },
  };
}

export function createSmallDipRepository(ctx: DbContext): SmallDipRepository {
  return {
    async saveSmallDip(dip) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, dip.patientId);
      await db.smallDip.create({
        data: {
          participantId: dip.patientId,
          clinicId: scope.clinicId,
          isSimulated: scope.isSimulated,
          roundNumber: dip.roundNumber,
          date: dip.date,
          ruleVersion: dip.version,
          shownAt: new Date(dip.shownAt),
          ...causeToColumns(dip.causedBy),
        },
      });
    },

    async getSmallDips(patientId) {
      const rows = await ctx.client().smallDip.findMany({
        where: { participantId: patientId },
        orderBy: [{ shownAt: "asc" }, { id: "asc" }],
      });
      return rows.map(
        (row): StoredSmallDip => ({
          patientId,
          roundNumber: row.roundNumber,
          date: row.date,
          version: row.ruleVersion,
          causedBy: columnsToCause(row),
          shownAt: row.shownAt.toISOString(),
        })
      );
    },
  };
}

export function createBaselineNotWellRepository(ctx: DbContext): BaselineNotWellRepository {
  return {
    async saveNotice(notice) {
      const db = ctx.client();
      const scope = await loadParticipantScope(db, notice.patientId);
      await db.baselineNotice.create({
        data: {
          participantId: notice.patientId,
          clinicId: scope.clinicId,
          isSimulated: scope.isSimulated,
          ruleVersion: notice.version,
          notifiedAt: new Date(notice.notifiedAt),
          ...causeToColumns(notice.causedBy),
        },
      });
    },

    async getNotices(patientId) {
      const rows = await ctx.client().baselineNotice.findMany({
        where: { participantId: patientId },
        orderBy: [{ notifiedAt: "asc" }, { id: "asc" }],
      });
      return rows.map(
        (row): StoredBaselineNotWellNotice => ({
          patientId,
          version: row.ruleVersion,
          causedBy: columnsToCause(row),
          notifiedAt: row.notifiedAt.toISOString(),
        })
      );
    },
  };
}
