import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { GET as getState } from "@/app/api/check-in/route";
import { POST as postTaps } from "@/app/api/check-in/taps/route";
import { POST as postPhq9 } from "@/app/api/check-in/phq9/route";
import { POST as postGad7 } from "@/app/api/check-in/gad7/route";
import { GET as getFlags } from "@/app/api/clinic/flags/route";
import { POST as evaluate } from "@/app/api/patients/[patientId]/evaluate/route";
import { POST as acknowledgeCrisis } from "@/app/api/clinic/crisis-events/acknowledge/route";
import { POST as postNurseCall } from "@/app/api/clinic/nurse-calls/route";
import { getPrisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, sealSession, simulatedFinnishEidProvider } from "@/server/auth";
import { resetRouteDeps } from "@/server/api";
import { _resetEnv } from "@/server/env";
import { _resetRateLimits } from "@/server/security";
import { PHQ9_COLUMNS } from "@/server/db/phq9-columns";

// P-SIM-ANX-01 is the depression-and-anxiety sample patient of trail 53's
// simulated e-ID; the seed does not create it, so this test does, in a
// clinic of its own, and lets the provider map the code to the row.
const PARTICIPANT_CODE = "P-SIM-ANX-01";
const CLINIC_CODE = "routes-dbtest-clinic";
const SYSTEM_KEY = "routes-dbtest-system-key-0123456789abcdef";
const ROUND_1_OPEN = new Date("2026-11-16T16:05:00.000Z");

