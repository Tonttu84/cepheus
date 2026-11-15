import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { GET as getState } from "@/app/api/check-in/route";
import { POST as postTaps } from "@/app/api/check-in/taps/route";
import { POST as postPhq9 } from "@/app/api/check-in/phq9/route";
import { GET as getFlags } from "@/app/api/clinic/flags/route";
import { getPrisma } from "@/lib/db";
import { resetRouteDeps } from "@/server/api";
import {
  authenticateStaffCredentials,
  SESSION_COOKIE_NAME,
  sealSession,
  simulatedFinnishEidProvider,
} from "@/server/auth";
import { seedDatabase, SIM_NURSE } from "../../../prisma/seed";

function apiRequest(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {}
) {
  const headers = new Headers({
    host: "localhost:3000",
    "content-type": "application/json",
  });
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("core flow on PostgreSQL: seeded patient check-in to nurse clinic flag (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let patientId: string;
  let patientCookie: string;
  let nurseCookie: string;
  let otherNurseCookie: string;

  beforeAll(async () => {
    resetRouteDeps();
    prisma = getPrisma();
    const seedResult = await seedDatabase(prisma);
    patientId = seedResult.participantId;

    const patientSession =
      await simulatedFinnishEidProvider.authenticateSimulatedPreset("P-SIM-001");
    expect(patientSession).not.toBeNull();
    patientCookie = `${SESSION_COOKIE_NAME}=${sealSession(patientSession!)}`;

    const nurseAuth = await authenticateStaffCredentials({
      email: SIM_NURSE.email,
      password: "cepheus-local-only",
      totpCode: "123456",
    });
    expect(nurseAuth.ok).toBe(true);
    if (!nurseAuth.ok) throw new Error("Staff auth failed");
    nurseCookie = `${SESSION_COOKIE_NAME}=${sealSession(nurseAuth.session)}`;

    otherNurseCookie = `${SESSION_COOKIE_NAME}=${sealSession({
      kind: "staff",
      actor: {
        kind: "staff",
        staffId: "other-clinic-nurse",
        clinicId: "other-clinic-99",
        role: "nurse",
      },
      displayName: "Other Nurse",
      email: "nurse@other-clinic.local",
      clinicName: "Other Clinic",
      avatarInitials: "ON",
      isSimulated: true,
      signedInAt: new Date().toISOString(),
    })}`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("answers the check-in through the API, raises a flag via the rule, and the seeded nurse sees it", async () => {
    const stateRes = await getState(
      apiRequest("/api/check-in", { method: "GET", cookie: patientCookie })
    );
    expect(stateRes.status).toBe(200);
    const state = await stateRes.json();
    expect(state).toMatchObject({
      ok: true,
      taps: "waiting",
      isPhq9Due: true,
    });

    const tapsRes = await postTaps(
      apiRequest("/api/check-in/taps", {
        cookie: patientCookie,
        body: { mood: 1, interest: 1 },
      })
    );
    expect(tapsRes.status).toBe(200);

    for (let item = 1; item <= 8; item++) {
      const res = await postPhq9(
        apiRequest("/api/check-in/phq9", {
          cookie: patientCookie,
          body: { itemId: String(item), value: 2 },
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.showCrisisPath).toBe(false);
    }

    const lastPhq9Res = await postPhq9(
      apiRequest("/api/check-in/phq9", {
        cookie: patientCookie,
        body: { itemId: "9", value: 1 },
      })
    );
    expect(lastPhq9Res.status).toBe(200);
    const lastBody = await lastPhq9Res.json();
    expect(lastBody).toMatchObject({
      ok: true,
      saved: true,
      progress: "completed",
      showCrisisPath: true,
    });

    const flagsRes = await getFlags(
      apiRequest("/api/clinic/flags", { method: "GET", cookie: nurseCookie })
    );
    expect(flagsRes.status).toBe(200);
    const flagsBody = await flagsRes.json();
    expect(flagsBody.ok).toBe(true);
    expect(flagsBody.flags.length).toBeGreaterThan(0);
    const patientFlag = flagsBody.flags.find(
      (f: { patientId: string }) => f.patientId === patientId
    );
    expect(patientFlag).toBeDefined();
    expect(patientFlag).toEqual({
      patientId,
      area: "check_in",
      since: expect.any(String),
      raisedAt: expect.any(String),
    });

    const serialized = JSON.stringify(flagsBody);
    expect(serialized).not.toMatch(/mood|interest|score|total|value|item/i);

    const otherFlagsRes = await getFlags(
      apiRequest("/api/clinic/flags", {
        method: "GET",
        cookie: otherNurseCookie,
      })
    );
    expect(otherFlagsRes.status).toBe(200);
    const otherBody = await otherFlagsRes.json();
    expect(otherBody).toEqual({ ok: true, flags: [] });
  });
});
