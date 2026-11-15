import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { submitCameraReading } from "@/usecases";
import { createPrismaPorts } from "../index";

describe("CameraReading repository (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;

  beforeAll(async () => {
    prisma = getPrisma();
    clinicId = (
      await prisma.clinic.create({
        data: { code: "camera-dbtest-clinic", name: "Camera DB Test" },
      })
    ).id;
    patientId = (
      await prisma.participant.create({
        data: {
          clinicId,
          label: "camera-dbtest-patient",
          source: "live",
          isSimulated: false,
          takingPart: true,
          ruleCheckConsent: true,
          enrolmentDate: "2026-11-01",
          scheduleDaysJson: JSON.stringify([1, 4]),
          scheduleTime: "10:00",
          timeZone: "Europe/Helsinki",
          consents: {
            create: [
              {
                clinicId,
                method: "camera_expressivity",
                enabled: true,
                broadArea: "face_movement",
                recordedDescription: "Derived facial and head movement summary",
              },
            ],
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.cameraReading.deleteMany({ where: { clinicId } });
    await prisma.measurementConsent.deleteMany({ where: { clinicId } });
    await prisma.participant.deleteMany({ where: { clinicId } });
    await prisma.clinic.deleteMany({ where: { id: clinicId } });
  });

  it("persists and reads back derived camera summary numbers via createPrismaPorts", async () => {
    const ports = createPrismaPorts(prisma);
    const actor = { kind: "patient" as const, patientId, clinicId };

    const res = await submitCameraReading(
      actor,
      {
        patientId,
        durationSec: 20,
        effectiveFps: 10,
        faceDetectedRatio: 0.94,
        expressivityScore: 0.16,
        angularPathDegPerMin: 195,
      },
      ports
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await ports.cameraReadings!.getCameraReadings(patientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: res.value.readingId,
      patientId,
      durationSec: 20,
      effectiveFps: 10,
      faceDetectedRatio: 0.94,
      expressivityScore: 0.16,
      angularPathDegPerMin: 195,
      isSimulated: false,
      source: "live",
    });
  });
});
