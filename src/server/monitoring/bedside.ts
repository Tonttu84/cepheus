import { Prisma, type PrismaClient } from "@prisma/client";
import { decideAccess } from "@/domain/access";
import { isCrisis } from "@/domain/crisis";
import { CRISIS_RESOURCES } from "@/lib/constants";
import { getPrisma } from "@/lib/db";
import { PHQ9_COLUMN_BY_ID, PHQ9_COLUMNS, type Phq9ItemColumn } from "@/server/db/phq9-columns";
import {
  DEMO_CLINIC_ID,
  ensureHomeDemoParticipant,
  loadConsentContext,
} from "./store";

export type BedsideCheckInInput =
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "taps";
      readonly mood: number;
      readonly interest: number;
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "not_today";
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "phq9_item";
      readonly itemId: string;
      readonly value: number;
    }
  | {
      readonly deviceId: string;
      readonly date: string;
      readonly isSimulated: boolean;
      readonly kind: "crisis_button";
    };

export interface BedsideCheckInOutcome {
  readonly ok: true;
  readonly kind: BedsideCheckInInput["kind"];
  readonly showCrisisPath: boolean;
  readonly crisisResources: typeof CRISIS_RESOURCES | null;
  readonly roundNumber: number | null;
  readonly source: string;
}

async function resolveRoundNumber(
  participantId: string,
  date: string,
  prisma: PrismaClient
): Promise<number> {
  const sameDate = await prisma.checkInRound.findFirst({
    where: { participantId, date },
    orderBy: { roundNumber: "desc" },
  });
  if (sameDate) return sameDate.roundNumber;

  const latest = await prisma.checkInRound.findFirst({
    where: { participantId },
    orderBy: { roundNumber: "desc" },
  });
  return (latest?.roundNumber ?? 0) + 1;
}

function checkStoredCheckInConsent(
  input: BedsideCheckInInput,
  patientId: string,
  consentCtx: Awaited<ReturnType<typeof loadConsentContext>>
): boolean {
  const takingPartForKind =
    input.kind === "phq9_item"
      ? consentCtx.methodFlags.phq9
      : consentCtx.methodFlags.check_in;

  const access = decideAccess({
    actor: { kind: "patient", patientId, clinicId: DEMO_CLINIC_ID },
    action: "write",
    target: { kind: "answers", patientId, clinicId: DEMO_CLINIC_ID },
    purpose: "self_access",
    consent: {
      ...consentCtx.consentState,
      taking_part: takingPartForKind,
    },
  });

  return access.ok && access.value.allowed;
}

export function isCrisisBedsideInput(input: BedsideCheckInInput): boolean {
  if (input.kind === "crisis_button") return true;
  if (input.kind !== "phq9_item") return false;
  const res = isCrisis({ id: input.itemId, value: input.value });
  return res.ok && res.value === true;
}

async function upsertBedsideRound(
  participant: { id: string; clinicId: string | null },
  input: Extract<BedsideCheckInInput, { kind: "taps" | "not_today" }>,
  source: string,
  prisma: PrismaClient
): Promise<number> {
  const roundNumber = await resolveRoundNumber(participant.id, input.date, prisma);
  const isTaps = input.kind === "taps";
  const now = new Date();
  const data = {
    clinicId: participant.clinicId,
    scheduledAt: now,
    respondedAt: isTaps ? now : null,
    date: input.date,
    dayIndex: roundNumber * 3,
    weekNumber: Math.max(1, Math.ceil(roundNumber / 2)),
    status: isTaps ? "completed" : "not_today",
    moodScore: isTaps ? input.mood : null,
    interestScore: isTaps ? input.interest : null,
    isSimulated: input.isSimulated,
    source,
  };

  if (!isTaps) {
    await writeNotTodayUnlessCompleted(participant.id, roundNumber, data, prisma);
    return roundNumber;
  }
  await prisma.checkInRound.upsert({
    where: { participantId_roundNumber: { participantId: participant.id, roundNumber } },
    update: data,
    create: { participantId: participant.id, roundNumber, ...data },
  });
  return roundNumber;
}

/**
 * A "Not today" must never erase answers already given for the round, even
 * when a taps request for the same date races it. Each step is one statement
 * the database decides: update only a row that is not completed; if none was
 * updated, create the row, and a unique-key conflict means the row exists
 * (completed, or just written by taps), so it is left as it is.
 */
