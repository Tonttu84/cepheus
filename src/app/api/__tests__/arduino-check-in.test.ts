import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/monitoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/monitoring")>();
  return {
    ...actual,
    saveArduinoBedsideCheckIn: vi.fn(async (input) => {
      const crisis =
        input.kind === "crisis_button" ||
        (input.kind === "phq9_item" && input.itemId === "9" && input.value > 0);
      return {
        ok: true,
        kind: input.kind,
        showCrisisPath: crisis,
        crisisResources: crisis
          ? { emergency: { number: "112" }, crisisLine: { number: "09 2525 0111" } }
          : null,
        roundNumber: 1,
        source: input.isSimulated ? "simulated_uno_q_voice" : "arduino_uno_q_voice",
      };
    }),
  };
});

import { POST as arduinoCheckIn } from "@/app/api/arduino/check-in/route";
import { saveArduinoBedsideCheckIn } from "@/server/monitoring";
import { _resetEnv } from "@/server/env";
import { _resetDeviceReplays } from "@/server/security/device-auth";
import { _resetRateLimits } from "@/server/security/rate-limit";

const processEnv = process.env as Record<string, string | undefined>;
const ENV_KEYS = ["NODE_ENV", "DATABASE_URL", "ARDUINO_INGEST_TOKEN"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, processEnv[k]]));
  processEnv.NODE_ENV = "development";
  processEnv.DATABASE_URL = "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
  processEnv.ARDUINO_INGEST_TOKEN = "unoq-check-in-secret-123";
  _resetEnv();
  _resetRateLimits();
  _resetDeviceReplays();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete processEnv[k];
    else processEnv[k] = saved[k];
  }
  _resetEnv();
});

describe("Arduino Bedside Check-in Route (POST /api/arduino/check-in)", () => {
  it("refuses raw audio fields and invalid payloads", async () => {
    const req = new Request("http://localhost:3000/api/arduino/check-in", {
      method: "POST",
      headers: {
        authorization: "Bearer unoq-check-in-secret-123",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        deviceId: "unoq-1",
        date: "2026-11-14",
        timestampMs: Date.now(),
        nonce: "nonce-12345678",
        kind: "taps",
        mood: 3,
        interest: 3,
        audioBase64: "UklGR...",
      }),
    });
    const res = await arduinoCheckIn(req);
    expect(res.status).toBe(400);
  });

  it("enforces bearer auth and replay protection on non-simulated hardware posts", async () => {
    const now = Date.now();
    const makeReq = () =>
      new Request("http://localhost:3000/api/arduino/check-in", {
        method: "POST",
        headers: {
          authorization: "Bearer unoq-check-in-secret-123",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          deviceId: "unoq-1",
          date: "2026-11-14",
          timestampMs: now,
          nonce: "unique-nonce-abc123",
          kind: "taps",
          mood: 2,
          interest: 3,
        }),
      });

    const first = await arduinoCheckIn(makeReq());
    expect(first.status).toBe(200);

    const replay = await arduinoCheckIn(makeReq());
    expect(replay.status).toBe(409);
  });

  it("immediately returns crisis path on item 9 > 0 or physical crisis button", async () => {
    const now = Date.now();
    const item9Res = await arduinoCheckIn(
      new Request("http://localhost:3000/api/arduino/check-in", {
        method: "POST",
        headers: {
          authorization: "Bearer unoq-check-in-secret-123",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          deviceId: "unoq-1",
          date: "2026-11-14",
          timestampMs: now,
          nonce: "crisis-nonce-11111",
          kind: "phq9_item",
          itemId: "9",
          value: 1,
        }),
      })
    );
    expect(item9Res.status).toBe(200);
    const json = await item9Res.json();
    expect(json.showCrisisPath).toBe(true);
    expect(json.crisisResources.emergency.number).toBe("112");
  });
});

describe("Arduino Bedside Check-in Route when storage fails", () => {
  const postCheckIn = (body: Record<string, unknown>) =>
    arduinoCheckIn(
      new Request("http://localhost:3000/api/arduino/check-in", {
        method: "POST",
        headers: {
          authorization: "Bearer unoq-check-in-secret-123",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          deviceId: "unoq-1",
          date: "2026-11-14",
          timestampMs: Date.now(),
          ...body,
        }),
      })
    );

  it("still returns the crisis path, marked as not saved, for item 9 above 0", async () => {
    vi.mocked(saveArduinoBedsideCheckIn).mockRejectedValueOnce(new Error("db down"));
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
    expect(logged).toContain("phq9_item");
    expect(logged).not.toContain('"value"');
    errorSpy.mockRestore();
  });

  it("returns a plain error without crisis fields for a non-crisis input", async () => {
    vi.mocked(saveArduinoBedsideCheckIn).mockRejectedValueOnce(new Error("db down"));
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
    expect(logged).toContain("taps");
    expect(logged).not.toContain('"mood"');
    errorSpy.mockRestore();
  });
});
