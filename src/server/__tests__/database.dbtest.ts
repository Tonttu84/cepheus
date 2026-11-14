import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../lib/db";
import { seedDatabase } from "../../../prisma/seed";

describe("PostgreSQL Database Integration Tests (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = getPrisma();
  });

  afterAll(async () => {
    // Clean up test participants and Step 2 clinic/log rows created during tests
    try {
      await prisma.participant.deleteMany({
        where: {
          externalId: {
            in: [
              "tx-commit-1",
              "tx-commit-2",
              "tx-rollback-1",
              "step2-delete-check",
              "phq9-unique-test-participant",
            ],
          },
        },
      });
      await prisma.clinic.deleteMany({
        where: {
          code: {
            in: ["test-clinic-step2", "test-clinic-phq9-unique"],
          },
        },
      });
      await prisma.accessLog.deleteMany({
        where: { patientCode: "P-STEP2-DEL" },
      });
    } catch {
      // Ignore cleanup error if already removed
    }
    await prisma.$disconnect();
  });

  it("writes and reads back the seed simulated participant with its isSimulated mark and clinic link", async () => {
    const seedResult = await seedDatabase(prisma);
    expect(seedResult.participantId).toBeDefined();

    const participant = await prisma.participant.findUnique({
      where: { id: seedResult.participantId },
      include: { clinic: true, consentEvents: true },
    });

    expect(participant).not.toBeNull();
    expect(participant?.id).toBe(seedResult.participantId);
    expect(participant?.externalId).toBe(seedResult.externalId);
    expect(participant?.participantCode).toBe("P-SIM-001");
    expect(participant?.clinic?.code).toBe("sim-clinic-01");
    expect(participant?.consentEvents.length).toBeGreaterThan(0);
    expect(participant?.isSimulated).toBe(true);
    expect(participant?.label).toBe("Simulated post-TMS participant");
  });

  it("getPrisma() returns the same instance twice and handles transactions with commit and rollback", async () => {
    // Returns the same instance twice
    const instanceA = getPrisma();
    const instanceB = getPrisma();
    expect(instanceA).toBe(instanceB);

    // Transaction with two writes commits both
    await instanceA.$transaction(async (tx) => {
      await tx.participant.create({
        data: {
          externalId: "tx-commit-1",
          label: "Transaction Test 1",
          source: "test",
          isSimulated: true,
        },
      });
      await tx.participant.create({
        data: {
          externalId: "tx-commit-2",
          label: "Transaction Test 2",
          source: "test",
          isSimulated: true,
        },
      });
    });

    const commit1 = await instanceA.participant.findUnique({
      where: { externalId: "tx-commit-1" },
    });
    const commit2 = await instanceA.participant.findUnique({
      where: { externalId: "tx-commit-2" },
    });
    expect(commit1).not.toBeNull();
    expect(commit2).not.toBeNull();

    // When the second write throws, keeps neither
    await expect(
      instanceA.$transaction(async (tx) => {
        await tx.participant.create({
          data: {
            externalId: "tx-rollback-1",
            label: "Transaction Rollback 1",
            source: "test",
            isSimulated: true,
          },
        });
        throw new Error("Simulated rollback error");
      })
    ).rejects.toThrow("Simulated rollback error");

    const rollback1 = await instanceA.participant.findUnique({
      where: { externalId: "tx-rollback-1" },
    });
    expect(rollback1).toBeNull();
  });

  it("deleting a participant leaves none of that participant's rows in any table (dynamically discovered)", async () => {
    // Seed participant with child rows
    const seedResult = await seedDatabase(prisma);
    const participantId = seedResult.participantId;

    // Verify child rows exist before deletion
    const consentsBefore = await prisma.measurementConsent.count({
      where: { participantId },
    });
    const ringDaysBefore = await prisma.ringDay.count({
      where: { participantId },
    });
    const roundsBefore = await prisma.checkInRound.count({
      where: { participantId },
    });

    expect(consentsBefore).toBeGreaterThan(0);
    expect(ringDaysBefore).toBeGreaterThan(0);
    expect(roundsBefore).toBeGreaterThan(0);

    // Delete the participant
    await prisma.participant.delete({
      where: { id: participantId },
    });

    // Verify participant is deleted
    const participantAfter = await prisma.participant.findUnique({
      where: { id: participantId },
    });
    expect(participantAfter).toBeNull();

    // Ask PostgreSQL (information_schema.columns) for every table that has a participantId column
    const tablesWithParticipantId = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'participantId'
    `;

    const tableNames = tablesWithParticipantId.map((r) => r.table_name);

    // Assert list of such tables is not empty and includes at least check-in and PHQ-9 tables
    expect(tableNames.length).toBeGreaterThan(0);
    expect(tableNames).toContain("CheckInRound");
    expect(tableNames).toContain("Phq9Assessment");

    // Assert for each that no row of the deleted participant remains
    for (const tableName of tableNames) {
      const result = await prisma.$queryRawUnsafe<Array<{ count: number | bigint }>>(
        `SELECT COUNT(*)::int AS count FROM "${tableName}" WHERE "participantId" = $1`,
        participantId
      );
      expect(Number(result[0].count)).toBe(0);
    }
  });

  it("stores Step 2 tables (Clinic, StaffUser, EnrolmentCode, ConsentEvent, CrisisEvent) and keeps AccessLog after participant deletion", async () => {
    const clinic = await prisma.clinic.upsert({
      where: { code: "test-clinic-step2" },
      update: {},
      create: {
        code: "test-clinic-step2",
        name: "Step 2 Test Clinic",
      },
    });

    const staff = await prisma.staffUser.upsert({
      where: { email: "nurse-step2@test.local" },
      update: {},
      create: {
        clinicId: clinic.id,
        email: "nurse-step2@test.local",
        name: "Test Nurse",
        role: "nurse",
      },
    });

    const participant = await prisma.participant.create({
      data: {
        clinicId: clinic.id,
        externalId: "step2-delete-check",
        participantCode: "P-STEP2-DEL",
        label: "Step 2 Delete Check Participant",
        source: "synthetic",
        isSimulated: true,
        enrolmentDate: "2026-11-14",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
        takingPart: true,
        ruleCheckConsent: false,
      },
    });

    await prisma.enrolmentCode.create({
      data: {
        clinicId: clinic.id,
        participantId: participant.id,
        codeHash: `hash-${participant.id}`,
        expiresAt: new Date("2026-11-15T18:00:00Z"),
      },
    });

    await prisma.consentEvent.create({
      data: {
        clinicId: clinic.id,
        participantId: participant.id,
        layer: "taking_part",
        enabled: true,
        noticeVersion: "v1",
      },
    });

    await prisma.crisisEvent.create({
      data: {
        clinicId: clinic.id,
        participantId: participant.id,
        roundNumber: 1,
        itemId: "item9SelfHarm",
        value: 1,
        acknowledgedByStaffId: staff.id,
        acknowledgedAt: new Date("2026-11-14T19:00:00Z"),
        isSimulated: true,
      },
    });

    await prisma.accessLog.create({
      data: {
        clinicId: clinic.id,
        actorKind: "staff",
        actorId: staff.id,
        patientCode: "P-STEP2-DEL",
        action: "read",
        targetKind: "crisis_messages",
        purpose: "care",
        allowed: true,
        reason: "allowed",
      },
    });

    // Delete participant -> ConsentEvent, CrisisEvent, EnrolmentCode cascade away
    await prisma.participant.delete({
      where: { id: participant.id },
    });

    expect(await prisma.consentEvent.count({ where: { participantId: participant.id } })).toBe(0);
    expect(await prisma.crisisEvent.count({ where: { participantId: participant.id } })).toBe(0);
    expect(await prisma.enrolmentCode.count({ where: { participantId: participant.id } })).toBe(0);

    // AccessLog holds no answers and survives participant deletion
    const logs = await prisma.accessLog.findMany({
      where: { patientCode: "P-STEP2-DEL" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].targetKind).toBe("crisis_messages");
  });

  it("fails with unique-constraint error when storing a second PHQ-9 for the same participant and round", async () => {
    const clinic = await prisma.clinic.upsert({
      where: { code: "test-clinic-phq9-unique" },
      update: {},
      create: {
        code: "test-clinic-phq9-unique",
        name: "PHQ-9 Unique Constraint Test Clinic",
      },
    });

    const participant = await prisma.participant.create({
      data: {
        clinicId: clinic.id,
        externalId: "phq9-unique-test-participant",
        participantCode: "P-PHQ9-UNIQ",
        label: "PHQ-9 Unique Constraint Participant",
        source: "synthetic",
        isSimulated: true,
        enrolmentDate: "2026-11-14",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
        takingPart: true,
        ruleCheckConsent: false,
      },
    });

    await prisma.phq9Assessment.create({
      data: {
        participantId: participant.id,
        clinicId: clinic.id,
        scheduledAt: new Date("2026-11-14T10:00:00Z"),
        completedAt: new Date("2026-11-14T10:15:00Z"),
        date: "2026-11-14",
        dayIndex: 1,
        weekNumber: 1,
        roundNumber: 1,
        completedInRoundNumber: 1,
        status: "completed",
        totalScore: 3,
        item1Interest: 0,
        item2Mood: 0,
        item3Sleep: 1,
        item4Energy: 1,
        item5Appetite: 0,
        item6SelfWorth: 0,
        item7Concentration: 1,
        item8Psychomotor: 0,
        item9SelfHarm: 0,
      },
    });

    await expect(
      prisma.phq9Assessment.create({
        data: {
          participantId: participant.id,
          clinicId: clinic.id,
          scheduledAt: new Date("2026-11-14T11:00:00Z"),
          completedAt: new Date("2026-11-14T11:20:00Z"),
          date: "2026-11-14",
          dayIndex: 1,
          weekNumber: 1,
          roundNumber: 1,
          completedInRoundNumber: 1,
          status: "completed",
          totalScore: 5,
        },
      })
    ).rejects.toThrow(/unique constraint/i);
  });
});