async function writeNotTodayUnlessCompleted(
  participantId: string,
  roundNumber: number,
  data: Omit<Prisma.CheckInRoundUncheckedCreateInput, "participantId" | "roundNumber">,
  prisma: PrismaClient
): Promise<void> {
  const updated = await prisma.checkInRound.updateMany({
    where: { participantId, roundNumber, status: { not: "completed" } },
    data,
  });
  if (updated.count > 0) return;
  try {
    await prisma.checkInRound.create({ data: { participantId, roundNumber, ...data } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

async function upsertBedsidePhq9Item(
  participant: { id: string; clinicId: string | null },
  input: Extract<BedsideCheckInInput, { kind: "phq9_item" }>,
  source: string,
  prisma: PrismaClient
): Promise<number> {
  const openRoundNumber = await resolveRoundNumber(participant.id, input.date, prisma);
  const inProgress = await prisma.phq9Assessment.findFirst({
    where: { participantId: participant.id, status: "in_progress" },
    orderBy: { roundNumber: "desc" },
  });
  const roundNumber = inProgress?.roundNumber ?? openRoundNumber;
  const existing =
    inProgress ??
    (await prisma.phq9Assessment.findUnique({
      where: { participantId_roundNumber: { participantId: participant.id, roundNumber } },
    }));

  const col = PHQ9_COLUMN_BY_ID[input.itemId as keyof typeof PHQ9_COLUMN_BY_ID];
  if (!col) {
    throw new Error(`Invalid PHQ-9 itemId: ${input.itemId}`);
  }

  const itemValues = Object.fromEntries(
    PHQ9_COLUMNS.map((k) => [k, existing ? existing[k] : null])
  ) as Record<Phq9ItemColumn, number | null>;
  itemValues[col] = input.value;

  const scores = PHQ9_COLUMNS.map((k) => itemValues[k]);
  const isComplete = scores.every((v): v is number => typeof v === "number");
  const totalScore = isComplete ? scores.reduce((sum, v) => sum + v, 0) : null;
  const now = new Date();
  const data = {
    clinicId: participant.clinicId,
    scheduledAt: existing?.scheduledAt ?? now,
    completedAt: isComplete ? now : null,
    date: input.date,
    dayIndex: roundNumber * 3,
    weekNumber: Math.max(1, Math.ceil(roundNumber / 2)),
    completedInRoundNumber: isComplete ? openRoundNumber : null,
    status: isComplete ? "completed" : "in_progress",
    totalScore,
    ...itemValues,
    isSimulated: input.isSimulated,
    source,
  };

  await prisma.phq9Assessment.upsert({
    where: { participantId_roundNumber: { participantId: participant.id, roundNumber } },
    update: data,
    create: { participantId: participant.id, roundNumber, ...data },
  });
  return roundNumber;
}

async function recordBedsideCrisisEvent(
  participant: { id: string; clinicId: string | null },
  roundNumber: number,
  input: BedsideCheckInInput,
  prisma: PrismaClient
): Promise<void> {
  await prisma.crisisEvent.upsert({
    where: {
      participantId_roundNumber: {
        participantId: participant.id,
        roundNumber,
      },
    },
    update: {},
    create: {
      participantId: participant.id,
      clinicId: participant.clinicId,
      roundNumber,
      itemId: input.kind === "phq9_item" ? "item9SelfHarm" : "crisis_button",
      value: input.kind === "phq9_item" ? input.value : 1,
      isSimulated: input.isSimulated,
    },
  });
}

/**
 * Persists a derived bedside check-in (voice two-tap, Not today, PHQ-9 item,
 * or physical STM32 crisis button) after checking the participant's stored
 * MeasurementConsent via `decideAccess`.
 */
export async function saveArduinoBedsideCheckIn(
  input: BedsideCheckInInput,
  prisma: PrismaClient = getPrisma()
): Promise<
  | BedsideCheckInOutcome
  | { ok: false; status: 403; error: string; showCrisisPath: boolean; crisisResources: typeof CRISIS_RESOURCES | null }
> {
  const showCrisisPath = isCrisisBedsideInput(input);
  const participant = await ensureHomeDemoParticipant(prisma);
  const consentCtx = await loadConsentContext(participant.id, prisma);

  // Crisis button always surfaces human help immediately even if check-in storage is paused.
  if (input.kind !== "crisis_button") {
    const allowed = checkStoredCheckInConsent(input, participant.id, consentCtx);
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "Check-in consent is currently paused.",
        showCrisisPath,
        crisisResources: showCrisisPath ? CRISIS_RESOURCES : null,
      };
    }
  }

  const source = input.isSimulated ? "simulated_uno_q_voice" : "arduino_uno_q_voice";
  let roundNumber: number | null = null;
  if (input.kind === "taps" || input.kind === "not_today") {
    roundNumber = await upsertBedsideRound(participant, input, source, prisma);
  } else if (input.kind === "phq9_item") {
    roundNumber = await upsertBedsidePhq9Item(participant, input, source, prisma);
  }

  if (showCrisisPath) {
    const crisisRound =
      roundNumber ?? (await resolveRoundNumber(participant.id, input.date, prisma));
    await recordBedsideCrisisEvent(participant, crisisRound, input, prisma);
    roundNumber = crisisRound;
  }

  return {
    ok: true,
    kind: input.kind,
    showCrisisPath,
    crisisResources: showCrisisPath ? CRISIS_RESOURCES : null,
    roundNumber,
    source,
  };
}
