import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientAuthSession, StaffAuthSession } from "@/lib/auth-types";
import { sealSession, SESSION_COOKIE_NAME } from "@/server/auth/session";

vi.mock("@/server/fitbit/client", () => ({
  FITBIT_STATE_COOKIE: "cepheus_fitbit_oauth_state",
  FITBIT_TOKEN_COOKIE: "cepheus_fitbit_token",
  isFitbitConfigured: vi.fn(() => true),
  resolveFitbitRedirectUri: vi.fn(() => "http://localhost:3000/api/fitbit/callback"),
  buildFitbitAuthorizeUrl: vi.fn(
    (params: { state: string }) => `https://www.fitbit.com/oauth2/authorize?state=${params.state}`
  ),
  exchangeFitbitCode: vi.fn(async () => ({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    userId: "mock-user-123",
    scope: "activity sleep",
    expiresAtMs: Date.now() + 3600_000,
  })),
  fetchFitbitWindowDays: vi.fn(async (session: unknown) => ({
    days: [],
    updatedSession: session,
    intradayUsed: true,
  })),
}));

vi.mock("@/server/verda/client", () => ({
  generateTailoredPatientStep: vi.fn(async (input: { participantCode: string }) => ({
    message: "Take a 10-minute walk outside.",
    actionTitle: "Gentle walk",
    participantCode: input.participantCode,
  })),
}));

vi.mock("@/server/monitoring", () => ({
  buildSimulatedFitbitWeek: vi.fn(() => []),
  saveWearableDaysAndComputeRhythm: vi.fn(async () => ({
    ok: true,
    savedDays: 7,
    rhythmComputed: true,
  })),
}));

import { POST as postSignOut } from "@/app/api/auth/sign-out/route";
import { POST as postPatientStepRoute } from "@/app/api/ai/patient-step/route";
import { GET as getFitbitStatusRoute } from "@/app/api/fitbit/status/route";
import { POST as postFitbitSyncRoute } from "@/app/api/fitbit/sync/route";
import { _resetRateLimits, sealJson } from "@/server/security";

