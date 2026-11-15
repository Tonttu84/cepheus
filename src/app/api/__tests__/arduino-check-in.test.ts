import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRISIS_EVENT_ITEM_ID } from "@/domain/crisis";
import { POST as arduinoCheckIn } from "@/app/api/arduino/check-in/route";
import {
  PATIENT_ID,
  patientRecord,
  setUpRoutes,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";
import { _resetEnv } from "@/server/env";
import { _resetDeviceReplays } from "@/server/security/device-auth";

const TOKEN = "unoq-check-in-secret-123";
type Fake = ReturnType<typeof setUpRoutes>;

describe("Arduino Bedside Check-in Route (POST /api/arduino/check-in)", () => {
  let fake: Fake;

  beforeEach(async () => {
    process.env.ARDUINO_INGEST_TOKEN = TOKEN;
    fake = setUpRoutes();
    _resetEnv();
    _resetDeviceReplays();
    await fake.ports.patients.savePatient(patientRecord());
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  function makeRequest(body: Record<string, unknown>, bearer: string | null = TOKEN): Request {
    const headers = new Headers({ "content-type": "application/json" });
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    return new Request("http://localhost:3000/api/arduino/check-in", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("refuses raw audio fields and invalid payloads", async () => {
    const req = makeRequest({
      deviceId: "unoq-1",
      date: "2026-11-16",
      timestampMs: Date.now(),
      nonce: "nonce-12345678",
      kind: "taps",
      mood: 3,
      interest: 3,
      audioBase64: "UklGR...",
    });
    const res = await arduinoCheckIn(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toContain("Refused raw media");
  });

  it("enforces bearer auth and replay protection on non-simulated hardware posts", async () => {
    const now = Date.now();
    const reqFactory = (bearer: string | null = TOKEN, nonce = "unique-nonce-abc123") =>
      makeRequest(
        {
          deviceId: "unoq-1",
          date: "2026-11-16",
          timestampMs: now,
          nonce,
          kind: "taps",
          mood: 2,
          interest: 3,
        },
        bearer
      );

    const noAuth = await arduinoCheckIn(reqFactory(null, "nonce-no-auth-123"));
    expect(noAuth.status).toBe(401);

    const first = await arduinoCheckIn(reqFactory());
    expect(first.status).toBe(200);

    const replay = await arduinoCheckIn(reqFactory());
    expect(replay.status).toBe(409);
  });

  it("submits taps for the bedside device's mapped patient", async () => {
    const now = Date.now();
    const res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "taps-nonce-001",
        kind: "taps",
        mood: 3,
        interest: 2,
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, saved: true, kind: "taps" });

    const rounds = await fake.ports.rounds.getRounds(PATIENT_ID);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ roundNumber: 1, mood: 3, interest: 2, status: "answered" });
  });

  it("submits Not today without penalty for the mapped patient", async () => {
    const now = Date.now();
    const res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "not-today-nonce-001",
        kind: "not_today",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, saved: true, kind: "not_today" });

    const rounds = await fake.ports.rounds.getRounds(PATIENT_ID);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ roundNumber: 1, status: "not_today", mood: null, interest: null });
  });

  it("submits PHQ-9 items and immediately returns crisis path on item 9 > 0", async () => {
    const now = Date.now();
    await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "phq9-prereq-taps-nonce",
        kind: "taps",
        mood: 2,
        interest: 2,
      })
    );

    const item1Res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "phq9-item-1-nonce",
        kind: "phq9_item",
        itemId: "1",
        value: 2,
      })
    );
    expect(item1Res.status).toBe(200);
    const item1Json = await item1Res.json();
    expect(item1Json).toMatchObject({ ok: true, saved: true, kind: "phq9_item", progress: "unfinished" });
    expect(item1Json.showCrisisPath).toBe(false);

    const item9Res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "phq9-item-9-nonce",
        kind: "phq9_item",
        itemId: "9",
        value: 1,
      })
    );
    expect(item9Res.status).toBe(200);
    const item9Json = await item9Res.json();
    expect(item9Json.showCrisisPath).toBe(true);
    expect(item9Json.crisisResources).toBeDefined();

    const crisisEvents = await fake.ports.crisis.getCrisisEvents(PATIENT_ID);
    expect(crisisEvents).toHaveLength(1);
    expect(crisisEvents[0].itemId).toBe(CRISIS_EVENT_ITEM_ID.PHQ9_ITEM_9);
    expect(crisisEvents[0].value).toBe(1);
  });

  it("records a crisis event and returns crisis path on physical crisis button", async () => {
    const now = Date.now();
    const res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "crisis-btn-001",
        kind: "crisis_button",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.showCrisisPath).toBe(true);
    expect(json.crisisResources).toBeDefined();

    const crisisEvents = await fake.ports.crisis.getCrisisEvents(PATIENT_ID);
    expect(crisisEvents).toHaveLength(1);
    expect(crisisEvents[0].itemId).toBe(CRISIS_EVENT_ITEM_ID.ASKED_FOR_HELP);
  });

  it("records crisis event and returns crisis path when physical crisis button is pressed with consent paused", async () => {
    await fake.ports.patients.savePatient(
      patientRecord({ consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false } })
    );

    const now = Date.now();
    const res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "crisis-btn-paused-consent",
        kind: "crisis_button",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.showCrisisPath).toBe(true);
    expect(json.crisisResources).toBeDefined();

    const crisisEvents = await fake.ports.crisis.getCrisisEvents(PATIENT_ID);
    expect(crisisEvents).toHaveLength(1);
    expect(crisisEvents[0].itemId).toBe(CRISIS_EVENT_ITEM_ID.ASKED_FOR_HELP);
  });

  it("refuses taps when consent is paused, but still shows crisis path on item 9 > 0", async () => {
    await fake.ports.patients.savePatient(
      patientRecord({ consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false } })
    );

    const now = Date.now();
    const tapsRes = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "taps-paused-consent",
        kind: "taps",
        mood: 3,
        interest: 3,
      })
    );
    expect(tapsRes.status).toBe(403);
    const tapsJson = await tapsRes.json();
    expect(tapsJson.ok).toBe(false);
    expect(tapsJson.error).toBe("consent_required");
    expect(tapsJson.showCrisisPath).toBeUndefined();

    const phq9Res = await arduinoCheckIn(
      makeRequest({
        deviceId: "unoq-1",
        date: "2026-11-16",
        timestampMs: now,
        nonce: "phq9-paused-consent",
        kind: "phq9_item",
        itemId: "9",
        value: 2,
      })
    );
    expect(phq9Res.status).toBe(403);
    const phq9Json = await phq9Res.json();
    expect(phq9Json.ok).toBe(false);
    expect(phq9Json.error).toBe("consent_required");
    expect(phq9Json.showCrisisPath).toBe(true);
    expect(phq9Json.crisisResources).toBeDefined();
  });
});

