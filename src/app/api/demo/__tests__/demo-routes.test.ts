import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postAdvance } from "@/app/api/demo/advance/route";
import { POST as postReset } from "@/app/api/demo/reset/route";
import { GET as getDemo, POST as postDemo } from "@/app/api/demo/route";
import { POST as postSwitch } from "@/app/api/demo/switch/route";
import type { PatientAuthSession, StaffAuthSession } from "@/lib/auth-types";
import {
  advanceDemoTime,
  getDemoOffsetDays,
  isCountersEnabled,
  resetDemoClock,
  resetSettings,
  setDemoEnabled,
  setSwitch,
} from "@/server/api";
import { SESSION_COOKIE_NAME, sealSession } from "@/server/auth";
import { checkDemoNeedsReset } from "@/server/db";

// Mock database operations for unit test of routes
vi.mock(import("@/server/db"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSimulatedPatientSummaries: vi.fn().mockResolvedValue([
      {
        id: "sim-p-1",
        participantCode: "P-SIM-001",
        label: "Post-TMS follow-up participant",
        missedRoundsCount: 0,
        openWarnings: [],
      },
    ]),
    getSimulatedPatientIds: vi.fn().mockResolvedValue(["sim-p-1"]),
    checkDemoNeedsReset: vi.fn().mockResolvedValue(false),
    resetSimulatedData: vi.fn().mockImplementation(async () => {
      resetDemoClock();
      resetSettings();
    }),
  };
});

// Mock advanceDemoAndRunSystemWork to avoid needing full DB in route unit test
vi.mock("@/server/api/demo", () => ({
  advanceDemoAndRunSystemWork: vi.fn().mockImplementation(async (days: number) => {
    return advanceDemoTime(days);
  }),
}));

const STAFF_SESSION: StaffAuthSession = {
  kind: "staff",
  actor: { kind: "staff", staffId: "s-1", clinicId: "clinic-1", role: "nurse" },
  displayName: "Clinic Nurse",
  email: "nurse@sim-clinic.local",
  clinicName: "Simulated TMS Clinic",
  avatarInitials: "CN",
  isSimulated: true,
  signedInAt: "2026-11-14T20:00:00.000Z",
};

