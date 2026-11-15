import type { Participant, PrismaClient } from "@prisma/client";
import { SIMULATED_PATIENT_PRESETS, type PatientAuthSession } from "@/lib/auth-types";
import { MEASUREMENT_METHODS } from "@/lib/constants";
import { getPrisma } from "@/lib/db";
import {
  ALL_CONSENT_METHODS,
  DEMO_CLINIC_ID,
  ensureHomeDemoParticipant,
  isDefaultEnabledForMethod,
} from "@/server/monitoring/store";

export const DEFAULT_AUTH_CLINIC_CODE = "sim-clinic-01";

export async function ensureParticipantConsents(
  participantId: string,
  clinicId: string | null,
  prisma: PrismaClient
): Promise<void> {
  const rows = ALL_CONSENT_METHODS.map((methodKey) => {
    const meta = MEASUREMENT_METHODS.find((m) => m.method === methodKey);
    const defaultEnabled = isDefaultEnabledForMethod(methodKey);
    return {
      participantId,
      clinicId,
      method: methodKey,
      broadArea: meta?.broadArea ?? "daily_routine",
      recordedDescription:
        meta?.recordedDescription ??
        "Derived numerical summaries only; video/audio never leave the device.",
      enabled: defaultEnabled,
      isPersonalSign: meta?.isPersonalSignDefault ?? false,
      consentedAt: defaultEnabled ? new Date() : null,
    };
  });

  await prisma.measurementConsent.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

async function resolveByParticipantId(
  participantId: string,
  prisma: PrismaClient
): Promise<{ participant: Participant; clinicCode: string } | null> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!participant) {
    return null;
  }
  await ensureParticipantConsents(participant.id, participant.clinicId, prisma);
  if (!participant.clinicId) {
    return { participant, clinicCode: DEFAULT_AUTH_CLINIC_CODE };
  }
  const clinic = await prisma.clinic.findUnique({
    where: { id: participant.clinicId },
    select: { code: true },
  });
  return {
    participant,
    clinicCode: clinic?.code ?? DEFAULT_AUTH_CLINIC_CODE,
  };
}

async function resolveByPatientSession(
  session: PatientAuthSession,
  prisma: PrismaClient
): Promise<{ participant: Participant; clinicCode: string }> {
  const clinic = await prisma.clinic.upsert({
    where: { code: DEFAULT_AUTH_CLINIC_CODE },
    update: {},
    create: {
      code: DEFAULT_AUTH_CLINIC_CODE,
      name: "Simulated TMS Clinic",
    },
  });

  const preset = SIMULATED_PATIENT_PRESETS.find(
    (p) => p.participantCode === session.participantCode
  );

  let participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { id: session.actor.patientId },
        { participantCode: session.participantCode },
        ...(preset ? [{ externalId: preset.externalId }] : []),
      ],
    },
  });

  if (!participant) {
    const externalId = preset?.externalId ?? session.actor.patientId;
    try {
      participant = await prisma.participant.create({
        data: {
          clinicId: clinic.id,
          participantCode: session.participantCode,
          externalId,
          label: session.label,
          source: "synthetic",
          isSimulated: session.isSimulated,
          takingPart: true,
        },
      });
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err;
      participant = await prisma.participant.findFirst({
        where: {
          OR: [
            { id: session.actor.patientId },
            { participantCode: session.participantCode },
            { externalId },
          ],
        },
      });
      if (!participant) throw err;
    }
  }

  await ensureParticipantConsents(
    participant.id,
    participant.clinicId ?? clinic.id,
    prisma
  );

  return { participant, clinicCode: DEFAULT_AUTH_CLINIC_CODE };
}

export async function resolveMonitoringTarget(
  opts: { session?: PatientAuthSession; participantId?: string | null },
  prisma: PrismaClient = getPrisma()
): Promise<{ participant: Participant; clinicCode: string } | null> {
  if (typeof opts.participantId === "string" && opts.participantId.trim().length > 0) {
    return resolveByParticipantId(opts.participantId.trim(), prisma);
  }
  if (opts.session) {
    return resolveByPatientSession(opts.session, prisma);
  }
  const participant = await ensureHomeDemoParticipant(prisma);
  return { participant, clinicCode: DEMO_CLINIC_ID };
}
