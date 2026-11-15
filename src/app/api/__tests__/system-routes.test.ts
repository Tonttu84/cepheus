import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security")>();
  return { ...actual, timingSafeEqualString: vi.fn(actual.timingSafeEqualString) };
});

import { POST as closeRounds } from "@/app/api/rounds/close/route";
import { POST as evaluate } from "@/app/api/patients/[patientId]/evaluate/route";
import { timingSafeEqualString } from "@/server/security";
import { _resetEnv } from "@/server/env";
import {
  apiRequest,
  PATIENT_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  staffCookie,
  SYSTEM_KEY,
  tearDownRoutes,
} from "./route-test-kit";

const params = (patientId: string) => ({ params: Promise.resolve({ patientId }) });

function closeRequest(options: { bearer?: string; cookie?: string; body?: unknown } = {}) {
  return apiRequest("/api/rounds/close", { body: { patientId: PATIENT_ID }, ...options });
}

function evaluateRequest(options: { bearer?: string; cookie?: string } = {}) {
  return apiRequest(`/api/patients/${PATIENT_ID}/evaluate`, options);
}

describe("system-only routes", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes("2026-11-23T10:00:00.000Z");
    await fake.ports.patients.savePatient(patientRecord());
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("run with the system key", async () => {
    const closed = await closeRounds(closeRequest({ bearer: SYSTEM_KEY }));
    expect(closed.status).toBe(200);
    const body = await closed.json();
    expect(body.ok).toBe(true);
    expect(body.closedRoundsCount).toBeGreaterThanOrEqual(1);
    const [round] = await fake.ports.rounds.getRounds(PATIENT_ID);
    expect(round.status).toBe("missed");

    const evaluated = await evaluate(evaluateRequest({ bearer: SYSTEM_KEY }), params(PATIENT_ID));
    expect(evaluated.status).toBe(200);
    expect(Object.keys(await evaluated.json()).sort()).toEqual(["ok", "saved", "storedEffectsCount"]);
  });

  it("compare the key in constant time", async () => {
    vi.mocked(timingSafeEqualString).mockClear();
    await closeRounds(closeRequest({ bearer: SYSTEM_KEY }));
    expect(timingSafeEqualString).toHaveBeenCalledWith(SYSTEM_KEY, SYSTEM_KEY);
  });

  it("refuse a wrong key and no key with 401", async () => {
    expect((await closeRounds(closeRequest({ bearer: `${SYSTEM_KEY}x` }))).status).toBe(401);
    expect((await closeRounds(closeRequest())).status).toBe(401);
    expect((await evaluate(evaluateRequest({ bearer: "nope" }), params(PATIENT_ID))).status).toBe(401);
    expect(await fake.ports.rounds.getRounds(PATIENT_ID)).toHaveLength(0);
  });

  it("refuse patient and staff sessions with 403", async () => {
    for (const cookie of [patientCookie(), staffCookie(), staffCookie(undefined, "admin")]) {
      expect((await closeRounds(closeRequest({ cookie }))).status).toBe(403);
      expect((await evaluate(evaluateRequest({ cookie }), params(PATIENT_ID))).status).toBe(403);
    }
    expect(await fake.ports.rounds.getRounds(PATIENT_ID)).toHaveLength(0);
  });

  it("refuse every caller when no system key is set", async () => {
    delete process.env.SYSTEM_API_KEY;
    _resetEnv();
    expect((await closeRounds(closeRequest({ bearer: SYSTEM_KEY }))).status).toBe(401);
    expect((await closeRounds(closeRequest({ bearer: "" }))).status).toBe(401);
  });

  it("answer invalid input with a 400 that does not echo it", async () => {
    const bad = await closeRounds(closeRequest({ bearer: SYSTEM_KEY, body: { patientId: "a b<script>" } }));
    expect(bad.status).toBe(400);
    expect(await bad.text()).not.toContain("<script>");
    const badParam = await evaluate(evaluateRequest({ bearer: SYSTEM_KEY }), params("x".repeat(65)));
    expect(badParam.status).toBe(400);
    expect((await evaluate(evaluateRequest({ bearer: SYSTEM_KEY }), params("unknown"))).status).toBe(404);
  });
});