describe("Arduino Bedside Check-in Route when storage fails", () => {
  let fake: Fake;

  beforeEach(async () => {
    process.env.ARDUINO_INGEST_TOKEN = TOKEN;
    fake = setUpRoutes();
    _resetEnv();
    _resetDeviceReplays();
    await fake.ports.patients.savePatient(patientRecord());
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  const postCheckIn = (body: Record<string, unknown>) => {
    const headers = new Headers({
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    });
    return arduinoCheckIn(
      new Request("http://localhost:3000/api/arduino/check-in", {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId: "unoq-1",
          date: "2026-11-16",
          timestampMs: Date.now(),
          ...body,
        }),
      })
    );
  };

  it("still returns the crisis path, marked as not saved, for item 9 above 0", async () => {
    fake.ports.unitOfWork.execute = vi.fn().mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postCheckIn({
      nonce: "storage-fail-crisis-1",
      kind: "phq9_item",
      itemId: "9",
      value: 2,
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.saved).toBe(false);
    expect(json.showCrisisPath).toBe(true);
    expect(json.crisisResources.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("db down");
    expect(logged).toContain("arduino:check-in");
    expect(logged).not.toContain('"value"');
    errorSpy.mockRestore();
  });

  it("returns a plain error without crisis fields for a non-crisis input", async () => {
    fake.ports.unitOfWork.execute = vi.fn().mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postCheckIn({
      nonce: "storage-fail-taps-1",
      kind: "taps",
      mood: 3,
      interest: 1,
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.saved).toBe(false);
    expect(json.showCrisisPath).toBeUndefined();
    expect(json.crisisResources).toBeUndefined();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("db down");
    expect(logged).not.toContain('"mood"');
    errorSpy.mockRestore();
  });
});
