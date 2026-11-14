import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as postNurseBrief } from "@/app/api/ai/nurse-brief/route";
import { POST as postPatientStep } from "@/app/api/ai/patient-step/route";
import { GET as getDemo } from "@/app/api/demo/route";
import { GET as getFitbitAuth } from "@/app/api/fitbit/auth/route";
import { GET as getFitbitCallback } from "@/app/api/fitbit/callback/route";
import { POST as postFitbitDisconnect } from "@/app/api/fitbit/disconnect/route";
import { GET as getFitbitStatus } from "@/app/api/fitbit/status/route";
import { POST as postFitbitSync } from "@/app/api/fitbit/sync/route";
import { POST as postMonitoringConsent } from "@/app/api/monitoring/consent/route";
import {
  GET as getMonitoringSummary,
  POST as postMonitoringSummary,
} from "@/app/api/monitoring/summary/route";
import {
  SESSION_COOKIE_NAME,
  requireApiSession,
  sealSession,
} from "@/server/auth";
import { _resetRateLimits } from "@/server/security";
import type { PatientAuthSession, StaffAuthSession } from "@/lib/auth-types";

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

function makeRequest(
  url: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
  session?: PatientAuthSession | StaffAuthSession
): NextRequest {
  const headers = new Headers(init.headers);
  headers.set("host", "localhost:3000");
  if (init.method === "POST" && !headers.has("origin")) {
    headers.set("origin", "http://localhost:3000");
  }
  if (session) {
    const sealed = sealSession(session);
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(sealed)}`);
  }
  return new NextRequest(url, {
    method: init.method ?? "GET",
    body: init.body,
    headers,
  });
}

describe("API session guards and logged-out route matrix", () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  it("requireApiSession enforces presence and role cleanly", () => {
    const unsigned = requireApiSession(
      makeRequest("http://localhost:3000/api/test")
    );
    expect(unsigned.ok).toBe(false);
    if (!unsigned.ok) {
      expect(unsigned.response.status).toBe(401);
    }

    const tampered = requireApiSession(
      new Request("http://localhost:3000/api/test", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=tampered.token.value` },
      })
    );
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.response.status).toBe(401);
    }

    const patientAsStaff = requireApiSession(
      makeRequest("http://localhost:3000/api/test", {}, PATIENT_SESSION),
      "staff"
    );
    expect(patientAsStaff.ok).toBe(false);
    if (!patientAsStaff.ok) {
      expect(patientAsStaff.response.status).toBe(403);
    }

    const staffAsStaff = requireApiSession(
      makeRequest("http://localhost:3000/api/test", {}, STAFF_SESSION),
      "staff"
    );
    expect(staffAsStaff.ok).toBe(true);
  });

  it("returns 401 when unauthenticated across every protected API endpoint", async () => {
    const responses = await Promise.all([
      getDemo(makeRequest("http://localhost:3000/api/demo")),
      getMonitoringSummary(
        makeRequest("http://localhost:3000/api/monitoring/summary")
      ),
      postMonitoringSummary(
        makeRequest("http://localhost:3000/api/monitoring/summary", {
          method: "POST",
        })
      ),
      postMonitoringConsent(
        makeRequest("http://localhost:3000/api/monitoring/consent", {
          method: "POST",
          body: "{}",
        })
      ),
      postNurseBrief(
        makeRequest("http://localhost:3000/api/ai/nurse-brief", {
          method: "POST",
          body: "{}",
        })
      ),
      postPatientStep(
        makeRequest("http://localhost:3000/api/ai/patient-step", {
          method: "POST",
          body: "{}",
        })
      ),
      getFitbitAuth(makeRequest("http://localhost:3000/api/fitbit/auth")),
      getFitbitCallback(
        makeRequest("http://localhost:3000/api/fitbit/callback")
      ),
      getFitbitStatus(makeRequest("http://localhost:3000/api/fitbit/status")),
      postFitbitSync(
        makeRequest("http://localhost:3000/api/fitbit/sync", {
          method: "POST",
          body: "{}",
        })
      ),
      postFitbitDisconnect(
        makeRequest("http://localhost:3000/api/fitbit/disconnect", {
          method: "POST",
        })
      ),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });

  it("returns 403 when an authenticated actor calls another role's API route", async () => {
    const patientCallsNurseBrief = await postNurseBrief(
      makeRequest(
        "http://localhost:3000/api/ai/nurse-brief",
        { method: "POST", body: "{}" },
        PATIENT_SESSION
      )
    );
    expect(patientCallsNurseBrief.status).toBe(403);

    const staffCallsPatientEndpoints = await Promise.all([
      postMonitoringSummary(
        makeRequest(
          "http://localhost:3000/api/monitoring/summary",
          { method: "POST" },
          STAFF_SESSION
        )
      ),
      postMonitoringConsent(
        makeRequest(
          "http://localhost:3000/api/monitoring/consent",
          { method: "POST", body: "{}" },
          STAFF_SESSION
        )
      ),
      postPatientStep(
        makeRequest(
          "http://localhost:3000/api/ai/patient-step",
          { method: "POST", body: "{}" },
          STAFF_SESSION
        )
      ),
      getFitbitAuth(
        makeRequest("http://localhost:3000/api/fitbit/auth", {}, STAFF_SESSION)
      ),
      getFitbitCallback(
        makeRequest(
          "http://localhost:3000/api/fitbit/callback",
          {},
          STAFF_SESSION
        )
      ),
      getFitbitStatus(
        makeRequest(
          "http://localhost:3000/api/fitbit/status",
          {},
          STAFF_SESSION
        )
      ),
      postFitbitSync(
        makeRequest(
          "http://localhost:3000/api/fitbit/sync",
          { method: "POST", body: "{}" },
          STAFF_SESSION
        )
      ),
      postFitbitDisconnect(
        makeRequest(
          "http://localhost:3000/api/fitbit/disconnect",
          { method: "POST" },
          STAFF_SESSION
        )
      ),
    ]);

    for (const res of staffCallsPatientEndpoints) {
      expect(res.status).toBe(403);
    }
  });
});
