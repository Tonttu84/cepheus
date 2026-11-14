import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { evaluateArduinoEdgePayload } from "@/domain/arduino";
import { mapHealthConnectPayloadToRingDays } from "@/domain/health-connect";
import { getPrisma } from "@/lib/db";
import {
  buildSimulatedFitbitWeek,
  buildSimulatedHealthConnectPayload,
  getMonitoringSummary,
  HOME_DEMO_EXTERNAL_ID,
  saveArduinoEdgeIngest,
  saveWearableDaysAndComputeRhythm,
  updateMethodConsent,
} from "@/server/monitoring";

describe("Monitoring Store PostgreSQL Integration (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = getPrisma();
  });

  afterAll(async () => {
    try {
      await prisma.participant.deleteMany({
        where: { externalId: HOME_DEMO_EXTERNAL_ID },
      });
    } catch {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  it("persists Fitbit-mapped RingDays + RhythmWindow and respects ring_rhythm consent", async () => {
    await updateMethodConsent("ring_rhythm", true, prisma);
    const days = buildSimulatedFitbitWeek("2026-11-14");

    const okRes = await saveWearableDaysAndComputeRhythm(
      days,
      { isSimulated: true, sourceLabel: "simulated_fitbit" },
      prisma
    );
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.savedDays).toBe(7);
      expect(okRes.rhythmComputed).toBe(true);
    }

    await updateMethodConsent("ring_rhythm", false, prisma);
    const blockedRes = await saveWearableDaysAndComputeRhythm(
      days,
      { isSimulated: true, sourceLabel: "simulated_fitbit" },
      prisma
    );
    expect(blockedRes.ok).toBe(false);
    if (!blockedRes.ok) {
      expect(blockedRes.status).toBe(403);
    }

    await updateMethodConsent("ring_rhythm", true, prisma);
  });

  it("persists Arduino derived camera & routine summaries and skips channels whose consent is off", async () => {
    await updateMethodConsent("camera_expressivity", true, prisma);
    await updateMethodConsent("home_routine", false, prisma);

    const evaluated = evaluateArduinoEdgePayload({
      deviceId: "unoq-dbtest",
      date: "2026-11-14",
      hourOfDay: 13,
      isSimulated: true,
      camera: {
        durationSec: 20,
        effectiveFps: 15,
        faceDetectedRatio: 0.9,
        expressivityScore: 0.07,
        angularPathDegPerMin: 110,
      },
      routine: {
        sensorActive: true,
        stationaryMinutes: 190,
        longestBoutMinutes: 100,
        prolongedBoutCount: 2,
        ambientLuxMean: 45,
      },
    });
    expect(evaluated.ok).toBe(true);
    if (!evaluated.ok) return;

    const saved = await saveArduinoEdgeIngest(evaluated.value, prisma);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.savedCamera).toBe(true);
      expect(saved.savedRoutineCount).toBe(0);
      expect(saved.skippedForConsent).toContain("home_routine");
    }

    await updateMethodConsent("home_routine", true, prisma);
  });

  it("enforces decideAccess D8 boundary by redacting raw readings for staff viewers", async () => {
    await updateMethodConsent("ring_rhythm", true, prisma);
    const days = buildSimulatedFitbitWeek("2026-11-14");
    await saveWearableDaysAndComputeRhythm(
      days,
      { isSimulated: true, sourceLabel: "simulated_fitbit" },
      prisma
    );

    const patientView = await getMonitoringSummary("patient", prisma);
    expect(patientView.readingsRedactedForStaff).toBe(false);
    expect(patientView.recentWearableDays.length).toBeGreaterThan(0);

    const staffView = await getMonitoringSummary("staff", prisma);
    expect(staffView.readingsRedactedForStaff).toBe(true);
    expect(staffView.latestRhythmWindow).toBeNull();
    expect(staffView.recentWearableDays).toEqual([]);
    expect(staffView.recentCameraReadings).toEqual([]);
    expect(staffView.recentRoutineReadings).toEqual([]);
  });

  it("persists Health Connect webhook mapped RingDays with HRV into the shared RhythmWindow pipeline", async () => {
    await updateMethodConsent("ring_rhythm", true, prisma);
    const payload = buildSimulatedHealthConnectPayload("2026-11-14");
    const days = mapHealthConnectPayloadToRingDays(payload);
    expect(days).toHaveLength(7);

    const saved = await saveWearableDaysAndComputeRhythm(
      days,
      { isSimulated: true, sourceLabel: "simulated_health_connect" },
      prisma
    );
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.savedDays).toBe(7);
      expect(saved.rhythmComputed).toBe(true);
    }

    const latestDay = await prisma.ringDay.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        source: "simulated_health_connect",
      },
      orderBy: { date: "desc" },
    });
    expect(latestDay).not.toBeNull();
    expect(latestDay?.avgHrvRmssdMs).toBeGreaterThan(0);
  });
});
