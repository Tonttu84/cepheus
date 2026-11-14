import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSession } from "@/app/api/auth/session/route";
import { POST as postSignIn } from "@/app/api/auth/sign-in/route";
import { POST as postSignOut } from "@/app/api/auth/sign-out/route";
import {
  SESSION_COOKIE_NAME,
  sealSession,
  sessionToActor,
  unsealSession,
} from "@/server/auth";
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

    const setCookie = signInRes.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie?.toLowerCase()).toContain("httponly");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");

    const cookiePair = extractSessionCookie(setCookie);
    expect(cookiePair).toBeTruthy();

    const sessionReq = new Request("http://localhost:3000/api/auth/session", {
      method: "GET",
      headers: { cookie: cookiePair as string },
    });
    const sessionRes = await getSession(sessionReq);
    expect(sessionRes.status).toBe(200);
    const body = await sessionRes.json();
    expect(body.ok).toBe(true);
    expect(body.session.kind).toBe("patient");
    expect(body.session.participantCode).toBe("P-SIM-001");
    expect(body.session.isSimulated).toBe(true);
    expect(body.session.email).toBeUndefined();

    const actor = sessionToActor(body.session);
    expect(actor.kind).toBe("patient");
    if (actor.kind === "patient") {
      expect(actor.patientId).toBeTruthy();
      expect(actor.clinicId).toBeTruthy();
    }
  });

  it("signs in clinic staff with valid credentials and 2FA", async () => {
    const req = makeSameOriginRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "staff",
        email: "nurse@sim-clinic.local",
        password: "cepheus-local-only",
        totpCode: "123456",
      }),
    });

    const res = await postSignIn(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.session.kind).toBe("staff");
    expect(body.session.displayName).toBe("Clinic Nurse");
    expect(body.session.actor.role).toBe("nurse");
  });

  it("rejects staff sign-in with wrong password or invalid 2FA", async () => {
    const wrongPasswordReq = makeSameOriginRequest(
      "http://localhost:3000/api/auth/sign-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "staff",
          email: "nurse@sim-clinic.local",
          password: "wrong-password",
          totpCode: "123456",
        }),
      }
    );
    const wrongPasswordRes = await postSignIn(wrongPasswordReq);
    expect(wrongPasswordRes.status).toBe(401);
    expect((await wrongPasswordRes.json()).code).toBe("invalid_credentials");

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
});
