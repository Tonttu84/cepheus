import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getFlags } from "@/app/api/clinic/flags/route";
import { GET as getCrisisEvents } from "@/app/api/clinic/crisis-events/route";
import { POST as acknowledgeCrisis } from "@/app/api/clinic/crisis-events/acknowledge/route";
import { POST as recordNurseCall } from "@/app/api/clinic/nurse-calls/route";
import { setRouteDepsForTests } from "@/server/api";
import type { StoredWarning } from "@/usecases/ports";
import {
  allKeys,
  apiRequest,
  CLINIC_ID,
  OTHER_CLINIC_ID,
  patientCookie,
  patientRecord,
  setUpRoutes,
  staffCookie,
  tearDownRoutes,
} from "@/app/api/__tests__/route-test-kit";

function warningFor(patientId: string, raisedAt: string): StoredWarning {
  return {
    patientId,
    kind: "phq9",
    since: "2026-11-16",
    version: 1,
    causedBy: { type: "phq9", date: "2026-11-16" },
    raisedAt,
  };
}

function flagsRequest(cookie: string | null, query = "") {
  return apiRequest(`/api/clinic/flags${query}`, { method: "GET", cookie });
}

function crisisEventsRequest(cookie: string | null, query = "") {
  return apiRequest(`/api/clinic/crisis-events${query}`, { method: "GET", cookie });
}

function acknowledgeCrisisRequest(cookie: string | null, body?: unknown, query = "") {
  return apiRequest(`/api/clinic/crisis-events/acknowledge${query}`, { method: "POST", cookie, body });
}

function nurseCallsRequest(cookie: string | null, body?: unknown, query = "") {
  return apiRequest(`/api/clinic/nurse-calls${query}`, { method: "POST", cookie, body });
}

