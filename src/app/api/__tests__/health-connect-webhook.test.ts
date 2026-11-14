import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/monitoring", () => ({
  saveWearableDaysAndComputeRhythm: vi.fn(async () => ({
    ok: true,
    savedDays: 1,
    rhythmComputed: false,
  })),
}));

import { POST as healthConnectWebhook } from "@/app/api/webhooks/health-connect/route";
import { _resetEnv } from "@/server/env";
import { saveWearableDaysAndComputeRhythm } from "@/server/monitoring";
import { _resetRateLimits } from "@/server/security/rate-limit";

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "HEALTH_CONNECT_WEBHOOK_SECRET",
] as const;

const processEnv = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined> = {};

const TEST_SECRET = "hc-webhook-secret-for-unit-tests";

function signBody(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, processEnv[k]]));
  processEnv.NODE_ENV = "production";
  processEnv.DATABASE_URL =
    "postgresql://app:not-the-local-password@db.internal:5432/cepheus";
  processEnv.HEALTH_CONNECT_WEBHOOK_SECRET = TEST_SECRET;
  _resetEnv();
  _resetRateLimits();
  vi.clearAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete processEnv[key];
    else processEnv[key] = saved[key];
  }
  _resetEnv();
  _resetRateLimits();
});

describe("POST /api/webhooks/health-connect", () => {
  it("returns 401 before JSON.parse when unauthenticated even on malformed JSON", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/health-connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });

    const res = await healthConnectWebhook(req);
    expect(res.status).toBe(401);
  });

  it("authenticates with X-API-Key header", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/health-connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": TEST_SECRET,
      },
      body: JSON.stringify({
        daily_totals: [{ date: "2026-11-14", steps: 6400 }],
      }),
    });

    const res = await healthConnectWebhook(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(saveWearableDaysAndComputeRhythm).toHaveBeenCalledTimes(1);
  });

  it("verifies X-Signature HMAC over raw body with Life Dashboard fields", async () => {
    const payload = {
      timezone: "Europe/Helsinki",
      active_calories: [
        {
          calories: 210,
          start_time: "2026-11-14T10:00:00Z",
          end_time: "2026-11-14T11:00:00Z",
        },
      ],
      heart_rate_variability: [
        {
          heart_rate_variability_millis: 46.5,
          time: "2026-11-14T06:30:00Z",
        },
      ],
      resting_heart_rate: [
        {
          bpm: 58,
          time: "2026-11-14T06:30:00Z",
        },
      ],
      daily_totals: [
        {
          date: "2026-11-14",
          steps: 7200,
          active_calories: 320,
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const sig = signBody(rawBody, TEST_SECRET);

    const req = new Request("http://localhost:3000/api/webhooks/health-connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": sig,
      },
      body: rawBody,
    });

    const res = await healthConnectWebhook(req);
    expect(res.status).toBe(200);
    expect(saveWearableDaysAndComputeRhythm).toHaveBeenCalledTimes(1);
  });

  it("returns 204 for test ping without saving wearable days", async () => {
    const rawBody = JSON.stringify({ test: true });
    const req = new Request("http://localhost:3000/api/webhooks/health-connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signBody(rawBody, TEST_SECRET),
      },
      body: rawBody,
    });

    const res = await healthConnectWebhook(req);
    expect(res.status).toBe(204);
    expect(saveWearableDaysAndComputeRhythm).not.toHaveBeenCalled();
  });
});
