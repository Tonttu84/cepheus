import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { POST as healthConnectWebhook } from "@/app/api/webhooks/health-connect/route";
import { evaluateArduinoEdgePayload } from "@/domain/arduino";
import { POST as arduinoCheckIn } from "@/app/api/arduino/check-in/route";
import { mapHealthConnectPayloadToRingDays } from "@/domain/health-connect";
import type { PatientAuthSession } from "@/lib/auth-types";
import { getPrisma } from "@/lib/db";
import { PHQ9_COLUMNS } from "@/server/db/phq9-columns";
import { resetRouteDeps } from "@/server/api";
import { _resetEnv } from "@/server/env";
import { _resetRateLimits } from "@/server/security";
import {
  buildSimulatedFitbitWeek,
  buildSimulatedHealthConnectPayload,
  getHealthConnectPairingStatus,
  getMonitoringSummary,
  HOME_DEMO_EXTERNAL_ID,
  provisionOrRotateHealthConnectPairing,
  revokeHealthConnectPairing,
  saveArduinoEdgeIngest,
  saveWearableDaysAndComputeRhythm,
  updateMethodConsent,
} from "@/server/monitoring";

const BEDSIDE_TOKEN = "unoq-dbtest-token";
const ROUND_1_OPEN = new Date("2026-11-16T16:05:00.000Z");