describe("GET /api/clinic/flags", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-1" }));
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-2" }));
    await fake.ports.patients.savePatient(
      patientRecord({ patientId: "own-no-consent", consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false } })
    );
    await fake.ports.patients.savePatient(patientRecord({ patientId: "other-1", clinicId: OTHER_CLINIC_ID }));
    for (const [id, at] of [
      ["own-1", "2026-11-16T17:00:00.000Z"],
      ["own-2", "2026-11-17T17:00:00.000Z"],
      ["own-no-consent", "2026-11-17T18:00:00.000Z"],
      ["other-1", "2026-11-17T19:00:00.000Z"],
    ]) {
      await fake.ports.warnings.saveWarning(warningFor(id, at));
    }
    fake.clinicPatients[CLINIC_ID] = ["own-1", "own-2", "own-no-consent"];
    fake.clinicPatients[OTHER_CLINIC_ID] = ["other-1"];
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("lists the flags of the nurse's own clinic only, newest first, for patients who consent to care", async () => {
    const res = await getFlags(flagsRequest(staffCookie()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; flags: { patientId: string }[] };
    expect(body.flags.map((f) => f.patientId)).toEqual(["own-2", "own-1"]);
  });

  it("never contains answers, scores, totals or the rule's trigger", async () => {
    const body = await (await getFlags(flagsRequest(staffCookie()))).json();
    const keys = allKeys(body);
    for (const forbidden of ["answers", "value", "score", "total", "mood", "interest", "kind", "causedby"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(Object.keys(body.flags[0]).sort()).toEqual(["area", "patientId", "raisedAt", "since"]);
  });

  it("logs each staff read of a patient's flags", async () => {
    await getFlags(flagsRequest(staffCookie()));
    const logs = await fake.ports.accessLog.getLogs("own-1");
    expect(logs.some((e) => e.actor.kind === "staff" && e.target.kind === "flags" && e.allowed)).toBe(true);
  });

  it("gives a nurse of another clinic only that clinic's flags", async () => {
    const body = await (await getFlags(flagsRequest(staffCookie(OTHER_CLINIC_ID)))).json();
    expect(body.flags.map((f: { patientId: string }) => f.patientId)).toEqual(["other-1"]);
  });

  it("refuses patients (403), callers without a session (401) and query parameters (400)", async () => {
    expect((await getFlags(flagsRequest(patientCookie("own-1")))).status).toBe(403);
    expect((await getFlags(flagsRequest(null))).status).toBe(401);
    const withQuery = await getFlags(flagsRequest(staffCookie(), "?patientId=other-1"));
    expect(withQuery.status).toBe(400);
    expect(await withQuery.text()).not.toContain("other-1");
  });

  it("answers 503 when storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRouteDepsForTests(() => ({
      ports: fake.ports,
      clinicPatientIds: async () => {
        throw new Error("connection refused");
      },
    }));
    const res = await getFlags(flagsRequest(staffCookie()));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/clinic/crisis-events", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-1" }));
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-2" }));
    await fake.ports.patients.savePatient(patientRecord({ patientId: "other-1", clinicId: OTHER_CLINIC_ID }));

    await fake.ports.crisis.saveCrisisEvent({
      patientId: "own-1",
      roundNumber: 1,
      itemId: "9",
      value: 2,
      occurredAt: "2026-11-16T16:00:00.000Z",
      acknowledgedAt: null,
    });
    await fake.ports.crisis.saveCrisisEvent({
      patientId: "own-2",
      roundNumber: 1,
      itemId: "crisis_button",
      value: 1,
      occurredAt: "2026-11-16T17:00:00.000Z",
      acknowledgedAt: null,
    });
    // Already acknowledged
    await fake.ports.crisis.saveCrisisEvent({
      patientId: "own-1",
      roundNumber: 2,
      itemId: "9",
      value: 1,
      occurredAt: "2026-11-16T18:00:00.000Z",
      acknowledgedAt: "2026-11-16T18:30:00.000Z",
    });
    // Other clinic
    await fake.ports.crisis.saveCrisisEvent({
      patientId: "other-1",
      roundNumber: 1,
      itemId: "9",
      value: 3,
      occurredAt: "2026-11-16T16:30:00.000Z",
      acknowledgedAt: null,
    });
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("lists unacknowledged crisis events of caller clinic only and never contains item values", async () => {
    const res = await getCrisisEvents(crisisEventsRequest(staffCookie()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; crisisEvents: { patientId: string; roundNumber: number; occurredAt: string }[] };
    expect(body.crisisEvents.map((e) => e.patientId)).toEqual(["own-1", "own-2"]);

    const keys = allKeys(body);
    for (const forbidden of ["answers", "value", "score", "total", "mood", "interest"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("gives a nurse of another clinic only that clinic's crisis events", async () => {
    const res = await getCrisisEvents(crisisEventsRequest(staffCookie(OTHER_CLINIC_ID)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; crisisEvents: { patientId: string }[] };
    expect(body.crisisEvents.map((e) => e.patientId)).toEqual(["other-1"]);
  });

  it("refuses patients (403), callers without a session (401) and query parameters (400)", async () => {
    expect((await getCrisisEvents(crisisEventsRequest(patientCookie("own-1")))).status).toBe(403);
    expect((await getCrisisEvents(crisisEventsRequest(null))).status).toBe(401);
    const withQuery = await getCrisisEvents(crisisEventsRequest(staffCookie(), "?patientId=other-1"));
    expect(withQuery.status).toBe(400);
  });

  it("answers 503 when storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRouteDepsForTests(() => ({
      ports: {
        ...fake.ports,
        crisis: {
          ...fake.ports.crisis,
          getUnacknowledgedCrisisEvents: async () => {
            throw new Error("storage unreachable");
          },
        },
      },
      clinicPatientIds: async () => [],
    }));
    const res = await getCrisisEvents(crisisEventsRequest(staffCookie()));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/clinic/crisis-events/acknowledge", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-1" }));
    await fake.ports.patients.savePatient(patientRecord({ patientId: "other-1", clinicId: OTHER_CLINIC_ID }));

    await fake.ports.crisis.saveCrisisEvent({
      patientId: "own-1",
      roundNumber: 1,
      itemId: "9",
      value: 2,
      occurredAt: "2026-11-16T16:00:00.000Z",
      acknowledgedAt: null,
    });
    await fake.ports.crisis.saveCrisisEvent({
      patientId: "own-1",
      roundNumber: 2,
      itemId: "9",
      value: 1,
      occurredAt: "2026-11-16T17:00:00.000Z",
      acknowledgedAt: "2026-11-16T17:30:00.000Z",
      acknowledgedByStaffId: "staff-prior",
    });
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("acknowledges an unacknowledged crisis event and records staff id and time", async () => {
    const res = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: 1 })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.acknowledged).toBe(true);
    expect(body.patientId).toBe("own-1");
    expect(body.roundNumber).toBe(1);
    expect(body.acknowledgedByStaffId).toBe("staff-1");
    expect(body.acknowledgedAt).toBeDefined();

    // Check it is no longer unacknowledged
    const unack = await fake.ports.crisis.getUnacknowledgedCrisisEvents(CLINIC_ID);
    expect(unack).toHaveLength(0);
  });

  it("returns 409 conflict when acknowledging an already acknowledged event (once only)", async () => {
    const res = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: 2 })
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 when patient or crisis event is not found", async () => {
    const resUnknownPatient = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(), { patientId: "unknown-patient", roundNumber: 1 })
    );
    expect(resUnknownPatient.status).toBe(404);

    const resUnknownEvent = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: 99 })
    );
    expect(resUnknownEvent.status).toBe(404);
  });

  it("refuses nurse of another clinic (403)", async () => {
    const res = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(OTHER_CLINIC_ID), { patientId: "own-1", roundNumber: 1 })
    );
    expect(res.status).toBe(403);
  });

  it("refuses patients (403), callers without session (401), invalid body / extra keys (400)", async () => {
    expect((await acknowledgeCrisis(acknowledgeCrisisRequest(patientCookie("own-1"), { patientId: "own-1", roundNumber: 1 }))).status).toBe(403);
    expect((await acknowledgeCrisis(acknowledgeCrisisRequest(null, { patientId: "own-1", roundNumber: 1 }))).status).toBe(401);
    expect((await acknowledgeCrisis(acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: "not-a-number" }))).status).toBe(400);
    expect((await acknowledgeCrisis(acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: 1, extraKey: true }))).status).toBe(400);
  });

  it("answers 503 on storage failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRouteDepsForTests(() => ({
      ports: {
        ...fake.ports,
        crisis: {
          ...fake.ports.crisis,
          saveCrisisEvent: async () => {
            throw new Error("disk failure");
          },
        },
      },
      clinicPatientIds: async () => [],
    }));
    const res = await acknowledgeCrisis(
      acknowledgeCrisisRequest(staffCookie(), { patientId: "own-1", roundNumber: 1 })
    );
    expect(res.status).toBe(503);
  });
});

