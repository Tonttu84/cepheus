import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { authenticateStaffCredentials } from "@/server/auth/staff-auth";
import { simulatedFinnishEidProvider } from "@/server/auth/eid-provider";
import { getOpenRound, type Schedule } from "@/domain/rounds";
import {
  seedDatabase,
  SIM_CLINIC_ID,
  SIM_NURSE,
} from "../../../prisma/seed";

describe("the seeded people and auth module lookups (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = getPrisma();
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds ONE nurse exactly as staff-auth resolves credentials and IDs", async () => {
    const authResult = await authenticateStaffCredentials({
      email: SIM_NURSE.email,
      password: "cepheus-local-only",
      totpCode: "123456",
    });

    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    expect(authResult.session.kind).toBe("staff");
    expect(authResult.session.actor).toEqual({
      kind: "staff",
      staffId: SIM_NURSE.id,
      clinicId: SIM_CLINIC_ID,
      role: "nurse",
    });
    expect(authResult.session.email).toBe("nurse@sim-clinic.local");
    expect(authResult.session.isSimulated).toBe(true);

    const staffInClinic = await prisma.staffUser.findMany({
      where: { clinicId: SIM_CLINIC_ID },
    });
    expect(staffInClinic).toHaveLength(1);
    expect(staffInClinic[0].id).toBe(SIM_NURSE.id);
    expect(staffInClinic[0].email).toBe("nurse@sim-clinic.local");
    expect(staffInClinic[0].role).toBe("nurse");
  });

  it("seeds P-SIM-001 exactly as eid-provider looks it up, with valid schedule, consent and round 2 open", async () => {
    const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset("P-SIM-001");
    expect(session).not.toBeNull();
    if (!session) return;

    const db = await prisma.participant.findUniqueOrThrow({
      where: { participantCode: "P-SIM-001" },
      include: { consentEvents: true, checkInRounds: true },
    });

    expect(session.actor).toEqual({
      kind: "patient",
      patientId: db.id,
      clinicId: SIM_CLINIC_ID,
    });
    expect(db.clinicId).toBe(SIM_CLINIC_ID);
    expect(db.isSimulated).toBe(true);
    expect(db.takingPart).toBe(true);
    expect(db.ruleCheckConsent).toBe(true);
    expect(JSON.parse(db.questionnairesJson ?? "[]")).toEqual(["phq9"]);

    const schedule: Schedule = {
      weekdays: JSON.parse(db.scheduleDaysJson!),
      timeOfDay: db.scheduleTime!,
      timeZone: db.timeZone,
      enrolmentDate: db.enrolmentDate!,
    };
    const openRound = getOpenRound(schedule, new Date());
    expect(openRound?.number).toBe(2);

    const round1 = db.checkInRounds.find((r) => r.roundNumber === 1);
    expect(round1).toBeDefined();
    expect(round1?.status).toBe("completed");
    expect(round1?.moodScore).toBe(3);
    expect(round1?.interestScore).toBe(3);
  });

  it("seeds P-SIM-DEP-01 exactly as eid-provider looks it up, with valid schedule, consent and round 1 open", async () => {
    const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset("P-SIM-DEP-01");
    expect(session).not.toBeNull();
    if (!session) return;

    const db = await prisma.participant.findUniqueOrThrow({
      where: { participantCode: "P-SIM-DEP-01" },
      include: { consentEvents: true },
    });

    expect(session.actor).toEqual({
      kind: "patient",
      patientId: db.id,
      clinicId: SIM_CLINIC_ID,
    });
    expect(db.clinicId).toBe(SIM_CLINIC_ID);
    expect(db.isSimulated).toBe(true);
    expect(db.takingPart).toBe(true);
    expect(db.ruleCheckConsent).toBe(true);
    expect(JSON.parse(db.questionnairesJson ?? "[]")).toEqual(["phq9"]);

    const schedule: Schedule = {
      weekdays: JSON.parse(db.scheduleDaysJson!),
      timeOfDay: db.scheduleTime!,
      timeZone: db.timeZone,
      enrolmentDate: db.enrolmentDate!,
    };
    const openRound = getOpenRound(schedule, new Date());
    expect(openRound?.number).toBe(1);
  });

  it("seeds P-SIM-ANX-01 exactly as eid-provider looks it up, assigned GAD-7, with valid schedule and round 1 open", async () => {
    const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset("P-SIM-ANX-01");
    expect(session).not.toBeNull();
    if (!session) return;

    const db = await prisma.participant.findUniqueOrThrow({
      where: { participantCode: "P-SIM-ANX-01" },
      include: { consentEvents: true },
    });

    expect(session.actor).toEqual({
      kind: "patient",
      patientId: db.id,
      clinicId: SIM_CLINIC_ID,
    });
    expect(db.clinicId).toBe(SIM_CLINIC_ID);
    expect(db.isSimulated).toBe(true);
    expect(db.takingPart).toBe(true);
    expect(db.ruleCheckConsent).toBe(true);
    expect(JSON.parse(db.questionnairesJson ?? "[]")).toEqual(["phq9", "gad7"]);

    const schedule: Schedule = {
      weekdays: JSON.parse(db.scheduleDaysJson!),
      timeOfDay: db.scheduleTime!,
      timeZone: db.timeZone,
      enrolmentDate: db.enrolmentDate!,
    };
    const openRound = getOpenRound(schedule, new Date());
    expect(openRound?.number).toBe(1);
  });
});
