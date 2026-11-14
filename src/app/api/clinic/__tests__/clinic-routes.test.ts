import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getFlags } from "@/app/api/clinic/flags/route";
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