describe("POST /api/clinic/nurse-calls", () => {
  let fake: ReturnType<typeof setUpRoutes>;

  beforeEach(async () => {
    fake = setUpRoutes();
    await fake.ports.patients.savePatient(patientRecord({ patientId: "own-1" }));
    await fake.ports.patients.savePatient(
      patientRecord({ patientId: "own-no-consent", consent: { taking_part: false, methods: { ring: false, camera: false }, rule_check: false } })
    );
    await fake.ports.patients.savePatient(patientRecord({ patientId: "other-1", clinicId: OTHER_CLINIC_ID }));

    await fake.ports.rounds.saveRound({
      patientId: "own-1",
      roundNumber: 1,
      localDate: "2026-11-16",
      status: "answered",
      mood: 3,
      interest: 3,
    });

    await fake.ports.warnings.saveWarning(warningFor("own-1", "2026-11-16T17:00:00.000Z"));
  });

  afterEach(() => {
    tearDownRoutes();
    vi.restoreAllMocks();
  });

  it("records a nurse call outcome, updates the flag, and restarts the warning rule", async () => {
    const res = await recordNurseCall(
      nurseCallsRequest(staffCookie(), {
        patientId: "own-1",
        flagId: "flag-abc",
        status: "completed",
        outcomeTier: "rough_patch",
        actionTaken: "advice_and_medication_check",
        medicationChecked: true,
        watchNextRounds: 2,
        date: "2026-11-16",
        position: "after",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.saved).toBe(true);
    expect(body.patientId).toBe("own-1");
    expect(body.outcomeTier).toBe("rough_patch");
    expect(body.actionTaken).toBe("advice_and_medication_check");
    expect(body.flagStatus).toBe("watching");

    // Flag status was updated
    expect(fake.ctx.state.flagStatuses["flag-abc"]).toBe("watching");

    // Stored as call on date so warning rule restarts
    const calls = await fake.ports.calls.getCalls("own-1");
    expect(calls).toEqual([{ patientId: "own-1", date: "2026-11-16", position: "after" }]);
  });

  it("updates the flag to booster_offered when action is booster_tms_cluster", async () => {
    const res = await recordNurseCall(
      nurseCallsRequest(staffCookie(), {
        patientId: "own-1",
        flagId: "flag-booster",
        status: "completed",
        outcomeTier: "sustained_decline",
        actionTaken: "booster_tms_cluster",
        boosterSessionsPlanned: 5,
        date: "2026-11-16",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagStatus).toBe("booster_offered");
    expect(fake.ctx.state.flagStatuses["flag-booster"]).toBe("booster_offered");
  });

  it("refuses when patient has revoked care consent (403)", async () => {
    const res = await recordNurseCall(
      nurseCallsRequest(staffCookie(), {
        patientId: "own-no-consent",
        status: "completed",
        outcomeTier: "rough_patch",
      })
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain("consent_required");
  });

  it("refuses nurse of another clinic (403)", async () => {
    const res = await recordNurseCall(
      nurseCallsRequest(staffCookie(OTHER_CLINIC_ID), {
        patientId: "own-1",
        status: "completed",
      })
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain("other_clinic");
  });

  it("refuses patients (403), callers without session (401), invalid body / extra keys (400)", async () => {
    expect((await recordNurseCall(nurseCallsRequest(patientCookie("own-1"), { patientId: "own-1" }))).status).toBe(403);
    expect((await recordNurseCall(nurseCallsRequest(null, { patientId: "own-1" }))).status).toBe(401);
    expect((await recordNurseCall(nurseCallsRequest(staffCookie(), { patientId: "own-1", outcomeTier: "invalid-tier" }))).status).toBe(400);
    expect((await recordNurseCall(nurseCallsRequest(staffCookie(), { patientId: "own-1", freeTextNotes: "forbidden note" }))).status).toBe(400);
  });

  it("answers 503 on storage failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRouteDepsForTests(() => ({
      ports: {
        ...fake.ports,
        calls: {
          ...fake.ports.calls,
          saveNurseCallRecord: async () => {
            throw new Error("database disconnected");
          },
        },
      },
      clinicPatientIds: async () => [],
    }));
    const res = await recordNurseCall(
      nurseCallsRequest(staffCookie(), { patientId: "own-1", status: "completed" })
    );
    expect(res.status).toBe(503);
  });
});
