import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db";
import { advanceDemoAndRunSystemWork, getDemoOffsetDays, resetDemoClock } from "@/server/api";
import { getSimulatedPatientSummaries, resetSimulatedData } from "@/server/db";
import { checkDemoNeedsReset } from "@/server/db/demo-patients";
import { sharedAnswerStore } from "@/server/db/answer-store";
import { seedDatabase } from "../../../../prisma/seed";

describe("Demo advance and reset database integration (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = getPrisma();
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    resetDemoClock();
    await resetSimulatedData(prisma);
  });

  it("advancing 14 days produces a missed-rounds warning for a seeded patient and reset removes it without touching non-simulated participants", async () => {
    // 1. Create a non-simulated participant in the database
    const nonSimulated = await prisma.participant.create({
      data: {
        externalId: "real-test-patient-001",
        participantCode: "REAL-P-001",
        label: "Real trial participant (non-simulated)",
        source: "trial",
        isSimulated: false,
        enrolmentDate: "2026-10-01",
        scheduleDaysJson: JSON.stringify([1, 4]),
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
      },
    });

    try {
      // 2. Initial state: seeded patients have no missed rounds and no open warnings
      const initialSummaries = await getSimulatedPatientSummaries(prisma);
      const initialSim1 = initialSummaries.find((p) => p.participantCode === "P-SIM-001");
      expect(initialSim1).toBeDefined();
      expect(initialSim1?.missedRoundsCount).toBe(0);
      expect(initialSim1?.openWarnings).toHaveLength(0);

      // 3. Advance 14 days with no answers
      const advResult = await advanceDemoAndRunSystemWork(14);
      expect(advResult.ok).toBe(true);
      expect(getDemoOffsetDays()).toBe(14);

      // 4. Verify seeded patient P-SIM-001 now has missed rounds and a silence warning
      const advancedSummaries = await getSimulatedPatientSummaries(prisma);
      const advancedSim1 = advancedSummaries.find((p) => p.participantCode === "P-SIM-001");
      expect(advancedSim1).toBeDefined();
      expect(advancedSim1!.missedRoundsCount).toBeGreaterThanOrEqual(2);
      expect(advancedSim1!.openWarnings).toContain("silence");

      // Verify warning exists in the clinicFlag table for P-SIM-001
      const flagsInDb = await prisma.clinicFlag.findMany({
        where: { participantId: advancedSim1!.id, causeType: { not: null } },
      });
      expect(flagsInDb.length).toBeGreaterThan(0);
      expect(flagsInDb.some((f) => f.triggerKind === "silence")).toBe(true);

      // 5. Reset demo state
      await resetSimulatedData(prisma);

      // 6. Verify clock offset is reset to 0
      expect(getDemoOffsetDays()).toBe(0);

      // 7. Verify seeded patient warnings and missed rounds are removed, back to clean seeded state
      const resetSummaries = await getSimulatedPatientSummaries(prisma);
      const resetSim1 = resetSummaries.find((p) => p.participantCode === "P-SIM-001");
      expect(resetSim1).toBeDefined();
      expect(resetSim1!.missedRoundsCount).toBe(0);
      expect(resetSim1!.openWarnings).toHaveLength(0);

      const resetFlagsInDb = await prisma.clinicFlag.findMany({
        where: { participantId: resetSim1!.id, causeType: { not: null } },
      });
      expect(resetFlagsInDb).toHaveLength(0);

      // 8. CRITICAL: The non-simulated participant was NOT touched by reset
      const nonSimulatedAfterReset = await prisma.participant.findUnique({
        where: { id: nonSimulated.id },
      });
      expect(nonSimulatedAfterReset).not.toBeNull();
      expect(nonSimulatedAfterReset?.externalId).toBe("real-test-patient-001");
      expect(nonSimulatedAfterReset?.isSimulated).toBe(false);
    } finally {
      // Clean up the non-simulated participant
      await prisma.participant.deleteMany({
        where: { id: nonSimulated.id },
      });
    }
  });

  it("reset deletes pairing credentials and in-memory answers of simulated participants while leaving non-simulated participants untouched", async () => {
    // 1. Identify a seeded simulated participant
    const simPatient = await prisma.participant.findFirstOrThrow({
      where: { participantCode: "P-SIM-001", isSimulated: true },
    });

    // 2. Create a non-simulated participant
    const nonSimulated = await prisma.participant.create({
      data: {
        externalId: "real-test-patient-002",
        participantCode: "REAL-P-002",
        label: "Real trial participant 2",
        source: "trial",
        isSimulated: false,
      },
    });

    // 3. Create WebhookCredentials for both participants
    const simCred = await prisma.webhookCredential.create({
      data: {
        participantId: simPatient.id,
        tokenId: "tok-sim-001",
        sealedSecret: "sealed-sim-secret",
        bearerHash: "hash-sim-001",
      },
    });

    const realCred = await prisma.webhookCredential.create({
      data: {
        participantId: nonSimulated.id,
        tokenId: "tok-real-002",
        sealedSecret: "sealed-real-secret",
        bearerHash: "hash-real-002",
      },
    });

    // 4. Place in-progress questionnaire answers into sharedAnswerStore
    sharedAnswerStore.set(simPatient.id, "phq9", 1, [{ id: "1", value: 2 }]);
    sharedAnswerStore.set(nonSimulated.id, "phq9", 1, [{ id: "1", value: 3 }]);

    try {
      expect(sharedAnswerStore.get(simPatient.id, "phq9", 1)).toEqual([{ id: "1", value: 2 }]);
      expect(sharedAnswerStore.get(nonSimulated.id, "phq9", 1)).toEqual([{ id: "1", value: 3 }]);

      // 5. Perform reset
      await resetSimulatedData(prisma);

      // 6. Verify simulated participant's credential was deleted
      const simCredAfter = await prisma.webhookCredential.findUnique({
        where: { id: simCred.id },
      });
      expect(simCredAfter).toBeNull();

      // 7. Verify simulated participant's in-memory answers were cleared
      expect(sharedAnswerStore.get(simPatient.id, "phq9", 1)).toBeUndefined();

      // 8. CRITICAL: Non-simulated participant's credential and in-memory answers remain intact
      const realCredAfter = await prisma.webhookCredential.findUnique({
        where: { id: realCred.id },
      });
      expect(realCredAfter).not.toBeNull();
      expect(realCredAfter?.participantId).toBe(nonSimulated.id);
      expect(realCredAfter?.tokenId).toBe("tok-real-002");

      expect(sharedAnswerStore.get(nonSimulated.id, "phq9", 1)).toEqual([{ id: "1", value: 3 }]);
    } finally {
      // Clean up non-simulated data
      sharedAnswerStore.deleteForPatient(nonSimulated.id);
      await prisma.webhookCredential.deleteMany({
        where: { id: realCred.id },
      });
      await prisma.participant.deleteMany({
        where: { id: nonSimulated.id },
      });
    }
  });

  it("detects when stored simulated data is ahead of real time (needs reset after restart)", async () => {
    // 1. Initial seeded state: not ahead of time
    expect(await checkDemoNeedsReset(prisma, new Date())).toBe(false);

    // 2. Advance demo time 14 days and run system work (creates future closed rounds/flags)
    await advanceDemoAndRunSystemWork(14);

    // 3. Simulate server restart: offset returns to 0 in memory, now is real time
    resetDemoClock();
    expect(getDemoOffsetDays()).toBe(0);

    // 4. Stored closed rounds and flags for simulated patients are now dated after real time
    const needsResetAfterRestart = await checkDemoNeedsReset(prisma, new Date());
    expect(needsResetAfterRestart).toBe(true);

    // 5. Reset restores clean state, so needsReset returns to false
    await resetSimulatedData(prisma);
    expect(await checkDemoNeedsReset(prisma, new Date())).toBe(false);
  });
});
