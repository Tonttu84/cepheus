import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authIndex from "@/server/auth";
import * as cryptoSecurity from "@/server/security/crypto";
import { GET as getSession } from "@/app/api/auth/session/route";
import { POST as postSignIn } from "@/app/api/auth/sign-in/route";
import { POST as postSignOut } from "@/app/api/auth/sign-out/route";
import {
  SESSION_COOKIE_NAME,
  authenticateStaffCredentials,
  sealSession,
  sessionToActor,
  unsealSession,
} from "@/server/auth";
import {
  PatientSignInRequestSchema,
  StaffSignInRequestSchema,
} from "@/lib/auth-types";
import { _setParticipantIdResolver } from "@/server/auth/eid-provider";
import { _setStaffIdResolver } from "@/server/auth/staff-auth";
import { generateTotp, _resetTotpReplayProtection } from "@/server/auth/totp";
import { _resetEnv } from "@/server/env";
import { _resetRateLimits } from "@/server/security";

function makeSameOriginRequest(
  url: string,
  init: RequestInit = {}
): Request {
  const headers = new Headers(init.headers);
  headers.set("host", "localhost:3000");
  if (!headers.has("origin")) {
    headers.set("origin", "http://localhost:3000");
  }
  return new Request(url, { ...init, headers });
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(
    setCookieHeader
  );
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : null;
}

