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
  saveArduinoBedsideCheckIn,
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

  it("persists UNO Q bedside voice taps, not_today without zeroing, and crisis_button flags", async () => {
    const tapRes = await saveArduinoBedsideCheckIn(
      {
        deviceId: "unoq-dbtest",
        date: "2026-11-14",
        isSimulated: true,
        kind: "taps",
        mood: 3,
        interest: 4,
      },
      prisma
    );
    expect(tapRes.ok).toBe(true);
    if (tapRes.ok) expect(tapRes.showCrisisPath).toBe(false);

    const notTodayRes = await saveArduinoBedsideCheckIn(
      {
        deviceId: "unoq-dbtest",
        date: "2026-11-15",
        isSimulated: true,
        kind: "not_today",
      },
      prisma
    );
    expect(notTodayRes.ok).toBe(true);
    const skippedRound = await prisma.checkInRound.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        date: "2026-11-15",
      },
    });
    expect(skippedRound?.status).toBe("not_today");
    expect(skippedRound?.moodScore).toBeNull();

    const phq9ItemRes = await saveArduinoBedsideCheckIn(
      {
        deviceId: "unoq-dbtest",
        date: "2026-11-15",
        isSimulated: true,
        kind: "phq9_item",
        itemId: "9",
        value: 2,
      },
      prisma
    );
    expect(phq9ItemRes.ok).toBe(true);
    if (phq9ItemRes.ok) {
      expect(phq9ItemRes.showCrisisPath).toBe(true);
      expect(phq9ItemRes.roundNumber).not.toBeNull();
    }
    const savedPhq9 = await prisma.phq9Assessment.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        date: "2026-11-15",
      },
    });
    expect(savedPhq9?.status).toBe("in_progress");
    expect(savedPhq9?.item9SelfHarm).toBe(2);

    const savedCrisis = await prisma.crisisEvent.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        roundNumber: savedPhq9?.roundNumber,
      },
    });
    expect(savedCrisis?.itemId).toBe("item9SelfHarm");
    expect(savedCrisis?.value).toBe(2);

    const crisisRes = await saveArduinoBedsideCheckIn(
      {
        deviceId: "unoq-dbtest",
        date: "2026-11-15",
        isSimulated: true,
        kind: "crisis_button",
      },
      prisma
    );
    expect(crisisRes.ok).toBe(true);
    if (crisisRes.ok) {
      expect(crisisRes.showCrisisPath).toBe(true);
    }
    // Point C: existing crisisEvent in the same round is preserved unchanged
    const preservedCrisis = await prisma.crisisEvent.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        roundNumber: savedPhq9?.roundNumber,
      },
    });
    expect(preservedCrisis?.itemId).toBe("item9SelfHarm");
    expect(preservedCrisis?.value).toBe(2);

    // When check_in consent is paused in DB, decideAccess refuses storing taps
    await updateMethodConsent("check_in", false, prisma);
    const blockedRes = await saveArduinoBedsideCheckIn(
      {
        deviceId: "unoq-dbtest",
        date: "2026-11-16",
        isSimulated: true,
        kind: "taps",
        mood: 2,
        interest: 2,
      },
      prisma
    );
    expect(blockedRes.ok).toBe(false);
    if (!blockedRes.ok) {
      expect(blockedRes.status).toBe(403);
    }
    const refusedRow = await prisma.checkInRound.findFirst({
      where: {
        participant: { externalId: HOME_DEMO_EXTERNAL_ID },
        date: "2026-11-16",
      },
    });
    expect(refusedRow).toBeNull();

    await updateMethodConsent("check_in", true, prisma);
  });
});