const PATIENT_SESSION: PatientAuthSession = {
  kind: "patient",
  actor: { kind: "patient", patientId: "p-1", clinicId: "clinic-1" },
  participantCode: "P-SIM-001",
  label: "Post-TMS follow-up participant",
  avatarInitials: "P1",
  authMethod: "simulated_finnish_eid",
  isSimulated: true,
  signedInAt: "2026-11-14T20:00:00.000Z",
};

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    session?: PatientAuthSession | StaffAuthSession;
  } = {}
): NextRequest {
  const headers = new Headers();
  headers.set("host", "localhost:3000");

  if (options.method === "POST") {
    headers.set("origin", "http://localhost:3000");
    headers.set("content-type", "application/json");
  }

  if (options.session) {
    const sealed = sealSession(options.session);
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sealed}`);
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe("Demo API routes (src/app/api/demo/**)", () => {
  beforeEach(() => {
    resetSettings();
    setDemoEnabled(true);
    resetDemoClock();
  });

  afterEach(() => {
    resetDemoClock();
    resetSettings();
  });

  describe("Authentication: 401 when signed out", () => {
    it("refuses GET /api/demo with 401 when unauthenticated", async () => {
      const req = createRequest("/api/demo");
      const res = await getDemo(req);
      expect(res.status).toBe(401);
    });

    it("refuses POST /api/demo with 401 when unauthenticated", async () => {
      const req = createRequest("/api/demo", {
        method: "POST",
        body: { action: "reset" },
      });
      const res = await postDemo(req);
      expect(res.status).toBe(401);
    });

    it("refuses POST /api/demo/advance with 401 when unauthenticated", async () => {
      const req = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 1 },
      });
      const res = await postAdvance(req);
      expect(res.status).toBe(401);
    });

    it("refuses POST /api/demo/reset with 401 when unauthenticated", async () => {
      const req = createRequest("/api/demo/reset", {
        method: "POST",
      });
      const res = await postReset(req);
      expect(res.status).toBe(401);
    });

    it("refuses POST /api/demo/switch with 401 when unauthenticated", async () => {
      const req = createRequest("/api/demo/switch", {
        method: "POST",
        body: { key: "rewards", enabled: false },
      });
      const res = await postSwitch(req);
      expect(res.status).toBe(401);
    });
  });

  describe("Demo disabled: 404 when demo setting is off", () => {
    beforeEach(() => {
      setDemoEnabled(false);
    });

    it("refuses GET /api/demo with 404 when demo setting is off", async () => {
      const req = createRequest("/api/demo", { session: STAFF_SESSION });
      const res = await getDemo(req);
      expect(res.status).toBe(404);
    });

    it("refuses POST /api/demo with 404 when demo setting is off", async () => {
      const req = createRequest("/api/demo", {
        method: "POST",
        body: { action: "reset" },
        session: STAFF_SESSION,
      });
      const res = await postDemo(req);
      expect(res.status).toBe(404);
    });

    it("refuses POST /api/demo/advance with 404 when demo setting is off", async () => {
      const req = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 1 },
        session: STAFF_SESSION,
      });
      const res = await postAdvance(req);
      expect(res.status).toBe(404);
    });

    it("refuses POST /api/demo/reset with 404 when demo setting is off", async () => {
      const req = createRequest("/api/demo/reset", {
        method: "POST",
        session: STAFF_SESSION,
      });
      const res = await postReset(req);
      expect(res.status).toBe(404);
    });

    it("refuses POST /api/demo/switch with 404 when demo setting is off", async () => {
      const req = createRequest("/api/demo/switch", {
        method: "POST",
        body: { key: "rewards", enabled: false },
        session: STAFF_SESSION,
      });
      const res = await postSwitch(req);
      expect(res.status).toBe(404);
    });
  });

  describe("Successful operations when authenticated and demo is on", () => {
    it("GET /api/demo returns current demo state", async () => {
      const req = createRequest("/api/demo", { session: STAFF_SESSION });
      const res = await getDemo(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.isSimulated).toBe(true);
      expect(typeof json.now).toBe("string");
      expect(json.offsetDays).toBe(0);
      expect(json.switches).toBeDefined();
      expect(Array.isArray(json.patients)).toBe(true);
      expect(json.needsReset).toBe(false);
    });

    it("GET /api/demo reports needsReset: true when stored data is ahead of real time", async () => {
      vi.mocked(checkDemoNeedsReset).mockResolvedValueOnce(true);
      const req = createRequest("/api/demo", { session: STAFF_SESSION });
      const res = await getDemo(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.needsReset).toBe(true);
    });

    it("POST /api/demo/advance rejects advance when needsReset is true", async () => {
      vi.mocked(checkDemoNeedsReset).mockResolvedValueOnce(true);
      const req = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 1 },
        session: STAFF_SESSION,
      });
      const res = await postAdvance(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toMatch(/reset/i);
    });

    it("GET /api/demo?moment=small_dip preserves foundation backwards compatibility", async () => {
      const req = createRequest("/api/demo?moment=small_dip", { session: PATIENT_SESSION });
      const res = await getDemo(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.isSimulated).toBe(true);
      expect(json.moment.key).toBe("small_dip");
      expect(json.moment.dayIndex).toBe(29);
    });

    it("POST /api/demo/advance validates days: rejects days < 1 or days > 60", async () => {
      const req0 = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 0 },
        session: STAFF_SESSION,
      });
      expect((await postAdvance(req0)).status).toBe(400);

      const req61 = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 61 },
        session: STAFF_SESSION,
      });
      expect((await postAdvance(req61)).status).toBe(400);

      const reqNonInt = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 1.5 },
        session: STAFF_SESSION,
      });
      expect((await postAdvance(reqNonInt)).status).toBe(400);
    });

    it("POST /api/demo/advance advances demo time for valid days", async () => {
      const req = createRequest("/api/demo/advance", {
        method: "POST",
        body: { days: 7 },
        session: STAFF_SESSION,
      });
      const res = await postAdvance(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.offsetDays).toBe(7);
      expect(getDemoOffsetDays()).toBe(7);
    });

    it("POST /api/demo with action advance works identically", async () => {
      const req = createRequest("/api/demo", {
        method: "POST",
        body: { action: "advance", days: 3 },
        session: STAFF_SESSION,
      });
      const res = await postDemo(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.offsetDays).toBe(3);
    });

    it("POST /api/demo/switch toggles switches", async () => {
      const req = createRequest("/api/demo/switch", {
        method: "POST",
        body: { key: "counters", enabled: true },
        session: STAFF_SESSION,
      });
      const res = await postSwitch(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.switches.counters).toBe(true);
      expect(isCountersEnabled()).toBe(true);
    });

    it("POST /api/demo/reset zeroes offset and restores defaults", async () => {
      advanceDemoTime(14);
      setSwitch("counters", true);

      expect(getDemoOffsetDays()).toBe(14);
      expect(isCountersEnabled()).toBe(true);

      const req = createRequest("/api/demo/reset", {
        method: "POST",
        session: STAFF_SESSION,
      });
      const res = await postReset(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.offsetDays).toBe(0);
      expect(getDemoOffsetDays()).toBe(0);
      expect(isCountersEnabled()).toBe(false);
    });
  });
});