describe("auth routes and session handling", () => {
  beforeEach(() => {
    _resetRateLimits();
    _setParticipantIdResolver(async (_code, fallbackId) => ({
      patientId: fallbackId,
      clinicId: "sim-clinic-01",
    }));
    _setStaffIdResolver(async (_email, fallbackId) => ({
      staffId: fallbackId,
      clinicId: "sim-clinic-01",
    }));
  });

  afterEach(() => {
    _setParticipantIdResolver(null);
    _setStaffIdResolver(null);
  });

  it("does not export any test hooks or internal symbols starting with _", () => {
    const exportedNames = Object.keys(authIndex);
    const underscoreExports = exportedNames.filter((name) => name.startsWith("_"));
    expect(underscoreExports).toEqual([]);
  });

  it("signs in a simulated patient via e-ID, sets HttpOnly cookie, and reads pseudonymous session", async () => {
    const signInReq = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "patient_eid",
        participantCode: "P-SIM-001",
      }),
    });

    const signInRes = await postSignIn(signInReq);
    expect(signInRes.status).toBe(200);

    const cookieHeader = signInRes.headers.get("set-cookie");
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toContain(SESSION_COOKIE_NAME);
    expect(cookieHeader?.toLowerCase()).toContain("httponly");
    expect(cookieHeader?.toLowerCase()).toContain("samesite=lax");

    const cookie = extractSessionCookie(cookieHeader);
    expect(cookie).toBeTruthy();

    const sessionReq = new Request("http://localhost:3000/api/auth/session", {
      method: "GET",
      headers: { cookie: cookie! },
    });
    const sessionRes = await getSession(sessionReq);
    expect(sessionRes.status).toBe(200);

    const body = await sessionRes.json();
    expect(body.ok).toBe(true);
    expect(body.session).toBeTruthy();
    expect(body.session.kind).toBe("patient");
    expect(body.session.participantCode).toBe("P-SIM-001");
    expect(body.session.isSimulated).toBe(true);
    expect(body.session.actor.kind).toBe("patient");
    const actor = sessionToActor(body.session);
    expect(actor.kind).toBe("patient");
    if (actor.kind === "patient") {
      expect(actor.patientId).toBe(body.session.actor.patientId);
    }
  });

  it("signs in simulated staff with passphrase and 6-digit TOTP", async () => {
    const signInReq = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "123456",
      }),
    });

    const signInRes = await postSignIn(signInReq);
    expect(signInRes.status).toBe(200);

    const cookie = extractSessionCookie(signInRes.headers.get("set-cookie"));
    expect(cookie).toBeTruthy();

    const sessionReq = new Request("http://localhost:3000/api/auth/session", {
      method: "GET",
      headers: { cookie: cookie! },
    });
    const sessionRes = await getSession(sessionReq);
    const body = await sessionRes.json();
    expect(body.session.kind).toBe("staff");
    expect(body.session.displayName).toBe("Clinic Nurse");
    expect(body.session.actor.role).toBe("nurse");
  });

  it("rejects wrong staff password or code", async () => {
    const wrongPwReq = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: "nurse@sim-clinic.local",
        password: "bad-password",
        totpCode: "123456",
      }),
    });
    const wrongPwRes = await postSignIn(wrongPwReq);
    expect(wrongPwRes.status).toBe(401);
    expect((await wrongPwRes.json()).code).toBe("invalid_credentials");

    const nonDigitTotpReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "staff",
          email: "nurse@sim-clinic.local",
          password: "cepheus-local-only",
          totpCode: "abcdef",
        }),
      }
    );
    const nonDigitTotpRes = await postSignIn(nonDigitTotpReq);
    expect(nonDigitTotpRes.status).toBe(400);

    const wrongTotpReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "staff",
          email: "nurse@sim-clinic.local",
          password: "cepheus-local-only",
          totpCode: "000000",
        }),
      }
    );
    const wrongTotpRes = await postSignIn(wrongTotpReq);
    expect(wrongTotpRes.status).toBe(401);
    expect((await wrongTotpRes.json()).code).toBe("invalid_second_factor");
  });

  it("returns the same answer and status for unknown email and wrong password (calling comparison function once in each case)", async () => {
    const timingSpy = vi.spyOn(cryptoSecurity, "timingSafeEqualString");
    timingSpy.mockClear();

    const unknownEmailReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "staff",
          email: "unknown-nonexistent@sim-clinic.local",
          password: "cepheus-local-only",
          totpCode: "123456",
        }),
      }
    );
    const unknownEmailRes = await postSignIn(unknownEmailReq);
    expect(unknownEmailRes.status).toBe(401);
    const unknownBody = await unknownEmailRes.json();
    expect(timingSpy).toHaveBeenCalledTimes(1);

    timingSpy.mockClear();

    const wrongPasswordReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "staff",
          email: "nurse@sim-clinic.local",
          password: "wrong-password-999",
          totpCode: "123456",
        }),
      }
    );
    const wrongPasswordRes = await postSignIn(wrongPasswordReq);
    expect(wrongPasswordRes.status).toBe(401);
    const wrongPasswordBody = await wrongPasswordRes.json();
    expect(timingSpy).toHaveBeenCalledTimes(1);

    timingSpy.mockRestore();

    expect(unknownBody.ok).toBe(false);
    expect(unknownBody.code).toBe("invalid_credentials");
    expect(wrongPasswordBody.ok).toBe(false);
    expect(wrongPasswordBody.code).toBe("invalid_credentials");
    expect(unknownBody.message).toBe(wrongPasswordBody.message);
    expect(unknownBody.message).toBe("Invalid staff email or passphrase.");
  });

  it("returns a generic refused sign-in error for an unknown participant", async () => {
    const unknownParticipantReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "patient_eid",
          participantCode: "P-SIM-UNKNOWN-99",
        }),
      }
    );
    const res = await postSignIn(unknownParticipantReq);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("invalid_credentials");
    expect(body.message).toBe("Invalid credentials.");
  });

  it("refuses unbounded staff password (>256 chars) with generic refusal before comparison runs", async () => {
    const timingSpy = vi.spyOn(cryptoSecurity, "timingSafeEqualString");
    timingSpy.mockClear();

    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: "nurse@sim-clinic.local",
        password: "a".repeat(257),
        totpCode: "123456",
      }),
    });

    const res = await postSignIn(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("invalid_request");
    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });

  it("refuses unbounded staff email (>254 chars) with generic refusal before comparison runs", async () => {
    const timingSpy = vi.spyOn(cryptoSecurity, "timingSafeEqualString");
    timingSpy.mockClear();

    const oversizedEmail = `${"a".repeat(243)}@example.com`;
    expect(oversizedEmail.length).toBe(255);

    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: oversizedEmail,
        password: "cepheus-local-only",
        totpCode: "123456",
      }),
    });

    const res = await postSignIn(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("invalid_request");
    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });

  it("refuses unbounded participant code (>64 chars) with generic refusal before comparison runs", async () => {
    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "patient_eid",
        participantCode: "P".repeat(65),
      }),
    });

    const res = await postSignIn(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("invalid_request");
  });

  it("refuses non-6-digit staff code with generic refusal before comparison runs", async () => {
    const timingSpy = vi.spyOn(cryptoSecurity, "timingSafeEqualString");
    timingSpy.mockClear();

    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "1234567",
      }),
    });

    const res = await postSignIn(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("invalid_request");
    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });

  it("accepts inputs exactly at the maximum length boundaries", () => {
    const validPatient = PatientSignInRequestSchema.safeParse({
      mode: "patient_eid",
      participantCode: "P".repeat(64),
    });
    expect(validPatient.success).toBe(true);

    const validEmail = `${"a".repeat(242)}@example.com`;
    expect(validEmail.length).toBe(254);
    const validStaff = StaffSignInRequestSchema.safeParse({
      mode: "staff",
      email: validEmail,
      password: "p".repeat(256),
      totpCode: "123456",
    });
    expect(validStaff.success).toBe(true);
  });

  it("reports secondFactor mode in session endpoint without leaking secret or code", async () => {
    const req = makeSameOriginRequest("http://localhost:3000/api/auth/session");
    const res = await getSession(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secondFactor).toBe("fixed_demo");
  });

  it("enforces rate limiting after 10 sign-in attempts", async () => {
    for (let i = 0; i < 10; i++) {
      const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "patient_eid",
          participantCode: "P-SIM-001",
        }),
      });
      const res = await postSignIn(req);
      expect(res.status).toBe(200);
    }

    const blockedReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "patient_eid",
          participantCode: "P-SIM-001",
        }),
      }
    );
    const blockedRes = await postSignIn(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects cross-origin sign-in and sign-out requests", async () => {
    const crossSignIn = new Request("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: "patient_eid",
        participantCode: "P-SIM-001",
      }),
    });
    expect((await postSignIn(crossSignIn)).status).toBe(403);

    const crossSignOut = new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
      },
    });
    expect((await postSignOut(crossSignOut)).status).toBe(403);
  });

  it("clears session cookie on sign-out", async () => {
    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
    });
    const res = await postSignOut(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie?.toLowerCase()).toContain("max-age=0");
  });

  it("returns null session for tampered or invalid cookies", async () => {
    const valid = sealSession({
      kind: "patient",
      actor: {
        kind: "patient",
        patientId: "sim-post-tms-01",
        clinicId: "sim-clinic-01",
      },
      participantCode: "P-SIM-001",
      label: "Post-TMS follow-up participant",
      avatarInitials: "P1",
      authMethod: "simulated_finnish_eid",
      isSimulated: true,
      signedInAt: new Date().toISOString(),
    });
    const tampered = `${valid.slice(0, -4)}xxxx`;
    expect(unsealSession(tampered)).toBeNull();

    const req = new Request("http://localhost:3000/api/auth/session", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${tampered}` },
    });
    const res = await getSession(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toBeNull();
  });

  describe("Staff TOTP configurations and second factor resolution", () => {
    const originalEnv = { ...process.env };
    const validBase32Secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    beforeEach(() => {
      process.env = { ...originalEnv };
      _resetEnv();
      _resetTotpReplayProtection();
    });

    it("with no secret, 123456 accepted and another code refused", async () => {
      delete process.env.STAFF_TOTP_SECRET;
      delete process.env.STAFF_DEMO_TOTP_CODE;
      _resetEnv();

      const accepted = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "123456",
      });
      expect(accepted.ok).toBe(true);

      const refused = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "654321",
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.code).toBe("invalid_second_factor");
      }
    });

    it("with STAFF_DEMO_TOTP_CODE set, that value accepted and 123456 refused", async () => {
      delete process.env.STAFF_TOTP_SECRET;
      process.env.STAFF_DEMO_TOTP_CODE = "987654";
      _resetEnv();

      const accepted = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "987654",
      });
      expect(accepted.ok).toBe(true);

      const refused = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "123456",
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.code).toBe("invalid_second_factor");
      }
    });

    it("with STAFF_TOTP_SECRET set, time-based code accepted, wrong code refused, reused code refused", async () => {
      process.env.STAFF_TOTP_SECRET = validBase32Secret;
      _resetEnv();

      const currentTime = Math.floor(Date.now() / 1000);
      const validCode = generateTotp(validBase32Secret, currentTime);

      const accepted = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: validCode,
      });
      expect(accepted.ok).toBe(true);

      // Reused code is refused
      const reused = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: validCode,
      });
      expect(reused.ok).toBe(false);
      if (!reused.ok) {
        expect(reused.code).toBe("invalid_second_factor");
      }

      // Wrong code is refused
      const wrong = await authenticateStaffCredentials({
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "000000",
      });
      expect(wrong.ok).toBe(false);
      if (!wrong.ok) {
        expect(wrong.code).toBe("invalid_second_factor");
      }
    });

    it("an invalid secret is a configuration error", async () => {
      process.env.STAFF_TOTP_SECRET = "not-valid-base32!";
      _resetEnv();

      await expect(
        authenticateStaffCredentials({
          email: "nurse@sim-clinic.local",
          password: "cepheus-local-only",
          totpCode: "123456",
        })
      ).rejects.toThrowError(/STAFF_TOTP_SECRET/);
    });
  });
});