function makePatientSession(overrides?: Partial<PatientAuthSession>): PatientAuthSession {
  return {
    kind: "patient",
    actor: {
      kind: "patient",
      patientId: "sim-post-tms-01",
      clinicId: "sim-clinic-01",
      ...(overrides?.actor ?? {}),
    },
    participantCode: overrides?.participantCode ?? "P-SIM-001",
    label: overrides?.label ?? "Post-TMS follow-up participant",
    avatarInitials: overrides?.avatarInitials ?? "P1",
    authMethod: "simulated_finnish_eid",
    isSimulated: true,
    signedInAt: overrides?.signedInAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function makeStaffSession(overrides?: Partial<StaffAuthSession>): StaffAuthSession {
  return {
    kind: "staff",
    actor: {
      kind: "staff",
      staffId: "sim-staff-nurse",
      clinicId: "sim-clinic-01",
      role: "nurse",
      ...(overrides?.actor ?? {}),
    },
    displayName: overrides?.displayName ?? "Clinic Nurse",
    email: overrides?.email ?? "nurse@sim-clinic.local",
    clinicName: overrides?.clinicName ?? "Simulated TMS Clinic",
    avatarInitials: overrides?.avatarInitials ?? "CN",
    isSimulated: true,
    signedInAt: overrides?.signedInAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function authHeader(
  session?: PatientAuthSession | StaffAuthSession,
  extraCookies: string[] = []
): Record<string, string> {
  const cookies: string[] = [];
  if (session) {
    cookies.push(`${SESSION_COOKIE_NAME}=${sealSession(session)}`);
  }
  cookies.push(...extraCookies);
  return cookies.length > 0 ? { cookie: cookies.join("; ") } : {};
}

function sameOriginHeaders(): Record<string, string> {
  return {
    origin: "http://localhost:3000",
    host: "localhost:3000",
  };
}

describe("Route protection and Fitbit patient binding", () => {
  beforeEach(() => {
    _resetRateLimits();
    process.env.VERDA_PATIENT_STEP_ENABLED = "true";
  });

  describe("Fitbit routes and patient binding", () => {
    it("refuses GET /api/fitbit/status when signed out with 401", async () => {
      const req = new Request("http://localhost:3000/api/fitbit/status");
      const res = await getFitbitStatusRoute(req);
      expect(res.status).toBe(401);
    });

    it("refuses GET /api/fitbit/status with wrong role (staff) with 403", async () => {
      const session = makeStaffSession();
      const req = new Request("http://localhost:3000/api/fitbit/status", {
        headers: authHeader(session),
      });
      const res = await getFitbitStatusRoute(req);
      expect(res.status).toBe(403);
    });

    it("refuses GET /api/fitbit/status when sealed token cookie belongs to a different patient", async () => {
      const session = makePatientSession({
        actor: { kind: "patient", patientId: "patient-1", clinicId: "c1" },
      });
      const foreignFitbit = sealJson(
        {
          accessToken: "token-999",
          refreshToken: "refresh-999",
          expiresAtMs: Date.now() + 3600_000,
          scope: "activity sleep",
          patientId: "patient-DIFFERENT",
        },
        3600_000
      );

      const req = new Request("http://localhost:3000/api/fitbit/status", {
        headers: {
          ...authHeader(session),
          cookie: `${SESSION_COOKIE_NAME}=${sealSession(session)}; cepheus_fitbit_token=${foreignFitbit}`,
        },
      });
      const res = await getFitbitStatusRoute(req);
      expect(res.status).toBe(403);
    });

    it("refuses POST /api/fitbit/sync when sealed token cookie belongs to a different patient", async () => {
      const session = makePatientSession({
        actor: { kind: "patient", patientId: "patient-1", clinicId: "c1" },
      });
      const foreignFitbit = sealJson(
        {
          accessToken: "token-999",
          refreshToken: "refresh-999",
          expiresAtMs: Date.now() + 3600_000,
          scope: "activity sleep",
          patientId: "patient-DIFFERENT",
        },
        3600_000
      );

      const req = new Request("http://localhost:3000/api/fitbit/sync", {
        method: "POST",
        headers: {
          ...sameOriginHeaders(),
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${sealSession(session)}; cepheus_fitbit_token=${foreignFitbit}`,
        },
        body: JSON.stringify({ mode: "live" }),
      });
      const res = await postFitbitSyncRoute(req);
      expect(res.status).toBe(403);
    });

    it("clears Fitbit cookies on sign-out", async () => {
      const req = new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: sameOriginHeaders(),
      });
      const res = await postSignOut(req);
      expect(res.status).toBe(200);
      const setCookies =
        res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
      const combined = setCookies.join(" ");
      expect(combined).toContain("cepheus_fitbit_token=");
      expect(combined).toContain("cepheus_fitbit_oauth_state=");
    });
  });

  describe("/api/ai/patient-step", () => {
    const validBody = {
      participantCode: "P-SIM-001",
      dayIndex: 29,
      broadAreasShifted: ["daily_routine"],
      lowDaylight: true,
      highStationaryBout: true,
      pastActionOutcomes: [],
      isSimulated: true,
    };

    it("refuses POST without session with 401", async () => {
      const req = new Request("http://localhost:3000/api/ai/patient-step", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify(validBody),
      });
      const res = await postPatientStepRoute(req);
      expect(res.status).toBe(401);
    });

    it("refuses POST with wrong role (staff) with 403", async () => {
      const session = makeStaffSession();
      const req = new Request("http://localhost:3000/api/ai/patient-step", {
        method: "POST",
        headers: {
          ...sameOriginHeaders(),
          ...authHeader(session),
        },
        body: JSON.stringify(validBody),
      });
      const res = await postPatientStepRoute(req);
      expect(res.status).toBe(403);
    });

    it("refuses POST when participantCode in body disagrees with session", async () => {
      const session = makePatientSession({ participantCode: "P-SIM-001" });
      const req = new Request("http://localhost:3000/api/ai/patient-step", {
        method: "POST",
        headers: {
          ...sameOriginHeaders(),
          ...authHeader(session),
        },
        body: JSON.stringify({
          ...validBody,
          participantCode: "P-SIM-OTHER",
        }),
      });
      const res = await postPatientStepRoute(req);
      expect(res.status).toBe(403);
    });

    it("uses the session participant even if participantCode is omitted from body", async () => {
      const session = makePatientSession({ participantCode: "P-SIM-001" });
      const { participantCode: _, ...bodyWithoutCode } = validBody;
      const req = new Request("http://localhost:3000/api/ai/patient-step", {
        method: "POST",
        headers: {
          ...sameOriginHeaders(),
          ...authHeader(session),
        },
        body: JSON.stringify(bodyWithoutCode),
      });
      const res = await postPatientStepRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.participantCode).toBe("P-SIM-001");
    });
  });
});
