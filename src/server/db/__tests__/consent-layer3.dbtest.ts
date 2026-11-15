import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredPhq9 } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createPhq9Repository } from "../phq9";
import { createPatientRepository } from "../patients";

describe("Layer 3 consent and per-patient storeItemAnswers (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientAId: string;
  let patientBId: string;
  let patientCId: string;

  // Global setting is storeItemAnswers: false
  const globalOffCtx = () => createDbContext(prisma, { storeItemAnswers: false });
  const globalOnCtx = () => createDbContext(prisma, { storeItemAnswers: true });
  const phq9Repo = (ctx = globalOffCtx()) => createPhq9Repository(ctx);
  const patientRepo = (ctx = globalOffCtx()) => createPatientRepository(ctx);

  const createTestParticipant = (label: string) =>
    prisma.participant.create({
      data: {
        clinicId,
        label,
        source: "live",
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
      },
    });

  const sampleCompletedPhq9 = (patientId: string, roundNumber = 1): StoredPhq9 => ({
    patientId,
    roundNumber,
    progress: "completed",
    answers: ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((id, index) => ({ id, value: index % 4 })),
    total: 10,
    completedAt: "2026-11-16T16:40:00.000Z",
    completedInRoundNumber: roundNumber,
    date: "2026-11-16",
  });

  beforeAll(async () => {
    prisma = getPrisma();
    const clinic = await prisma.clinic.create({
      data: { code: "consent-l3-clinic-" + Date.now(), name: "Layer 3 Clinic" },
    });
    clinicId = clinic.id;
    patientAId = (await createTestParticipant("consent-l3-patient-a")).id;
    patientBId = (await createTestParticipant("consent-l3-patient-b")).id;
    patientCId = (await createTestParticipant("consent-l3-patient-c")).id;
  });

  afterAll(async () => {
    await prisma.consentEvent.deleteMany({
      where: { participantId: { in: [patientAId, patientBId, patientCId] } },
    });
    await prisma.phq9Assessment.deleteMany({
      where: { participantId: { in: [patientAId, patientBId, patientCId] } },
    });
    await prisma.participant.deleteMany({
      where: { id: { in: [patientAId, patientBId, patientCId] } },
    });
    await prisma.clinic.deleteMany({ where: { id: clinicId } });
    await prisma.$disconnect();
  });

  it("stores item columns when patient newest layer 3 consent is on, despite global storeItemAnswers being off", async () => {
    // Write consent event layer: detailed_answers enabled: true for patient A
    await prisma.consentEvent.create({
      data: {
        participantId: patientAId,
        clinicId,
        layer: "detailed_answers",
        enabled: true,
        noticeVersion: "v1",
      },
    });

    // Save with globalOffCtx (storeItemAnswers is false globally)
    await phq9Repo(globalOffCtx()).savePhq9(sampleCompletedPhq9(patientAId, 1));

    // In DB, item columns MUST be written
    const row = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientAId, roundNumber: 1 } },
    });
    expect(row.item1Interest).toBe(0);
    expect(row.item2Mood).toBe(1);
    expect(row.item3Sleep).toBe(2);

    // Reading back through repo returns individual answers
    const stored = await phq9Repo(globalOffCtx()).getPhq9s(patientAId);
    expect(stored[0].answers).toHaveLength(9);
    expect(stored[0].total).toBe(10);
  });

  it("does NOT store item columns when patient has no layer 3 or layer 3 is off, even if global setting was on", async () => {
    // Record layer 3 as off for patient B
    await prisma.consentEvent.create({
      data: {
        participantId: patientBId,
        clinicId,
        layer: "detailed_answers",
        enabled: false,
        noticeVersion: "v1",
      },
    });

    // Save with globalOnCtx (storeItemAnswers: true globally)
    await phq9Repo(globalOnCtx()).savePhq9(sampleCompletedPhq9(patientBId, 1));

    // In DB, item columns MUST remain null because per-patient decision overrides global
    const row = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientBId, roundNumber: 1 } },
    });
    expect(row.item1Interest).toBeNull();
    expect(row.item2Mood).toBeNull();
    expect(row.item3Sleep).toBeNull();
    expect(row.totalScore).toBe(10);

    // Reading back through repo gives empty answers for completed questionnaire
    const stored = await phq9Repo(globalOnCtx()).getPhq9s(patientBId);
    expect(stored[0].answers).toEqual([]);
    expect(stored[0].total).toBe(10);
  });

  it("withdrawing layer 3 deletes the patient's stored individual answers, leaving totals intact and other patients unaffected", async () => {
    // Patient C has layer 3 ON and saves an assessment
    await prisma.consentEvent.create({
      data: {
        participantId: patientCId,
        clinicId,
        layer: "detailed_answers",
        enabled: true,
        noticeVersion: "v1",
      },
    });
    await phq9Repo(globalOffCtx()).savePhq9(sampleCompletedPhq9(patientCId, 1));

    // Verify Patient A and Patient C both have stored item columns
    const rowABefore = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientAId, roundNumber: 1 } },
    });
    const rowCBefore = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientCId, roundNumber: 1 } },
    });
    expect(rowABefore.item1Interest).not.toBeNull();
    expect(rowCBefore.item1Interest).not.toBeNull();

    // Patient A withdraws layer 3 via patient repository
    const patientARecord = await patientRepo().getPatient(patientAId);
    expect(patientARecord).not.toBeNull();
    if (patientARecord) {
      await patientRepo().savePatient({
        ...patientARecord,
        consent: {
          ...patientARecord.consent,
          detailed_answers: false,
        },
      });
    }

    // Verify in database: Patient A's item columns are now ALL null!
    const rowAAfter = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientAId, roundNumber: 1 } },
    });
    expect(rowAAfter.item1Interest).toBeNull();
    expect(rowAAfter.item2Mood).toBeNull();
    expect(rowAAfter.item3Sleep).toBeNull();
    expect(rowAAfter.item9SelfHarm).toBeNull();
    // Total score and dates are preserved
    expect(rowAAfter.totalScore).toBe(10);
    expect(rowAAfter.status).toBe("completed");

    // Other patient (Patient C) is COMPLETELY unaffected
    const rowCAfter = await prisma.phq9Assessment.findUniqueOrThrow({
      where: { participantId_roundNumber: { participantId: patientCId, roundNumber: 1 } },
    });
    expect(rowCAfter.item1Interest).not.toBeNull();
    expect(rowCAfter.item2Mood).not.toBeNull();
    expect(rowCAfter.totalScore).toBe(10);

    // If Patient A turns layer 3 back on later, answers given while it was off/withdrawn are NEVER brought back
    await prisma.consentEvent.create({
      data: {
        participantId: patientAId,
        clinicId,
        layer: "detailed_answers",
        enabled: true,
        noticeVersion: "v1",
      },
    });

    const readBack = await phq9Repo(globalOffCtx()).getPhq9s(patientAId);
    expect(readBack[0].answers).toEqual([]);
    expect(readBack[0].total).toBe(10);
  });
});
