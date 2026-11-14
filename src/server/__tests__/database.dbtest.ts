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
    // Clean up test participants created during transaction tests
    try {
      await prisma.participant.deleteMany({
        where: {
          externalId: {
            in: ["tx-commit-1", "tx-commit-2", "tx-rollback-1"],
          },
        },
      });
    } catch {
      // Ignore cleanup error if already removed
    }
    await prisma.$disconnect();
  });

  it("writes and reads back the seed simulated participant with its isSimulated mark", async () => {
    const seedResult = await seedDatabase(prisma);
    expect(seedResult.participantId).toBeDefined();

    const participant = await prisma.participant.findUnique({
      where: { id: seedResult.participantId },
    });

    expect(participant).not.toBeNull();
    expect(participant?.id).toBe(seedResult.participantId);
    expect(participant?.externalId).toBe(seedResult.externalId);
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
});