function request(path: string, init: { method?: string; cookie?: string; body?: unknown; bearer?: string }) {
  const headers = new Headers({ host: "localhost:3000", "content-type": "application/json" });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.bearer) headers.set("authorization", `Bearer ${init.bearer}`);
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("the routes on PostgreSQL (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  let clinicId: string;
  let patientId: string;
  let patientCookie: string;
  let nurseCookie: string;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ROUND_1_OPEN);
    process.env.SYSTEM_API_KEY = SYSTEM_KEY;
    delete process.env.STORE_ITEM_ANSWERS;
    _resetEnv();
    _resetRateLimits();
    resetRouteDeps();

    prisma = getPrisma();
    await prisma.participant.deleteMany({ where: { participantCode: PARTICIPANT_CODE } });
    await prisma.clinic.deleteMany({ where: { code: CLINIC_CODE } });
    const clinic = await prisma.clinic.create({ data: { code: CLINIC_CODE, name: "Routes test clinic" } });
    clinicId = clinic.id;
    await prisma.staffUser.create({
      data: {
        id: "routes-dbtest-nurse",
        clinicId,
        email: "nurse@sim-clinic.local",
        name: "Simulated nurse",
        role: "nurse",
      },
    });
    const participant = await prisma.participant.create({
      data: {
        clinicId,
        participantCode: PARTICIPANT_CODE,
        label: "Simulated participant",
        source: "synthetic",
        isSimulated: true,
        enrolmentDate: "2026-11-16",
        scheduleDaysJson: "[1,4]",
        scheduleTime: "18:00",
        timeZone: "Europe/Helsinki",
        takingPart: true,
        ruleCheckConsent: true,
        questionnairesJson: JSON.stringify(["phq9", "gad7"]),
      },
    });
    patientId = participant.id;

    const session = await simulatedFinnishEidProvider.authenticateSimulatedPreset(PARTICIPANT_CODE);
    expect(session?.actor).toEqual({ kind: "patient", patientId, clinicId });
    patientCookie = `${SESSION_COOKIE_NAME}=${sealSession(session!)}`;
    nurseCookie = `${SESSION_COOKIE_NAME}=${sealSession({
      kind: "staff",
      actor: { kind: "staff", staffId: "routes-dbtest-nurse", clinicId, role: "nurse" },
      displayName: "Simulated nurse",
      email: "nurse@sim-clinic.local",
      clinicName: "Routes test clinic",
      avatarInitials: "SN",
      isSimulated: true,
      signedInAt: ROUND_1_OPEN.toISOString(),
    })}`;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { clinicId } });
    await prisma.accessLog.deleteMany({ where: { OR: [{ clinicId }, { targetPatientId: patientId }] } });
    await prisma.clinic.deleteMany({ where: { code: CLINIC_CODE } });
    vi.useRealTimers();
    delete process.env.SYSTEM_API_KEY;
    _resetEnv();
  });

  async function phq9Row() {
    return prisma.phq9Assessment.findFirstOrThrow({ where: { participantId: patientId } });
  }

  it("answers the taps and a PHQ-9 item by item, keeps no item answers, then shows the flag to the nurse", async () => {
    const before = await (await getState(request("/api/check-in", { method: "GET", cookie: patientCookie }))).json();
    expect(before).toMatchObject({ ok: true, taps: "waiting", isPhq9Due: true, phq9Progress: "not_started" });

    expect((await postTaps(request("/api/check-in/taps", { cookie: patientCookie, body: { mood: 1, interest: 1 } }))).status).toBe(200);

    for (const itemId of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const res = await postPhq9(request("/api/check-in/phq9", { cookie: patientCookie, body: { itemId, value: 2 } }));
      expect(res.status).toBe(200);
    }
    const unfinished = await phq9Row();
    expect(unfinished.status).toBe("in_progress");
    for (const column of PHQ9_COLUMNS) expect(unfinished[column]).toBeNull();

    const last = await postPhq9(request("/api/check-in/phq9", { cookie: patientCookie, body: { itemId: "9", value: 1 } }));
    expect(last.status).toBe(200);
    const lastBody = await last.json();
    expect(lastBody).toMatchObject({ ok: true, saved: true, progress: "completed", showCrisisPath: true });
    expect(lastBody.crisisResources.length).toBeGreaterThan(0);

    const completed = await phq9Row();
    expect(completed.totalScore).toBe(17);
    for (const column of PHQ9_COLUMNS) expect(completed[column]).toBeNull();

    const after = await (await getState(request("/api/check-in", { method: "GET", cookie: patientCookie }))).json();
    expect(after).toMatchObject({ taps: "answered", phq9Progress: "completed" });

    const ruled = await evaluate(
      request(`/api/patients/${patientId}/evaluate`, { bearer: SYSTEM_KEY }),
      { params: Promise.resolve({ patientId }) }
    );
    expect(ruled.status).toBe(200);

    const flags = await (await getFlags(request("/api/clinic/flags", { method: "GET", cookie: nurseCookie }))).json();
    expect(flags.ok).toBe(true);
    expect(flags.flags.length).toBeGreaterThan(0);
    expect(flags.flags[0]).toEqual({
      patientId,
      area: "check_in",
      since: expect.any(String),
      raisedAt: expect.any(String),
    });
    expect(JSON.stringify(flags)).not.toMatch(/total|score|value/i);
  });

  it("answers a GAD-7 item for the anxiety sample patient", async () => {
    const res = await postGad7(request("/api/check-in/gad7", { cookie: patientCookie, body: { itemId: "1", value: 2 } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, saved: true, isComplete: false });
    const row = await prisma.gad7Assessment.findFirstOrThrow({ where: { participantId: patientId } });
    expect(row.status).toBe("in_progress");
  });

  it("gives a nurse of another clinic none of these flags", async () => {
    const otherNurse = `${SESSION_COOKIE_NAME}=${sealSession({
      kind: "staff",
      actor: { kind: "staff", staffId: "routes-dbtest-other", clinicId: "routes-dbtest-no-clinic", role: "nurse" },
      displayName: "Simulated nurse",
      email: "nurse@sim-clinic.local",
      clinicName: "Other clinic",
      avatarInitials: "SN",
      isSimulated: true,
      signedInAt: ROUND_1_OPEN.toISOString(),
    })}`;
    const flags = await (await getFlags(request("/api/clinic/flags", { method: "GET", cookie: otherNurse }))).json();
    expect(flags).toEqual({ ok: true, flags: [] });
  });

  it("a seeded nurse acknowledges a crisis event and records a nurse call through the storage, and both rows are read back", async () => {
    // Round 1 produced a crisis event in the first test when PHQ-9 item 9 was answered with 1
    const ackRes = await acknowledgeCrisis(
      request("/api/clinic/crisis-events/acknowledge", {
        cookie: nurseCookie,
        body: { patientId, roundNumber: 1 },
      })
    );
    expect(ackRes.status).toBe(200);
    const ackBody = await ackRes.json();
    expect(ackBody).toMatchObject({
      ok: true,
      acknowledged: true,
      patientId,
      roundNumber: 1,
      acknowledgedByStaffId: "routes-dbtest-nurse",
    });

    const callRes = await postNurseCall(
      request("/api/clinic/nurse-calls", {
        cookie: nurseCookie,
        body: {
          patientId,
          status: "completed",
          outcomeTier: "rough_patch",
          actionTaken: "advice_and_medication_check",
          medicationChecked: true,
          watchNextRounds: 2,
          date: "2026-11-16",
          position: "after",
        },
      })
    );
    expect(callRes.status).toBe(200);
    const callBody = await callRes.json();
    expect(callBody).toMatchObject({
      ok: true,
      saved: true,
      patientId,
      status: "completed",
      outcomeTier: "rough_patch",
      actionTaken: "advice_and_medication_check",
    });

    // Read back both rows through the database storage
    const crisisRow = await prisma.crisisEvent.findFirstOrThrow({
      where: { participantId: patientId, roundNumber: 1 },
    });
    expect(crisisRow.acknowledgedAt).not.toBeNull();
    expect(crisisRow.acknowledgedByStaffId).toBe("routes-dbtest-nurse");

    const callRow = await prisma.nurseCallRecord.findFirstOrThrow({
      where: { participantId: patientId },
    });
    expect(callRow.staffUserId).toBe("routes-dbtest-nurse");
    expect(callRow.status).toBe("completed");
    expect(callRow.outcomeTier).toBe("rough_patch");
    expect(callRow.actionTaken).toBe("advice_and_medication_check");
    expect(callRow.medicationChecked).toBe(true);
    expect(callRow.watchNextRounds).toBe(2);
    expect(callRow.date).toBe("2026-11-16");
    expect(callRow.position).toBe("after");
  });
});
