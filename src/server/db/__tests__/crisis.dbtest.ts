import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoredCrisisEvent } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createCrisisRepository } from "../crisis";

describe("Crisis repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let otherId: string;
  const repo = () => createCrisisRepository(createDbContext(prisma));

  const event = (roundNumber: number, occurredAt: string, value = 2): StoredCrisisEvent => ({
    patientId,
    roundNumber,
    itemId: "9",
    value,
    occurredAt,
    acknowledgedAt: null,
  });

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (await prisma.clinic.create({ data: { code: "crisis-dbtest-clinic", name: "Crisis" } })).id;
    await prisma.staffUser.create({
      data: {
        id: "staff-user-test-1",
        clinicId,
        email: "crisis-staff-1@test.local",
        name: "Crisis Staff 1",
      },
    });
    const data = { clinicId, source: "live" };
    patientId = (await prisma.participant.create({ data: { ...data, label: "crisis-dbtest-main" } })).id;
    otherId = (await prisma.participant.create({ data: { ...data, label: "crisis-dbtest-other" } })).id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { label: { startsWith: "crisis-dbtest-" } } });
    await prisma.clinic.deleteMany({ where: { code: "crisis-dbtest-clinic" } });
    await prisma.$disconnect();
  });

  it("reads a saved event back equal", async () => {
    const saved = event(1, "2026-11-16T16:20:00.000Z");
    await repo().saveCrisisEvent(saved);
    expect(await repo().getCrisisEvents(patientId)).toEqual([saved]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("stores the PHQ-9 column name and the clinic", async () => {
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z"));
    const row = await prisma.crisisEvent.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.itemId).toBe("item9SelfHarm");
    expect(row.clinicId).toBe(clinicId);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("changes nothing when a second event is saved for the same round", async () => {
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z", 1));
    await repo().saveCrisisEvent(event(1, "2026-11-16T17:00:00.000Z", 3));
    const events = await repo().getCrisisEvents(patientId);
    expect(events).toEqual([event(1, "2026-11-16T16:20:00.000Z", 1)]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("stores the events of two rounds and gives the oldest first", async () => {
    await repo().saveCrisisEvent(event(2, "2026-11-19T16:20:00.000Z"));
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z"));
    const events = await repo().getCrisisEvents(patientId);
    expect(events.map((e) => e.roundNumber)).toEqual([1, 2]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("reads a crisis button row that other code wrote with its item id unchanged", async () => {
    await prisma.crisisEvent.create({
      data: {
        participantId: patientId,
        clinicId,
        roundNumber: 1,
        itemId: "crisis_button",
        value: 1,
        occurredAt: new Date("2026-11-16T16:20:00.000Z"),
      },
    });
    const events = await repo().getCrisisEvents(patientId);
    expect(events).toEqual([
      {
        patientId,
        roundNumber: 1,
        itemId: "crisis_button",
        value: 1,
        occurredAt: "2026-11-16T16:20:00.000Z",
        acknowledgedAt: null,
      },
    ]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("gives only the events of the asked patient", async () => {
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z"));
    await repo().saveCrisisEvent({ ...event(1, "2026-11-16T16:20:00.000Z"), patientId: otherId });
    const events = await repo().getCrisisEvents(patientId);
    expect(events).toHaveLength(1);
    expect(events[0].patientId).toBe(patientId);
    await prisma.crisisEvent.deleteMany({ where: { participantId: { in: [patientId, otherId] } } });
  });
  it("stores a later acknowledgement and keeps the first event's item, value and time", async () => {
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z", 1));
    await repo().saveCrisisEvent({
      ...event(1, "2026-11-16T17:00:00.000Z", 3),
      itemId: "crisis_button",
      acknowledgedAt: "2026-11-16T18:00:00.000Z",
    });
    expect(await repo().getCrisisEvents(patientId)).toEqual([
      { ...event(1, "2026-11-16T16:20:00.000Z", 1), acknowledgedAt: "2026-11-16T18:00:00.000Z" },
    ]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("keeps the first acknowledgement and never clears it", async () => {
    const first = { ...event(1, "2026-11-16T16:20:00.000Z"), acknowledgedAt: "2026-11-16T18:00:00.000Z" };
    await repo().saveCrisisEvent(first);
    await repo().saveCrisisEvent({ ...first, acknowledgedAt: "2026-11-17T09:00:00.000Z" });
    await repo().saveCrisisEvent({ ...first, acknowledgedAt: null });
    expect(await repo().getCrisisEvents(patientId)).toEqual([first]);
    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });

  it("lists unacknowledged crisis events for a clinic and records acknowledging staff member", async () => {
    const staffId = "staff-user-test-1";
    await repo().saveCrisisEvent(event(1, "2026-11-16T16:20:00.000Z"));
    await repo().saveCrisisEvent(event(2, "2026-11-17T16:20:00.000Z"));

    const unackBefore = await repo().getUnacknowledgedCrisisEvents(clinicId);
    expect(unackBefore.map((e) => e.roundNumber)).toEqual([1, 2]);

    await repo().saveCrisisEvent({
      ...event(1, "2026-11-16T16:20:00.000Z"),
      acknowledgedAt: "2026-11-16T18:00:00.000Z",
      acknowledgedByStaffId: staffId,
    });

    const unackAfter = await repo().getUnacknowledgedCrisisEvents(clinicId);
    expect(unackAfter.map((e) => e.roundNumber)).toEqual([2]);

    const events = await repo().getCrisisEvents(patientId);
    const ack1 = events.find((e) => e.roundNumber === 1);
    expect(ack1?.acknowledgedAt).toBe("2026-11-16T18:00:00.000Z");
    expect(ack1?.acknowledgedByStaffId).toBe(staffId);

    await prisma.crisisEvent.deleteMany({ where: { participantId: patientId } });
  });
});
