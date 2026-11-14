import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { PatientRecord } from "@/usecases/ports";
import { createDbContext } from "../context";
import { StoredDataError, UnknownClinicError } from "../errors";
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
  const eventsOf = (participantId: string) =>
    prisma.consentEvent.findMany({ where: { participantId }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }] });
  const shapeOf = (events: Awaited<ReturnType<typeof eventsOf>>) =>
    events.map((e) => [e.layer, e.method, e.enabled, e.clinicId, e.noticeVersion]).sort();

  it("records one consent event per layer and method when a new patient is saved", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("events-new");
    await repo.savePatient(recordFor(id));
    expect(shapeOf(await eventsOf(id))).toEqual(
      [
        ["method", "camera_expressivity", false, clinicId, "v1"],
        ["method", "ring_rhythm", true, clinicId, "v1"],
        ["rule_check", null, true, clinicId, "v1"],
        ["taking_part", null, true, clinicId, "v1"],
      ].sort()
    );
  });

  it("records no consent event when a patient is saved again with the same switches", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("events-same");
    await repo.savePatient(recordFor(id));
    const before = await eventsOf(id);
    await repo.savePatient(recordFor(id, { questionnaires: ["phq9"] }));
    expect(await eventsOf(id)).toEqual(before);
  });

  it("records one new event for each changed switch only and leaves the earlier events as they were", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("events-change");
    await repo.savePatient(recordFor(id));
    const before = await eventsOf(id);
    await repo.savePatient(
      recordFor(id, { consent: { taking_part: false, methods: { ring: true, camera: true }, rule_check: true } })
    );
    const after = await eventsOf(id);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(shapeOf(after.slice(before.length))).toEqual(
      [
        ["method", "camera_expressivity", true, clinicId, "v1"],
        ["taking_part", null, false, clinicId, "v1"],
      ].sort()
    );
  });

  it("keeps neither the change nor its consent events when the unit of work fails after the save", async () => {
    const ctx = createDbContext(prisma);
    const repo = createPatientRepository(ctx);
    const id = newId("events-rollback");
    await repo.savePatient(recordFor(id));
    const before = await eventsOf(id);
    await expect(
      ctx.unitOfWork.execute(async () => {
        await repo.savePatient(
          recordFor(id, { consent: { taking_part: false, methods: { ring: true, camera: false }, rule_check: true } })
        );
        throw new Error("fail after the save");
      })
    ).rejects.toThrow("fail after the save");
    expect(await eventsOf(id)).toEqual(before);
    expect((await repo.getPatient(id))?.consent.taking_part).toBe(true);
  });
  it("refuses a patient whose clinic is not known with a named error, and creates neither the patient nor a clinic", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("unknown-clinic");
    const saving = repo.savePatient(recordFor(id, { clinicId: "patients-dbtest-no-such-clinic" }));
    await expect(saving).rejects.toBeInstanceOf(UnknownClinicError);
    await expect(saving).rejects.toThrow("Clinic not found");
    expect(await prisma.participant.count({ where: { id } })).toBe(0);
    expect(await prisma.consentEvent.count({ where: { participantId: id } })).toBe(0);
    expect(await prisma.clinic.count({ where: { id: "patients-dbtest-no-such-clinic" } })).toBe(0);
  });

  it("refuses stored questionnaires that are not a list of known questionnaires with a named error", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    for (const [name, json] of [
      ["q-broken", "[\"phq9\""],
      ["q-unknown", "[\"phq9\",\"bdi\"]"],
      ["q-object", "{\"phq9\":true}"],
    ]) {
      const id = newId(name);
      await repo.savePatient(recordFor(id));
      await prisma.participant.update({ where: { id }, data: { questionnairesJson: json } });
      await expect(repo.getPatient(id)).rejects.toBeInstanceOf(StoredDataError);
      await expect(repo.getPatientAccessSwitches(id)).rejects.toBeInstanceOf(StoredDataError);
    }
  });

  it("refuses a stored schedule whose weekdays are not a list of numbers with a named error", async () => {
    const repo = createPatientRepository(createDbContext(prisma));
    const id = newId("broken-days");
    await repo.savePatient(recordFor(id));
    await prisma.participant.update({ where: { id }, data: { scheduleDaysJson: "[1," } });
    await expect(repo.getPatient(id)).rejects.toBeInstanceOf(StoredDataError);
  });
});
