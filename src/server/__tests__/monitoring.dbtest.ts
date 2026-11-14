import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { POST as healthConnectWebhook } from "@/app/api/webhooks/health-connect/route";
import { evaluateArduinoEdgePayload } from "@/domain/arduino";
import { mapHealthConnectPayloadToRingDays } from "@/domain/health-connect";
import type { PatientAuthSession } from "@/lib/auth-types";
import { getPrisma } from "@/lib/db";
import { InMemoryAnswerStore } from "@/server/db/answer-store";
import { PHQ9_COLUMNS } from "@/server/db/phq9-columns";
import {
  buildSimulatedFitbitWeek,
  buildSimulatedHealthConnectPayload,
  getHealthConnectPairingStatus,
  getMonitoringSummary,
  HOME_DEMO_EXTERNAL_ID,
  provisionOrRotateHealthConnectPairing,
  revokeHealthConnectPairing,
  saveArduinoBedsideCheckIn,
  saveArduinoEdgeIngest,
  saveWearableDaysAndComputeRhythm,
  updateMethodConsent,
} from "@/server/monitoring";
import { _resetRateLimits } from "@/server/security/rate-limit";

describe("Monitoring Store PostgreSQL Integration (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = getPrisma();
  });

  afterAll(async () => {
    try {
      const participants = await prisma.participant.findMany({
        where: {
          OR: [
            { externalId: { in: [HOME_DEMO_EXTERNAL_ID, "sim-sample-anxiety-01"] } },
            { participantCode: { in: ["P-SIM-001", "P-SIM-ANX-01"] } },
          ],
        },
        select: { id: true },
      });
      const ids = participants.map((p) => p.id);
      if (ids.length > 0) {
        await prisma.webhookCredential.deleteMany({
          where: { participantId: { in: ids } },
        });
      }
      await prisma.participant.deleteMany({
        where: {
          OR: [
            { externalId: { in: [HOME_DEMO_EXTERNAL_ID, "sim-sample-anxiety-01"] } },
            { participantCode: "P-SIM-ANX-01" },
          ],
        },
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
      prisma,
      { storeItemAnswers: true }
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
  it("keeps a completed bedside round when Not today follows taps on the same date", async () => {
    const date = "2026-11-20";
    const tapRes = await saveArduinoBedsideCheckIn(
      { deviceId: "unoq-dbtest", date, isSimulated: true, kind: "taps", mood: 1, interest: 2 },
      prisma
    );
    expect(tapRes.ok).toBe(true);

    const notTodayRes = await saveArduinoBedsideCheckIn(
      { deviceId: "unoq-dbtest", date, isSimulated: true, kind: "not_today" },
      prisma
    );
    expect(notTodayRes.ok).toBe(true);

    const rounds = await prisma.checkInRound.findMany({
      where: { participant: { externalId: HOME_DEMO_EXTERNAL_ID }, date },
    });
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.status).toBe("completed");
    expect(rounds[0]?.moodScore).toBe(1);
    expect(rounds[0]?.interestScore).toBe(2);
    expect(rounds[0]?.respondedAt).not.toBeNull();
  });

  it("completes a bedside PHQ-9 with a total only once all nine items are answered", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    // Start without the in-progress PHQ-9 left by the earlier bedside test.
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });
    const say = (itemId: string, value: number) =>
      saveArduinoBedsideCheckIn(
        { deviceId: "unoq-dbtest", date: "2026-11-21", isSimulated: true, kind: "phq9_item", itemId, value },
        prisma,
        { storeItemAnswers: true }
      );

    expect((await say("1", 2)).ok).toBe(true);
    const partial = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.status).toBe("in_progress");
    expect(partial[0]?.item1Interest).toBe(2);
    expect(partial[0]?.totalScore).toBeNull();
    expect(partial[0]?.completedAt).toBeNull();
    for (const col of [
      "item2Mood", "item3Sleep", "item4Energy", "item5Appetite",
      "item6SelfWorth", "item7Concentration", "item8Psychomotor", "item9SelfHarm",
    ] as const) {
      expect(partial[0]?.[col]).toBeNull();
    }

    for (const id of ["2", "3", "4", "5", "6", "7", "8"]) {
      expect((await say(id, 1)).ok).toBe(true);
    }
    const eightAnswered = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(eightAnswered).toHaveLength(1);
    expect(eightAnswered[0]?.status).toBe("in_progress");
    expect(eightAnswered[0]?.totalScore).toBeNull();
    expect(eightAnswered[0]?.completedAt).toBeNull();

    expect((await say("9", 0)).ok).toBe(true);
    const done = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(done).toHaveLength(1);
    expect(done[0]?.status).toBe("completed");
    expect(done[0]?.totalScore).toBe(9);
    expect(done[0]?.completedAt).not.toBeNull();
  });

  it("keeps bedside PHQ-9 item answers in memory only when item answers are off", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });
    const memory = new InMemoryAnswerStore();
    const say = (itemId: string, value: number) =>
      saveArduinoBedsideCheckIn(
        { deviceId: "unoq-dbtest", date: "2026-11-22", isSimulated: true, kind: "phq9_item", itemId, value },
        prisma,
        { storeItemAnswers: false, answerStore: memory }
      );

    for (const id of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      expect((await say(id, 1)).ok).toBe(true);
    }
    const partial = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.status).toBe("in_progress");
    expect(partial[0]?.totalScore).toBeNull();
    expect(PHQ9_COLUMNS.map((col) => partial[0]?.[col])).toEqual(Array(9).fill(null));
    const roundNumber = partial[0]!.roundNumber;
    expect(memory.get(partial[0]!.participantId, "phq9", roundNumber)).toHaveLength(8);

    expect((await say("9", 0)).ok).toBe(true);
    const done = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(done).toHaveLength(1);
    expect(done[0]?.status).toBe("completed");
    expect(done[0]?.totalScore).toBe(8);
    expect(done[0]?.completedAt).not.toBeNull();
    expect(PHQ9_COLUMNS.map((col) => done[0]?.[col])).toEqual(Array(9).fill(null));
    expect(memory.size()).toBe(0);
  });

  it("still records the crisis event of a bedside self-harm answer when item answers are off", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });
    await prisma.crisisEvent.deleteMany({ where: participantFilter });
    const memory = new InMemoryAnswerStore();

    const res = await saveArduinoBedsideCheckIn(
      { deviceId: "unoq-dbtest", date: "2026-11-23", isSimulated: true, kind: "phq9_item", itemId: "9", value: 2 },
      prisma,
      { storeItemAnswers: false, answerStore: memory }
    );

    expect(res.ok && res.showCrisisPath).toBe(true);
    const row = await prisma.phq9Assessment.findFirstOrThrow({ where: participantFilter });
    expect(row.status).toBe("in_progress");
    expect(row.item9SelfHarm).toBeNull();
    expect(memory.get(row.participantId, "phq9", row.roundNumber)).toEqual([{ id: "9", value: 2 }]);
    const crisis = await prisma.crisisEvent.findFirstOrThrow({ where: { ...participantFilter, roundNumber: row.roundNumber } });
    expect(crisis.value).toBe(2);
  });

  it("leaves a completed bedside PHQ-9 as it is when a later item arrives for its round and item answers are off", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });
    const memory = new InMemoryAnswerStore();
    const say = (itemId: string, value: number) =>
      saveArduinoBedsideCheckIn(
        { deviceId: "unoq-dbtest", date: "2026-11-24", isSimulated: true, kind: "phq9_item", itemId, value },
        prisma,
        { storeItemAnswers: false, answerStore: memory }
      );
    for (const id of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) await say(id, 1);
    const before = await prisma.phq9Assessment.findFirstOrThrow({ where: participantFilter });
    expect(before.status).toBe("completed");

    expect((await say("1", 3)).ok).toBe(true);

    const after = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ status: "completed", totalScore: 9, completedAt: before.completedAt });
    expect(memory.size()).toBe(0);
  });

  it("provisions Health Connect pairing, tracks test ping, deduplicates sequence, and revokes cleanly", async () => {
    _resetRateLimits();
    await updateMethodConsent("ring_rhythm", true, prisma);
    const origin = "http://localhost:3000";

    const provisioned = await provisionOrRotateHealthConnectPairing(origin, prisma);
    expect(provisioned.ok).toBe(true);
    if (!provisioned.ok) return;

    const { pairing } = provisioned;
    expect(pairing.lifeDashboardUri.startsWith("lifedashboard://")).toBe(true);
    expect(pairing.qrMatrix.length).toBeGreaterThan(0);

    const sign = (raw: string) =>
      crypto.createHmac("sha256", pairing.secret).update(raw).digest("hex");

    const pingBody = JSON.stringify({ test: true });
    const pingRes = await healthConnectWebhook(
      new Request(pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": sign(pingBody),
        },
        body: pingBody,
      })
    );
    expect(pingRes.status).toBe(204);

    const afterPing = await getHealthConnectPairingStatus(origin, prisma);
    expect(afterPing.paired).toBe(true);
    expect(afterPing.lastTestPingAt).not.toBeNull();

    const payloadBody = JSON.stringify({
      sequence: 42,
      daily_totals: [{ date: "2026-11-14", steps: 5500 }],
    });
    const firstRes = await healthConnectWebhook(
      new Request(pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": sign(payloadBody),
        },
        body: payloadBody,
      })
    );
    expect(firstRes.status).toBe(200);
    expect((await firstRes.json()).savedDays).toBe(1);

    const dupRes = await healthConnectWebhook(
      new Request(pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": sign(payloadBody),
        },
        body: payloadBody,
      })
    );
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    expect(dupJson.duplicateSequence).toBe(true);
    expect(dupJson.savedDays).toBe(0);

    const revokedStatus = await revokeHealthConnectPairing(origin, prisma);
    expect(revokedStatus.paired).toBe(false);

    const afterRevokeRes = await healthConnectWebhook(
      new Request(pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": sign(payloadBody),
        },
        body: payloadBody,
      })
    );
    expect(afterRevokeRes.status).toBe(401);

    const unknownRes = await healthConnectWebhook(
      new Request(`${origin}/api/webhooks/health-connect?token=nonexistent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": sign(payloadBody),
        },
        body: payloadBody,
      })
    );
    expect(unknownRes.status).toBe(401);
  });

  it("isolates monitoring consents, Health Connect pairing, and webhook RingDays per authenticated patient session", async () => {
    _resetRateLimits();
    const origin = "http://localhost:3000";

    const sessionA: PatientAuthSession = {
      kind: "patient",
      actor: { kind: "patient", patientId: "p-sim-001", clinicId: "c-1" },
      participantCode: "P-SIM-001",
      label: "Patient A",
      avatarInitials: "PA",
      authMethod: "simulated_finnish_eid",
      isSimulated: true,
      signedInAt: "2026-11-14T20:00:00.000Z",
    };

    const sessionB: PatientAuthSession = {
      kind: "patient",
      actor: { kind: "patient", patientId: "p-sim-anx-01", clinicId: "c-1" },
      participantCode: "P-SIM-ANX-01",
      label: "Patient B",
      avatarInitials: "PB",
      authMethod: "simulated_finnish_eid",
      isSimulated: true,
      signedInAt: "2026-11-14T20:00:00.000Z",
    };

    const pairA = await provisionOrRotateHealthConnectPairing(origin, prisma, sessionA);
    const pairB = await provisionOrRotateHealthConnectPairing(origin, prisma, sessionB);
    expect(pairA.ok).toBe(true);
    expect(pairB.ok).toBe(true);
    if (!pairA.ok || !pairB.ok) return;

    expect(pairA.pairing.tokenId).not.toBe(pairB.pairing.tokenId);

    const payloadBody = JSON.stringify({
      sequence: 1,
      source: "health_connect",
      daily_totals: [{ date: "2026-11-14", steps: 8123 }],
    });

    const hookBRes = await healthConnectWebhook(
      new Request(pairB.pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": pairB.pairing.secret,
        },
        body: payloadBody,
      })
    );
    expect(hookBRes.status).toBe(200);

    const summaryB = await getMonitoringSummary(sessionB, prisma);
    const summaryA = await getMonitoringSummary(sessionA, prisma);
    expect(summaryB.recentWearableDays.some((d) => d.steps === 8123)).toBe(true);
    expect(summaryA.recentWearableDays.some((d) => d.steps === 8123)).toBe(false);

    await updateMethodConsent("ring_rhythm", false, prisma, sessionB);

    const participantB = await prisma.participant.findUnique({
      where: { participantCode: "P-SIM-ANX-01" },
      select: { id: true },
    });
    expect(participantB).toBeTruthy();
    if (participantB) {
      const consentEvents = await prisma.consentEvent.findMany({
        where: {
          participantId: participantB.id,
          layer: "method",
          method: "ring_rhythm",
        },
      });
      expect(consentEvents.length).toBeGreaterThan(0);
    }

    const blockedBRes = await healthConnectWebhook(
      new Request(pairB.pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": pairB.pairing.secret,
        },
        body: JSON.stringify({
          sequence: 2,
          source: "health_connect",
          daily_totals: [{ date: "2026-11-15", steps: 4000 }],
        }),
      })
    );
    expect(blockedBRes.status).toBe(403);

    const allowedARes = await healthConnectWebhook(
      new Request(pairA.pairing.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": pairA.pairing.secret,
        },
        body: JSON.stringify({
          sequence: 1,
          source: "health_connect",
          daily_totals: [{ date: "2026-11-15", steps: 5000 }],
        }),
      })
    );
    expect(allowedARes.status).toBe(200);
  });
});
