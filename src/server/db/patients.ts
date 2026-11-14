import type { DbContext } from "./context";
import { toSchedule } from "./participant-scope";
import { MEASUREMENT_METHODS } from "@/lib/constants";
import type { ConsentState } from "@/domain/consent";
import type { QuestionnaireType } from "@/domain/history";
import type {
  PatientAccessSwitches,
  PatientRecord,
  PatientRepository,
} from "@/usecases/ports";

const RING_METHOD = "ring_rhythm";
const CAMERA_METHOD = "camera_expressivity";

function descriptorFor(method: string) {
  const descriptor = MEASUREMENT_METHODS.find((item) => item.method === method);
  if (!descriptor) throw new Error(`Unknown measurement method: ${method}`);
  return descriptor;
}

function consentRow(method: string, clinicId: string, enabled: boolean) {
  const { broadArea, recordedDescription } = descriptorFor(method);
  return { method, clinicId, enabled, broadArea, recordedDescription };
}

async function readParticipant(ctx: DbContext, patientId: string) {
  if (ctx.isInUnitOfWork()) {
    await ctx.client().$queryRaw`SELECT "id" FROM "Participant" WHERE "id" = ${patientId} FOR UPDATE`;
  }
  return ctx.client().participant.findUnique({
    where: { id: patientId },
    include: { consents: true },
  });
}

type ParticipantRow = NonNullable<Awaited<ReturnType<typeof readParticipant>>>;

function consentOf(row: ParticipantRow): ConsentState {
  const enabled = (method: string) =>
    row.consents.some((consent) => consent.method === method && consent.enabled);
  return {
    taking_part: row.takingPart,
    methods: { ring: enabled(RING_METHOD), camera: enabled(CAMERA_METHOD) },
    rule_check: row.ruleCheckConsent,
  };
}

function questionnairesOf(row: ParticipantRow): { questionnaires?: QuestionnaireType[] } {
  return row.questionnairesJson ? { questionnaires: JSON.parse(row.questionnairesJson) } : {};
}

function columnsOf(record: PatientRecord) {
  return {
    clinicId: record.clinicId,
    enrolmentDate: record.schedule.enrolmentDate,
    scheduleDaysJson: JSON.stringify(record.schedule.weekdays),
    scheduleTime: record.schedule.timeOfDay,
    timeZone: record.schedule.timeZone,
    takingPart: record.consent.taking_part,
    ruleCheckConsent: record.consent.rule_check,
    questionnairesJson: record.questionnaires ? JSON.stringify(record.questionnaires) : null,
  };
}

export function createPatientRepository(ctx: DbContext): PatientRepository {
  return {
    async getPatientAccessSwitches(patientId): Promise<PatientAccessSwitches | null> {
      const row = await readParticipant(ctx, patientId);
      if (!row?.clinicId) return null;
      return {
        patientId: row.id,
        clinicId: row.clinicId,
        consent: consentOf(row),
        ...questionnairesOf(row),
      };
    },

    async getPatient(patientId): Promise<PatientRecord | null> {
      const row = await readParticipant(ctx, patientId);
      if (!row?.clinicId) return null;
      const schedule = toSchedule(row);
      if (!schedule) return null;
      return {
        patientId: row.id,
        clinicId: row.clinicId,
        schedule,
        consent: consentOf(row),
        ...questionnairesOf(row),
      };
    },

    async savePatient(record) {
      const columns = columnsOf(record);
      const rows = [
        consentRow(RING_METHOD, record.clinicId, record.consent.methods.ring),
        consentRow(CAMERA_METHOD, record.clinicId, record.consent.methods.camera),
      ];
      await ctx.client().participant.upsert({
        where: { id: record.patientId },
        create: {
          id: record.patientId,
          label: "Pseudonymous patient",
          source: "live",
          isSimulated: false,
          ...columns,
          consents: { create: rows },
        },
        update: {
          ...columns,
          consents: {
            upsert: rows.map((row) => ({
              where: { participantId_method: { participantId: record.patientId, method: row.method } },
              create: row,
              update: { enabled: row.enabled, clinicId: row.clinicId },
            })),
          },
        },
      });
    },
  };
}