function makeBedsideRequest(body: Record<string, unknown>, bearer: string | null = BEDSIDE_TOKEN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request("http://localhost:3000/api/arduino/check-in", {
    method: "POST",
    headers,
    body: JSON.stringify({
      deviceId: "unoq-dbtest",
      date: "2026-11-16",
      timestampMs: Date.now(),
      nonce: `nonce-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      ...body,
    }),
  });
}

describe("Monitoring Store PostgreSQL Integration (*.dbtest.ts)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ROUND_1_OPEN);
    process.env.ARDUINO_INGEST_TOKEN = BEDSIDE_TOKEN;
    delete process.env.STORE_ITEM_ANSWERS;
    _resetEnv();
    _resetRateLimits();
    resetRouteDeps();
    prisma = getPrisma();
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.ARDUINO_INGEST_TOKEN;
    _resetEnv();
    _resetRateLimits();
    resetRouteDeps();
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

  it("defaults passive consents on ensureHomeDemoParticipant to false and blocks ingest until opted in", async () => {
    const initial = await getMonitoringSummary("patient", prisma);
    expect(initial.consents.map((c) => [c.method, c.enabled])).toEqual([
      ["ring_rhythm", false],
      ["camera_expressivity", false],
      ["home_routine", false],
    ]);
    expect(initial.deviceConnections).toEqual({
      ring_rhythm: { connected: false, label: "No device connected" },
      camera_expressivity: { connected: false, label: "No device connected" },
      home_routine: { connected: false, label: "No device connected" },
    });

    const days = buildSimulatedFitbitWeek("2026-11-14");
    const blockedWearable = await saveWearableDaysAndComputeRhythm(
      days,
      { isSimulated: true, sourceLabel: "simulated_fitbit" },
      prisma
    );
    expect(blockedWearable).toMatchObject({ ok: false, status: 403 });

    const evaluated = evaluateArduinoEdgePayload({
      deviceId: "unoq-default-off",
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
    });
    expect(evaluated.ok).toBe(true);
    if (!evaluated.ok) return;

    const blockedArduino = await saveArduinoEdgeIngest(evaluated.value, prisma);
    expect(blockedArduino).toMatchObject({ ok: false, status: 403 });
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

  it("persists Health Connect-mapped RingDays + RhythmWindow with derived sleep metrics", async () => {
    const payload = buildSimulatedHealthConnectPayload("2026-11-14");
    const days = mapHealthConnectPayloadToRingDays(payload);

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
    const tapRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 3,
        interest: 4,
      })
    );
    expect(tapRes.status).toBe(200);
    const tapJson = await tapRes.json();
    expect(tapJson.ok).toBe(true);
    expect(tapJson.saved).toBe(true);

    const savedRound = await prisma.checkInRound.findFirst({
      where: { participant: { externalId: HOME_DEMO_EXTERNAL_ID } },
    });
    expect(savedRound?.moodScore).toBe(3);
    expect(savedRound?.interestScore).toBe(4);

    const phq9ItemRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "phq9_item",
        itemId: "9",
        value: 2,
      })
    );
    expect(phq9ItemRes.status).toBe(200);
    const phq9Json = await phq9ItemRes.json();
    expect(phq9Json.ok).toBe(true);
    expect(phq9Json.showCrisisPath).toBe(true);

    const savedCrisis = await prisma.crisisEvent.findFirst({
      where: { participant: { externalId: HOME_DEMO_EXTERNAL_ID } },
    });
    expect(savedCrisis?.value).toBe(2);

    const crisisRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "crisis_button",
      })
    );
    expect(crisisRes.status).toBe(200);
    const crisisJson = await crisisRes.json();
    expect(crisisJson.showCrisisPath).toBe(true);

    // When check_in consent is paused in DB, decideAccess refuses storing taps
    await updateMethodConsent("check_in", false, prisma);
    const blockedRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 2,
        interest: 2,
      })
    );
    expect(blockedRes.status).toBe(403);
    const blockedJson = await blockedRes.json();
    expect(blockedJson.ok).toBe(false);
    expect(blockedJson.error).toBe("consent_required");

    // Physical crisis button with consent paused still records and returns crisis path
    const crisisPausedRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "crisis_button",
      })
    );
    expect(crisisPausedRes.status).toBe(200);
    const crisisPausedJson = await crisisPausedRes.json();
    expect(crisisPausedJson.showCrisisPath).toBe(true);

    // Self-harm item with consent paused is refused (403), but still returns crisis path
    const phq9PausedRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "phq9_item",
        itemId: "9",
        value: 2,
      })
    );
    expect(phq9PausedRes.status).toBe(403);
    const phq9PausedJson = await phq9PausedRes.json();
    expect(phq9PausedJson.showCrisisPath).toBe(true);
    expect(phq9PausedJson.crisisResources.length).toBeGreaterThan(0);

    await updateMethodConsent("check_in", true, prisma);
  });

  it("keeps a completed bedside round when Not today follows taps on the same date", async () => {
    await prisma.checkInRound.deleteMany({
      where: { participant: { externalId: HOME_DEMO_EXTERNAL_ID } },
    });

    const tapRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 1,
        interest: 2,
      })
    );
    expect(tapRes.status).toBe(200);

    const notTodayRes = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "not_today",
      })
    );
    expect(notTodayRes.status).toBe(200);

    const rounds = await prisma.checkInRound.findMany({
      where: { participant: { externalId: HOME_DEMO_EXTERNAL_ID } },
    });
    expect(rounds.length).toBeGreaterThan(0);
    const current = rounds[0];
    expect(current?.moodScore).toBe(1);
    expect(current?.interestScore).toBe(2);
    // The shared use cases store an answered round as "completed", the word the
    // schema documents; the old bedside storage wrote "answered" directly.
    expect(current?.status).toBe("completed");
  });

  it("completes a bedside PHQ-9 with a total only once all nine items are answered", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });

    await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 2,
        interest: 2,
      })
    );

    const say = (itemId: string, value: number) =>
      arduinoCheckIn(
        makeBedsideRequest({
          kind: "phq9_item",
          itemId,
          value,
        })
      );

    const first = await say("1", 2);
    expect(first.status).toBe(200);
    const partial = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.status).toBe("in_progress");
    expect(partial[0]?.totalScore).toBeNull();
    expect(partial[0]?.completedAt).toBeNull();

    for (const id of ["2", "3", "4", "5", "6", "7", "8"]) {
      const res = await say(id, 1);
      expect(res.status).toBe(200);
    }
    const eightAnswered = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(eightAnswered).toHaveLength(1);
    expect(eightAnswered[0]?.status).toBe("in_progress");
    expect(eightAnswered[0]?.totalScore).toBeNull();
    expect(eightAnswered[0]?.completedAt).toBeNull();

    const last = await say("9", 0);
    expect(last.status).toBe(200);
    const done = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(done).toHaveLength(1);
    expect(done[0]?.status).toBe("completed");
    expect(done[0]?.totalScore).toBe(9);
    expect(done[0]?.completedAt).not.toBeNull();
  });

  it("keeps bedside PHQ-9 item answers in memory only when item answers are off (D45)", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });

    await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 1,
        interest: 1,
      })
    );

    const say = (itemId: string, value: number) =>
      arduinoCheckIn(
        makeBedsideRequest({
          kind: "phq9_item",
          itemId,
          value,
        })
      );

    for (const id of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const res = await say(id, 1);
      expect(res.status).toBe(200);
    }
    const partial = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.status).toBe("in_progress");
    expect(partial[0]?.totalScore).toBeNull();
    expect(PHQ9_COLUMNS.map((col) => partial[0]?.[col])).toEqual(Array(9).fill(null));

    const last = await say("9", 0);
    expect(last.status).toBe(200);
    const done = await prisma.phq9Assessment.findMany({ where: participantFilter });
    expect(done).toHaveLength(1);
    expect(done[0]?.status).toBe("completed");
    expect(done[0]?.totalScore).toBe(8);
    expect(done[0]?.completedAt).not.toBeNull();
    expect(PHQ9_COLUMNS.map((col) => done[0]?.[col])).toEqual(Array(9).fill(null));
  });

  it("still records the crisis event of a bedside self-harm answer when item answers are off", async () => {
    const participantFilter = { participant: { externalId: HOME_DEMO_EXTERNAL_ID } };
    await prisma.phq9Assessment.deleteMany({ where: participantFilter });
    await prisma.crisisEvent.deleteMany({ where: participantFilter });

    await arduinoCheckIn(
      makeBedsideRequest({
        kind: "taps",
        mood: 1,
        interest: 1,
      })
    );

    const res = await arduinoCheckIn(
      makeBedsideRequest({
        kind: "phq9_item",
        itemId: "9",
        value: 2,
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.showCrisisPath).toBe(true);

    const row = await prisma.phq9Assessment.findFirstOrThrow({ where: participantFilter });
    expect(row.status).toBe("in_progress");
    expect(row.item9SelfHarm).toBeNull();
    const crisis = await prisma.crisisEvent.findFirstOrThrow({
      where: { ...participantFilter, roundNumber: row.roundNumber },
    });
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

    // Fresh unseeded patient starts with passive ring_rhythm paused and no device connected
    const initialSummaryB = await getMonitoringSummary(sessionB, prisma);
    expect(initialSummaryB.consents.find((c) => c.method === "ring_rhythm")?.enabled).toBe(false);
    expect(initialSummaryB.consents.find((c) => c.method === "camera_expressivity")?.enabled).toBe(false);
    expect(initialSummaryB.consents.find((c) => c.method === "home_routine")?.enabled).toBe(false);
    expect(initialSummaryB.deviceConnections.ring_rhythm).toEqual({
      connected: false,
      label: "No device connected",
    });

    // Pairing is refused (403) while ring_rhythm consent is paused
    const pausedPairB = await provisionOrRotateHealthConnectPairing(origin, prisma, sessionB);
    expect(pausedPairB.ok).toBe(false);
    if (!pausedPairB.ok) {
      expect(pausedPairB.status).toBe(403);
    }

    await updateMethodConsent("ring_rhythm", true, prisma, sessionA);
    await updateMethodConsent("ring_rhythm", true, prisma, sessionB);

    const pairA = await provisionOrRotateHealthConnectPairing(origin, prisma, sessionA);
    const pairB = await provisionOrRotateHealthConnectPairing(origin, prisma, sessionB);
    expect(pairA.ok).toBe(true);
    expect(pairB.ok).toBe(true);
    if (!pairA.ok || !pairB.ok) return;

    expect(pairA.pairing.tokenId).not.toBe(pairB.pairing.tokenId);

    const pairedSummaryB = await getMonitoringSummary(sessionB, prisma);
    expect(pairedSummaryB.deviceConnections.ring_rhythm).toEqual({
      connected: true,
      label: "Phone paired",
    });

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
    // Simulated/unpaired channels still report No device connected
    expect(summaryA.deviceConnections.camera_expressivity).toEqual({
      connected: false,
      label: "No device connected",
    });

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

