import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/monitoring", () => ({
  saveWearableDaysAndComputeRhythm: vi.fn(async () => ({
    ok: true,
    savedDays: 1,
    rhythmComputed: false,
  })),
  saveArduinoEdgeIngest: vi.fn(async () => ({
    ok: true,
    savedCamera: true,
    savedRoutineCount: 0,
    skippedForConsent: [],
  })),
}));

import { POST as arduinoIngest } from "@/app/api/arduino/ingest/route";
import { POST as healthConnectWebhook } from "@/app/api/webhooks/health-connect/route";
import { _resetEnv } from "@/server/env";
import { _resetDeviceReplays } from "@/server/security";
import { _resetRateLimits } from "@/server/security/rate-limit";

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "HEALTH_CONNECT_WEBHOOK_SECRET",
  "ARDUINO_INGEST_TOKEN",
  "ARDUINO_DEVICE_KEYS_JSON",
  "TRUST_PROXY_HEADERS",
] as const;

const processEnv = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined> = {};

function setEnv(nodeEnv: "production" | "development"): void {
  processEnv.NODE_ENV = nodeEnv;
  processEnv.DATABASE_URL =
    nodeEnv === "production"
      ? "postgresql://app:not-the-local-password@db.internal:5432/cepheus"
      : "postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus";
  processEnv.HEALTH_CONNECT_WEBHOOK_SECRET = "hc-webhook-secret-for-tests";
  processEnv.ARDUINO_INGEST_TOKEN = "arduino-token-for-tests";
  delete processEnv.ARDUINO_DEVICE_KEYS_JSON;
  delete processEnv.TRUST_PROXY_HEADERS;
  _resetEnv();
}

function sameOriginPost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const simulatedHealthConnect = {
  isSimulated: true,
  daily_totals: [{ date: "2026-11-14", steps: 4000 }],
};

function simulatedArduino(deviceId = "unoq-desk-01") {
  return {
    deviceId,
    date: "2026-11-14",
    hourOfDay: 13,
    isSimulated: true,
    camera: {
      durationSec: 20,
      effectiveFps: 15,
      faceDetectedRatio: 0.9,
      expressivityScore: 0.08,
      angularPathDegPerMin: 120,
    },
  };
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, processEnv[k]]));
  _resetRateLimits();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete processEnv[key];
    else processEnv[key] = saved[key];
  }
  _resetEnv();
  _resetRateLimits();
});

describe("same-origin simulation shortcut on ingest routes", () => {
  it("refuses a same-origin simulated Health Connect push without the secret in production", async () => {
    setEnv("production");
    const res = await healthConnectWebhook(
      sameOriginPost("/api/webhooks/health-connect", simulatedHealthConnect)
    );
    expect(res.status).toBe(401);
  });

  it("accepts a same-origin simulated Health Connect push in development", async () => {
    setEnv("development");
    const res = await healthConnectWebhook(
      sameOriginPost("/api/webhooks/health-connect", simulatedHealthConnect)
    );
    expect(res.status).toBe(200);
  });

  it("refuses a same-origin simulated Arduino push without a device token in production", async () => {
    setEnv("production");
    const res = await arduinoIngest(sameOriginPost("/api/arduino/ingest", simulatedArduino()));
    expect(res.status).toBe(401);
  });

  it("accepts a same-origin simulated Arduino push in development", async () => {
    setEnv("development");
    const res = await arduinoIngest(sameOriginPost("/api/arduino/ingest", simulatedArduino()));
    expect(res.status).toBe(200);
  });
});

describe("Arduino ingest rate limit", () => {
  it("does not give a fresh limit when the unchecked device id changes", async () => {
    setEnv("development");
    for (let i = 0; i < 60; i += 1) {
      const res = await arduinoIngest(
        sameOriginPost("/api/arduino/ingest", simulatedArduino(`unoq-${i}`))
      );
      expect(res.status).toBe(200);
    }
    const res = await arduinoIngest(
      sameOriginPost("/api/arduino/ingest", simulatedArduino("unoq-fresh"))
    );
    expect(res.status).toBe(429);
  });
});

describe("Arduino ingest replay and clock skew enforcement", () => {
  const fixedNow = 1_794_650_000_000;
  const CLOCK_SKEW_MS = 5 * 60_000; // 300,000 ms

  function authorizedArduino(overrides: Record<string, unknown> = {}) {
    return {
      deviceId: "unoq-desk-01",
      date: "2026-11-14",
      hourOfDay: 13,
      isSimulated: false,
      camera: {
        durationSec: 20,
        effectiveFps: 15,
        faceDetectedRatio: 0.9,
        expressivityScore: 0.08,
        angularPathDegPerMin: 120,
      },
      ...overrides,
    };
  }

  function authorizedPost(path: string, body: unknown): Request {
    return new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "content-type": "application/json",
        authorization: "Bearer arduino-token-for-tests",
      },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    setEnv("production");
    _resetDeviceReplays();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetDeviceReplays();
  });

  it("accepts a timestamp exactly at the allowed clock skew on both sides (past and future)", async () => {
    // Past boundary: exactly now - 300,000 ms
    const pastRes = await arduinoIngest(
      authorizedPost("/api/arduino/ingest", authorizedArduino({
        timestampMs: fixedNow - CLOCK_SKEW_MS,
        nonce: "nonce-exact-past-01",
      }))
    );
    expect(pastRes.status).toBe(200);

    // Future boundary: exactly now + 300,000 ms
    const futureRes = await arduinoIngest(
      authorizedPost("/api/arduino/ingest", authorizedArduino({
        timestampMs: fixedNow + CLOCK_SKEW_MS,
        nonce: "nonce-exact-fut-01",
      }))
    );
    expect(futureRes.status).toBe(200);
  });

  it("refuses a timestamp one millisecond past the allowed clock skew on both sides", async () => {
    // Past skew + 1ms: now - 300,001 ms -> refused as stale (401)
    const staleRes = await arduinoIngest(
      authorizedPost("/api/arduino/ingest", authorizedArduino({
        timestampMs: fixedNow - CLOCK_SKEW_MS - 1,
        nonce: "nonce-past-skew-01",
      }))
    );
    expect(staleRes.status).toBe(401);

    // Future skew + 1ms: now + 300,001 ms -> refused like a stale one (401)
    const futureRes = await arduinoIngest(
      authorizedPost("/api/arduino/ingest", authorizedArduino({
        timestampMs: fixedNow + CLOCK_SKEW_MS + 1,
        nonce: "nonce-future-skew-01",
      }))
    );
    expect(futureRes.status).toBe(401);
  });

  it("refuses an ingest request with a missing nonce", async () => {
    const res = await arduinoIngest(
      authorizedPost("/api/arduino/ingest", authorizedArduino({
        timestampMs: fixedNow,
        // nonce omitted
      }))
    );
    expect(res.status).toBe(401);
  });

  it("refuses a request with a nonce used twice (replay rejection 409)", async () => {
    const payload = authorizedArduino({
      timestampMs: fixedNow,
      nonce: "nonce-unique-replayed-01",
    });

    const firstRes = await arduinoIngest(authorizedPost("/api/arduino/ingest", payload));
    expect(firstRes.status).toBe(200);

    const secondRes = await arduinoIngest(authorizedPost("/api/arduino/ingest", payload));
    expect(secondRes.status).toBe(409);
  });
});
