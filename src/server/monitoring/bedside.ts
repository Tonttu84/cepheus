import type { PrismaClient } from "@prisma/client";
import { decideAccess } from "@/domain/access";
import { isCrisis } from "@/domain/crisis";
import { CRISIS_RESOURCES } from "@/lib/constants";
import { getPrisma } from "@/lib/db";
import { DEMO_CLINIC_ID, ensureHomeDemoParticipant } from "./store";

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

/**
 * Persists a derived bedside check-in (voice two-tap, Not today, PHQ-9 item,
 * or physical STM32 crisis button) for the demo home node after enforcing `decideAccess`.
 * Never stores raw audio or transcripts.
 */
export async function saveArduinoBedsideCheckIn(
  input: BedsideCheckInInput,
  prisma: PrismaClient = getPrisma()
): Promise<BedsideCheckInOutcome | { ok: false; status: 403; error: string }> {
  const crisisFromItem =
    input.kind === "phq9_item"
      ? isCrisis({ id: input.itemId, value: input.value })
      : { ok: true as const, value: false };
  const showCrisisPath =
    input.kind === "crisis_button" ||
    (crisisFromItem.ok && crisisFromItem.value === true);

  const participant = await ensureHomeDemoParticipant(prisma);
  const access = decideAccess({
    actor: { kind: "patient", patientId: participant.id, clinicId: DEMO_CLINIC_ID },
    action: "write",
    target: { kind: "answers", patientId: participant.id, clinicId: DEMO_CLINIC_ID },
    purpose: "self_access",
    consent: { taking_part: true, methods: { ring: true, camera: true }, rule_check: false },
  });

  if (!access.ok || !access.value.allowed) {
    return { ok: false, status: 403, error: "Check-in access is not permitted." };
  }

  const source = input.isSimulated ? "simulated_uno_q_voice" : "arduino_uno_q_voice";
  const now = new Date();
  let roundNumber: number | null = null;

  if (input.kind === "taps" || input.kind === "not_today") {
    roundNumber = await resolveRoundNumber(participant.id, input.date, prisma);
    const status = input.kind === "taps" ? "completed" : "not_today";
    const data = {
      scheduledAt: now,
      respondedAt: input.kind === "taps" ? now : null,
      date: input.date,
      dayIndex: roundNumber * 3,
      weekNumber: Math.max(1, Math.ceil(roundNumber / 2)),
      status,
      moodScore: input.kind === "taps" ? input.mood : null,
      interestScore: input.kind === "taps" ? input.interest : null,
      selfHarmTriggered: false,
      crisisPathShown: false,
      isSimulated: input.isSimulated,
      source,
    };

    await prisma.checkInRound.upsert({
      where: { participantId_roundNumber: { participantId: participant.id, roundNumber } },
      update: data,
      create: { participantId: participant.id, roundNumber, ...data },
    });
  }

  if (showCrisisPath) {
    await prisma.clinicFlag.create({
      data: {
        participantId: participant.id,
        sinceDate: input.date,
        triggerKind: "crisis_self_harm",
        primaryArea: "check_in",
        broadAreasJson: JSON.stringify(["check_in"]),
        status: "open",
        isSimulated: input.isSimulated,
      },
    });
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
