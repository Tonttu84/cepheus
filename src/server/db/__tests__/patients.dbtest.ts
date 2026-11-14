import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { PatientRecord } from "@/usecases/ports";
import { createDbContext } from "../context";
import { createPatientRepository } from "../patients";

describe("Patient repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  const patientIds: string[] = [];

  function newId(name: string): string {
    const id = `patients-dbtest-${name}`;
    patientIds.push(id);
    return id;
  }

  function recordFor(patientId: string, overrides: Partial<PatientRecord> = {}): PatientRecord {
    return {
      patientId,
      clinicId,
      schedule: {
        weekdays: [1, 4],
        timeOfDay: "09:30",
        timeZone: "Europe/Helsinki",
        enrolmentDate: "2026-09-01",
      },
      consent: { taking_part: true, methods: { ring: true, camera: false }, rule_check: true },
      ...overrides,
    };
  }

  beforeAll(async () => {
    prisma = getPrisma();
    const clinic = await prisma.clinic.create({
      data: { code: `patients-dbtest-${Date.now()}`, name: "Patients test clinic" },
    });
    clinicId = clinic.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { id: { startsWith: "patients-dbtest-" } } });
    await prisma.clinic.delete({ where: { id: clinicId } });
    await prisma.$disconnect();
  });

  it("reads a saved patient back equal to the record, without questionnaires", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const record = recordFor(newId("plain"));
    await repo.savePatient(record);
    const read = await repo.getPatient(record.patientId);
    expect(read).toEqual(record);
    expect(read).not.toHaveProperty("questionnaires");
  });

  it("reads a saved patient back equal to the record, with questionnaires", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const record = recordFor(newId("with-q"), { questionnaires: ["phq9", "gad7"] });
    await repo.savePatient(record);
    expect(await repo.getPatient(record.patientId)).toEqual(record);
  });

  it("gives the patient id, clinic id and consent as the access switches of a saved patient", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const record = recordFor(newId("switches"), { questionnaires: ["gad7"] });
    await repo.savePatient(record);
    expect(await repo.getPatientAccessSwitches(record.patientId)).toEqual({
      patientId: record.patientId,
      clinicId,
      consent: record.consent,
      questionnaires: ["gad7"],
    });
  });

  it("stores the two method switches as the ring_rhythm and camera_expressivity consent rows", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const record = recordFor(newId("rows"));
    await repo.savePatient(record);
    const rows = await prisma.measurementConsent.findMany({
      where: { participantId: record.patientId },
      orderBy: { method: "asc" },
    });
    expect(rows.map((row) => [row.method, row.enabled, row.clinicId])).toEqual([
      ["camera_expressivity", false, clinicId],
      ["ring_rhythm", true, clinicId],
    ]);
  });

  it("changes the stored values when a patient is saved again and makes no second participant or consent row", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("again");
    await repo.savePatient(recordFor(id));
    const changed = recordFor(id, {
      consent: { taking_part: false, methods: { ring: false, camera: true }, rule_check: false },
      questionnaires: ["phq9"],
    });
    await repo.savePatient(changed);
    expect(await repo.getPatient(id)).toEqual(changed);
    expect(await prisma.participant.count({ where: { id } })).toBe(1);
    expect(await prisma.measurementConsent.count({ where: { participantId: id } })).toBe(2);
  });

  it("gives null from both read methods for an unknown id", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    expect(await repo.getPatient("patients-dbtest-unknown")).toBeNull();
    expect(await repo.getPatientAccessSwitches("patients-dbtest-unknown")).toBeNull();
  });

  it("gives null from both read methods for a participant without a clinic", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("no-clinic");
    await prisma.participant.create({ data: { id, label: "Test", source: "live" } });
    expect(await repo.getPatient(id)).toBeNull();
    expect(await repo.getPatientAccessSwitches(id)).toBeNull();
  });

  it("gives the switches but null from getPatient for a participant with a clinic and no schedule", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("no-schedule");
    await prisma.participant.create({ data: { id, label: "Test", source: "live", clinicId } });
    expect(await repo.getPatient(id)).toBeNull();
    expect(await repo.getPatientAccessSwitches(id)).toEqual({
      patientId: id,
      clinicId,
      consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false },
    });
  });

  async function runTwoUnits(idA: string, idB: string) {
    const ctx = createDbContext(prisma);
    const repo = createPatientRepository(ctx);
    const events: string[] = [];
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const unitA = ctx.unitOfWork.execute(async () => {
      const switches = await repo.getPatientAccessSwitches(idA);
      events.push("a-read");
      await pause(200);
      await repo.savePatient(
        recordFor(idA, { consent: { ...switches!.consent, taking_part: !switches!.consent.taking_part } })
      );
      events.push("a-end");
    });
    await pause(50);
    const unitB = ctx.unitOfWork.execute(async () => {
      const switches = await repo.getPatientAccessSwitches(idB);
      events.push("b-read");
      return switches;
    });
    const [, seenByB] = await Promise.all([unitA, unitB]);
    return { events, seenByB };
  }

  it("makes a second unit of work for the same patient wait at its first read and then see what the first stored", async () => {
    const id = newId("lock-same");
    await createPatientRepository(createDbContext(prisma)).savePatient(recordFor(id));
    const { events, seenByB } = await runTwoUnits(id, id);
    expect(events).toEqual(["a-read", "a-end", "b-read"]);
    expect(seenByB?.consent.taking_part).toBe(false);
  });

  it("does not make units of work for different patients wait for each other", async () => {
    const idA = newId("lock-a");
    const idB = newId("lock-b");
    const repo = createPatientRepository(createDbContext(prisma));
    await repo.savePatient(recordFor(idA));
    await repo.savePatient(recordFor(idB));
    const { events } = await runTwoUnits(idA, idB);
    expect(events).toEqual(["a-read", "b-read", "a-end"]);
  });

  it("reads the record outside a unit of work without a lock", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const record = recordFor(newId("outside"));
    await repo.savePatient(record);
    await expect(repo.getPatient(record.patientId)).resolves.toEqual(record);
  });
});
